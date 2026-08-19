"""
Recommender service — AI-assisted leave conflict resolution.

When a manager cannot approve every overlapping leave request for the
same period, this service:

1. Analyses each employee's past leave behaviour (deterministically,
   from the leave_requests collection and regional holiday calendars).
2. Builds candidate alternative leave windows (holiday-adjacent and
   generic) for each employee.
3. Asks a lightweight LLM (Gemini Flash free tier by default; any
   OpenAI-compatible provider works via LLM_BASE_URL) to pick which
   employee(s) to reschedule and why. If no API key is configured or
   the call fails, a deterministic heuristic produces the
   recommendations instead, so the feature always works.
4. Manages the reschedule workflow: manager sends a reschedule request,
   the employee accepts (leave dates are moved, normal approval flow
   continues) or rejects it, with notifications in both directions.

Per POLICY.md, the AI never computes balances or entitlements — all
numbers are produced by the deterministic engines and merely explained
by the model.
"""

import json
import logging
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional

# pyrefly: ignore [missing-import]
from bson import ObjectId
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.database import get_db
from app.schemas.recommender import (
    ConflictAnalyzeRequest,
    ConflictAnalyzeResponse,
    Recommendation,
    RescheduleCreate,
    RescheduleListResponse,
    RescheduleRespond,
    RescheduleResponse,
)
from app.services import notification_service
from app.services.calendar_service import CalendarService

logger = logging.getLogger(__name__)

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

HOLIDAY_ADJACENCY_DAYS = 3
CANDIDATE_LOOKAHEAD_DAYS = 180
MAX_HOLIDAY_CANDIDATES = 4


# ===========================================================================
# DATE HELPERS (deterministic, calendar-engine backed)
# ===========================================================================


def _to_dt(value: date) -> datetime:
    """Normalize a date to the midnight datetime stored in leave docs."""
    return datetime.combine(CalendarService.to_date(value), time.min)


def _fmt(value) -> str:
    """Format a date/datetime as YYYY-MM-DD."""
    return CalendarService.to_date(value).isoformat()


def _next_working_day(region: str, start: date) -> date:
    """First working day on or after `start`."""
    current = CalendarService.to_date(start)
    for _ in range(30):
        if CalendarService.is_working_day(region, current):
            return current
        current += timedelta(days=1)
    return current


def _window_of_working_days(region: str, start: date, working_days: int) -> tuple:
    """
    Build a (start, end) window beginning at the first working day on or
    after `start` that contains exactly `working_days` working days.
    """
    working_days = max(1, int(working_days))
    window_start = _next_working_day(region, start)
    current = window_start
    counted = 1
    while counted < working_days:
        current += timedelta(days=1)
        if CalendarService.is_working_day(region, current):
            counted += 1
    return window_start, current


# ===========================================================================
# BEHAVIOUR ANALYSIS
# ===========================================================================


def _is_holiday_adjacent(region: str, leave_start: date, leave_end: date) -> Optional[str]:
    """
    Return the name of a holiday within HOLIDAY_ADJACENCY_DAYS of the
    leave window (or inside it), or None.
    """
    probe = leave_start - timedelta(days=HOLIDAY_ADJACENCY_DAYS)
    limit = leave_end + timedelta(days=HOLIDAY_ADJACENCY_DAYS)
    while probe <= limit:
        holiday = CalendarService.get_holiday(region, probe)
        if holiday:
            return holiday.get("name") or "a holiday"
        probe += timedelta(days=1)
    return None


async def _build_behavior_profile(db, employee: dict, exclude_ids: set) -> dict:
    """
    Compute deterministic behavioural stats from the employee's full
    leave history (excluding the conflicting requests under analysis).
    """
    region = (employee.get("region") or "IN").upper()

    cursor = db.leave_requests.find({"employee_id": employee["_id"]})
    history = [
        doc for doc in await cursor.to_list(length=500)
        if doc["_id"] not in exclude_ids
    ]

    total = len(history)
    approved = sum(1 for d in history if d.get("status") == "approved")

    holiday_adjacent = 0
    months = Counter()
    types = Counter()
    durations = []

    for doc in history:
        try:
            start = CalendarService.to_date(doc["start_date"])
            end = CalendarService.to_date(doc["end_date"])
        except (KeyError, ValueError):
            continue
        months[start.month] += 1
        types[doc.get("leave_type", "annual")] += 1
        durations.append(doc.get("total_days") or doc.get("requested_days") or 1)
        if _is_holiday_adjacent(region, start, end):
            holiday_adjacent += 1

    acceptances = await db.reschedule_requests.count_documents(
        {"employee_id": employee["_id"], "status": "accepted"}
    )

    # Balances live in the leave_balances collection keyed by user/year
    # (docs shaped {balances: {vacation: {total, used, remaining}, ...}});
    # fall back to any flat leave_balances dict on the user doc.
    remaining = {}
    balance_doc = await db.leave_balances.find_one(
        {"user_id": employee["_id"], "year": date.today().year}
    )
    if balance_doc:
        for leave_type, entry in (balance_doc.get("balances") or {}).items():
            if isinstance(entry, dict) and isinstance(entry.get("remaining"), (int, float)):
                remaining[leave_type] = entry["remaining"]
    if not remaining:
        remaining = {
            k: v
            for k, v in (employee.get("leave_balances") or {}).items()
            if isinstance(v, (int, float))
        }

    return {
        "employee_id": str(employee["_id"]),
        "employee_name": employee.get("full_name") or employee.get("email"),
        "region": region,
        "total_requests": total,
        "approved_requests": approved,
        "holiday_adjacent_ratio": round(holiday_adjacent / total, 2) if total else 0.0,
        "preferred_months": [MONTH_NAMES[m - 1] for m, _ in months.most_common(3)],
        "preferred_leave_type": types.most_common(1)[0][0] if types else None,
        "average_duration_days": round(sum(durations) / len(durations), 1) if durations else 0.0,
        "remaining_balance": remaining,
        "past_reschedule_acceptances": acceptances,
    }


async def _candidate_windows(
    db,
    manager_id: ObjectId,
    region: str,
    working_days: int,
    not_before: date,
    conflict_ranges: List[tuple],
) -> List[dict]:
    """
    Build candidate alternative windows for one employee: up to
    MAX_HOLIDAY_CANDIDATES windows adjacent to upcoming named holidays,
    plus two generic windows (+1 week, +2 weeks after the conflict).
    Windows that clash with the conflict period or the team's already
    approved leaves are dropped.
    """
    horizon = not_before + timedelta(days=CANDIDATE_LOOKAHEAD_DAYS)

    # Approved team leaves inside the lookahead horizon, to avoid
    # recommending a window that creates a brand-new conflict.
    approved = await db.leave_requests.find(
        {
            "manager_id": manager_id,
            "status": {"$in": ["approved", "pending_hr"]},
            "start_date": {"$lte": _to_dt(horizon)},
            "end_date": {"$gte": _to_dt(not_before)},
        }
    ).to_list(length=200)
    blocked = conflict_ranges + [
        (CalendarService.to_date(d["start_date"]), CalendarService.to_date(d["end_date"]))
        for d in approved
    ]

    def clashes(s: date, e: date) -> bool:
        return any(s <= b_end and e >= b_start for b_start, b_end in blocked)

    candidates = []

    # Holiday-adjacent windows: start the first working day after each
    # upcoming holiday so the leave extends the holiday break.
    holidays = []
    for year in {not_before.year, horizon.year}:
        holidays.extend(CalendarService.get_holidays(region, year))
    upcoming = sorted(
        (
            (CalendarService.to_date(h["date"]), h.get("name", "Holiday"))
            for h in holidays
            if h.get("date") and not_before < CalendarService.to_date(h["date"]) <= horizon
        ),
    )

    for holiday_date, holiday_name in upcoming:
        if len(candidates) >= MAX_HOLIDAY_CANDIDATES:
            break
        win_start, win_end = _window_of_working_days(
            region, holiday_date + timedelta(days=1), working_days
        )
        if clashes(win_start, win_end):
            continue
        candidates.append({
            "start_date": _fmt(win_start),
            "end_date": _fmt(win_end),
            "holiday_context": f"{holiday_name} ({_fmt(holiday_date)})",
            "kind": "holiday_adjacent",
        })

    # Generic fallback windows one and two weeks after the conflict.
    for offset in (7, 14):
        win_start, win_end = _window_of_working_days(
            region, not_before + timedelta(days=offset), working_days
        )
        if clashes(win_start, win_end):
            continue
        if any(c["start_date"] == _fmt(win_start) for c in candidates):
            continue
        candidates.append({
            "start_date": _fmt(win_start),
            "end_date": _fmt(win_end),
            "holiday_context": None,
            "kind": "generic",
        })

    return candidates


# ===========================================================================
# LLM CALL (gpt-4o-mini) WITH DETERMINISTIC FALLBACK
# ===========================================================================


LLM_SYSTEM_PROMPT = """You are a leave-conflict resolution assistant inside an HR leave management system.
A manager has overlapping leave requests and can only keep some of them; the rest must be rescheduled.

You are given, for each employee: their pending conflicting request, a behavioural profile computed
deterministically from their leave history, and a list of pre-validated candidate alternative windows
(these windows are guaranteed conflict-free and have the same number of working days).

Pick EXACTLY the requested number of employees to reschedule and, for each, choose the best candidate
window for THAT employee based on their behaviour (e.g. an employee whose history shows they prefer
taking leave around public holidays should be moved to a holiday-adjacent window, and the holiday
should be named with its date in your reason). Prefer rescheduling employees whose profiles suggest
flexibility (high holiday affinity, larger remaining balance, past reschedule acceptances) and keeping
employees whose requests look less movable (e.g. sick leave, low balance).

Never invent dates: suggested_start_date and suggested_end_date MUST be copied from one of that
employee's candidate windows. Do not compute or alter any balance numbers.

Respond ONLY with JSON of this exact shape:
{"recommendations": [{"leave_request_id": "...", "suggested_start_date": "YYYY-MM-DD",
"suggested_end_date": "YYYY-MM-DD", "reason": "1-3 sentences addressed to the manager",
"insights": ["short bullet about the employee's pattern", "..."],
"holiday_context": "Holiday Name (YYYY-MM-DD)" or null, "confidence": "low|medium|high"}]}"""


async def _llm_recommend(payload: dict, num_to_reschedule: int) -> Optional[list]:
    """
    Ask the configured LLM for recommendations.
    Returns the parsed recommendation list, or None if the model is
    unavailable/misconfigured (caller falls back to heuristics).
    """
    if not settings.llm_api_key or settings.llm_api_key.startswith("replace-"):
        logger.info("LLM_API_KEY not configured — using heuristic recommender.")
        return None

    try:
        # The openai SDK is used as a generic client for any
        # OpenAI-compatible provider (Gemini, Groq, OpenAI, ...).
        # pyrefly: ignore [missing-import]
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url or None,
        )
        # No max_tokens cap: thinking models (e.g. Gemini 3.x flash) spend
        # output tokens on internal reasoning first, and a small cap gets
        # fully consumed before any visible JSON is produced.
        response = await client.chat.completions.create(
            model=settings.llm_model,
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": LLM_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Reschedule exactly {num_to_reschedule} employee(s).\n\n"
                        + json.dumps(payload, default=str)
                    ),
                },
            ],
        )
        content = (response.choices[0].message.content or "").strip()
        if content.startswith("```"):
            content = content.strip("`").removeprefix("json").strip()
        if not content:
            logger.warning(
                "LLM returned empty content (finish_reason=%s), falling back to heuristics.",
                response.choices[0].finish_reason,
            )
            return None
        parsed = json.loads(content)
        recommendations = parsed.get("recommendations")
        if isinstance(recommendations, list) and recommendations:
            return recommendations
        logger.warning("LLM returned no recommendations, falling back to heuristics.")
        return None

    except Exception as exc:
        logger.error("LLM recommendation call failed: %s", exc, exc_info=True)
        return None


def _heuristic_recommend(entries: List[dict], num_to_reschedule: int) -> list:
    """
    Deterministic fallback: rank employees by a flexibility score and
    pair each with their best-matching candidate window.
    """

    def flexibility(entry: dict) -> float:
        profile = entry["profile"]
        balance = profile.get("remaining_balance", {})
        score = profile.get("holiday_adjacent_ratio", 0) * 3.0
        score += (balance.get("vacation") or balance.get("annual") or 0) / 20.0
        score += profile.get("past_reschedule_acceptances", 0) * 0.5
        if entry["leave"].get("leave_type") == "sick":
            score -= 2.0  # sick leave should rarely be rescheduled
        return score

    ranked = sorted(entries, key=flexibility, reverse=True)
    results = []

    for entry in ranked[:num_to_reschedule]:
        profile = entry["profile"]
        candidates = entry["candidates"]
        if not candidates:
            continue

        prefers_holidays = profile.get("holiday_adjacent_ratio", 0) >= 0.3
        holiday_candidates = [c for c in candidates if c["kind"] == "holiday_adjacent"]
        chosen = (
            holiday_candidates[0]
            if prefers_holidays and holiday_candidates
            else candidates[0]
        )

        insights = []
        if profile.get("holiday_adjacent_ratio"):
            insights.append(
                f"{int(profile['holiday_adjacent_ratio'] * 100)}% of past leaves "
                f"were taken around public holidays"
            )
        if profile.get("preferred_months"):
            insights.append(
                "Usually takes leave in " + ", ".join(profile["preferred_months"][:2])
            )
        if profile.get("past_reschedule_acceptances"):
            insights.append(
                f"Accepted {profile['past_reschedule_acceptances']} reschedule(s) before"
            )

        if chosen.get("holiday_context") and prefers_holidays:
            reason = (
                f"{profile['employee_name']} tends to plan leave around public holidays, "
                f"so moving this leave next to {chosen['holiday_context']} keeps their "
                f"preferred long-break pattern while freeing up the conflicted period."
            )
        elif chosen.get("holiday_context"):
            reason = (
                f"{profile['employee_name']} has the most scheduling flexibility in this "
                f"group, and the suggested window sits right after {chosen['holiday_context']}, "
                f"turning the move into a longer break while freeing up the conflicted period."
            )
        else:
            reason = (
                f"{profile['employee_name']} has the most scheduling flexibility in this "
                f"group (remaining balance and past patterns), so shifting their leave "
                f"to the next conflict-free window has the lowest impact."
            )

        results.append({
            "leave_request_id": entry["leave_id"],
            "suggested_start_date": chosen["start_date"],
            "suggested_end_date": chosen["end_date"],
            "reason": reason,
            "insights": insights,
            "holiday_context": chosen.get("holiday_context"),
            "confidence": "medium",
        })

    return results


# ===========================================================================
# PUBLIC: CONFLICT ANALYSIS
# ===========================================================================


async def analyze_conflict(
    data: ConflictAnalyzeRequest,
    manager: dict,
) -> ConflictAnalyzeResponse:
    """
    Analyse overlapping leave requests and recommend which employee(s)
    to reschedule, with suggested alternative dates and reasons.
    """
    db = get_db()

    if data.num_to_reschedule >= len(data.leave_request_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Number to reschedule must be less than the number of selected requests.",
        )

    # -- Load and authorize the conflicting leave requests ------------------
    leaves = []
    for leave_id in data.leave_request_ids:
        if not ObjectId.is_valid(leave_id):
            raise HTTPException(status_code=400, detail=f"Invalid leave ID: {leave_id}")
        leave = await db.leave_requests.find_one({"_id": ObjectId(leave_id)})
        if leave is None:
            raise HTTPException(status_code=404, detail=f"Leave request not found: {leave_id}")
        if manager["role"] == "manager" and leave.get("manager_id") != manager["_id"]:
            raise HTTPException(
                status_code=403,
                detail="You can only analyse leave requests assigned to you.",
            )
        leaves.append(leave)

    conflict_ranges = [
        (CalendarService.to_date(l["start_date"]), CalendarService.to_date(l["end_date"]))
        for l in leaves
    ]
    overlap_start = max(r[0] for r in conflict_ranges)
    overlap_end = min(r[1] for r in conflict_ranges)
    not_before = max(max(r[1] for r in conflict_ranges), date.today())

    # -- Build per-employee profiles and candidate windows ------------------
    exclude_ids = {l["_id"] for l in leaves}
    entries = []
    for leave in leaves:
        employee = await db.users.find_one({"_id": leave["employee_id"]})
        if employee is None:
            continue
        profile = await _build_behavior_profile(db, employee, exclude_ids)
        candidates = await _candidate_windows(
            db,
            manager_id=leave.get("manager_id") or manager["_id"],
            region=profile["region"],
            working_days=leave.get("total_days") or leave.get("requested_days") or 1,
            not_before=not_before,
            conflict_ranges=conflict_ranges,
        )
        entries.append({
            "leave_id": str(leave["_id"]),
            "leave": leave,
            "employee": employee,
            "profile": profile,
            "candidates": candidates,
        })

    if len(entries) < 2:
        raise HTTPException(
            status_code=400,
            detail="Need at least two valid leave requests with known employees to analyse.",
        )

    # -- Ask the LLM (or fall back to heuristics) ---------------------------
    llm_payload = {
        "conflict_period": {"from": _fmt(overlap_start), "to": _fmt(overlap_end)},
        "manager_note": data.manager_note,
        "employees": [
            {
                "leave_request_id": e["leave_id"],
                "employee_name": e["profile"]["employee_name"],
                "pending_request": {
                    "leave_type": e["leave"].get("leave_type"),
                    "start_date": _fmt(e["leave"]["start_date"]),
                    "end_date": _fmt(e["leave"]["end_date"]),
                    "working_days": e["leave"].get("total_days"),
                    "reason": e["leave"].get("reason"),
                },
                "behavior_profile": {
                    k: v for k, v in e["profile"].items()
                    if k not in ("employee_id", "region")
                },
                "candidate_windows": e["candidates"],
            }
            for e in entries
        ],
    }

    raw = await _llm_recommend(llm_payload, data.num_to_reschedule)
    ai_generated = raw is not None
    if raw is None:
        raw = _heuristic_recommend(entries, data.num_to_reschedule)

    # -- Validate/enrich model output against known requests ----------------
    by_leave_id = {e["leave_id"]: e for e in entries}
    recommendations = []
    for item in raw:
        entry = by_leave_id.get(str(item.get("leave_request_id")))
        if entry is None:
            continue
        # Snap invented dates back to a real candidate window.
        valid_starts = {c["start_date"] for c in entry["candidates"]}
        if entry["candidates"] and item.get("suggested_start_date") not in valid_starts:
            fallback = entry["candidates"][0]
            item["suggested_start_date"] = fallback["start_date"]
            item["suggested_end_date"] = fallback["end_date"]
            item["holiday_context"] = fallback.get("holiday_context")

        recommendations.append(Recommendation(
            leave_request_id=entry["leave_id"],
            employee_id=entry["profile"]["employee_id"],
            employee_name=entry["profile"]["employee_name"],
            leave_type=entry["leave"].get("leave_type", "annual"),
            original_start_date=_fmt(entry["leave"]["start_date"]),
            original_end_date=_fmt(entry["leave"]["end_date"]),
            suggested_start_date=item.get("suggested_start_date"),
            suggested_end_date=item.get("suggested_end_date"),
            reason=item.get("reason") or "Recommended for rescheduling.",
            insights=item.get("insights") or [],
            holiday_context=item.get("holiday_context"),
            confidence=item.get("confidence") or "medium",
        ))
        if len(recommendations) >= data.num_to_reschedule:
            break

    if not recommendations:
        raise HTTPException(
            status_code=422,
            detail="Could not produce recommendations (no conflict-free alternative windows found).",
        )

    names = [e["profile"]["employee_name"] for e in entries]
    summary = (
        f"{len(entries)} overlapping requests ({', '.join(names)}) between "
        f"{_fmt(overlap_start)} and {_fmt(overlap_end)}; "
        f"{data.num_to_reschedule} employee(s) recommended for rescheduling."
    )

    return ConflictAnalyzeResponse(
        conflict_summary=summary,
        overlap_start=_fmt(overlap_start),
        overlap_end=_fmt(overlap_end),
        recommendations=recommendations,
        profiles={e["leave_id"]: e["profile"] for e in entries},
        ai_generated=ai_generated,
        model_used=settings.llm_model if ai_generated else "heuristic-fallback",
    )


# ===========================================================================
# PUBLIC: RESCHEDULE WORKFLOW
# ===========================================================================


def _reschedule_to_response(doc: dict) -> RescheduleResponse:
    return RescheduleResponse(
        id=str(doc["_id"]),
        leave_request_id=str(doc["leave_request_id"]),
        employee_id=str(doc["employee_id"]),
        employee_name=doc.get("employee_name"),
        manager_id=str(doc["manager_id"]),
        manager_name=doc.get("manager_name"),
        leave_type=doc.get("leave_type"),
        original_start_date=_fmt(doc["original_start_date"]),
        original_end_date=_fmt(doc["original_end_date"]),
        proposed_start_date=_fmt(doc["proposed_start_date"]),
        proposed_end_date=_fmt(doc["proposed_end_date"]),
        reason=doc.get("reason", ""),
        status=doc.get("status", "pending"),
        employee_message=doc.get("employee_message"),
        created_at=doc.get("created_at"),
        responded_at=doc.get("responded_at"),
    )


async def create_reschedule_request(
    data: RescheduleCreate,
    manager: dict,
) -> RescheduleResponse:
    """
    Manager sends a reschedule request for an employee's leave.
    The employee is notified and must accept or reject it.
    """
    db = get_db()

    if not ObjectId.is_valid(data.leave_request_id):
        raise HTTPException(status_code=400, detail="Invalid leave request ID.")

    leave = await db.leave_requests.find_one({"_id": ObjectId(data.leave_request_id)})
    if leave is None:
        raise HTTPException(status_code=404, detail="Leave request not found.")

    if manager["role"] == "manager" and leave.get("manager_id") != manager["_id"]:
        raise HTTPException(
            status_code=403,
            detail="You can only reschedule leave requests assigned to you.",
        )

    if leave.get("status") not in ("pending", "pending_hr", "approved"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reschedule a leave request with status '{leave.get('status')}'.",
        )

    try:
        proposed_start = CalendarService.to_date(data.proposed_start_date)
        proposed_end = CalendarService.to_date(data.proposed_end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Proposed dates must be YYYY-MM-DD.")

    if proposed_end < proposed_start:
        raise HTTPException(status_code=400, detail="Proposed end date is before start date.")

    existing = await db.reschedule_requests.find_one(
        {"leave_request_id": leave["_id"], "status": "pending"}
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A pending reschedule request already exists for this leave.",
        )

    employee = await db.users.find_one({"_id": leave["employee_id"]})
    employee_name = (
        (employee or {}).get("full_name") or (employee or {}).get("email") or "Employee"
    )

    now = datetime.now(timezone.utc)
    doc = {
        "leave_request_id": leave["_id"],
        "employee_id": leave["employee_id"],
        "employee_name": employee_name,
        "manager_id": manager["_id"],
        "manager_name": manager.get("full_name") or manager.get("email"),
        "leave_type": leave.get("leave_type"),
        "original_start_date": leave["start_date"],
        "original_end_date": leave["end_date"],
        "proposed_start_date": _to_dt(proposed_start),
        "proposed_end_date": _to_dt(proposed_end),
        "reason": data.reason,
        "status": "pending",
        "employee_message": None,
        "created_at": now,
        "responded_at": None,
    }

    result = await db.reschedule_requests.insert_one(doc)
    doc["_id"] = result.inserted_id

    await notification_service.notify_reschedule_requested(doc, manager)

    logger.info(
        "Reschedule request %s created by %s for leave %s.",
        result.inserted_id, manager.get("email"), leave["_id"],
    )

    return _reschedule_to_response(doc)


async def get_my_reschedules(user: dict) -> RescheduleListResponse:
    """Reschedule requests where the current user is the employee."""
    db = get_db()
    docs = await (
        db.reschedule_requests
        .find({"employee_id": user["_id"]})
        .sort("created_at", -1)
        .to_list(length=100)
    )
    items = [_reschedule_to_response(d) for d in docs]
    return RescheduleListResponse(items=items, total=len(items))


async def get_team_reschedules(manager: dict) -> RescheduleListResponse:
    """Reschedule requests sent by the current manager."""
    db = get_db()
    query = {} if manager["role"] in ("hr", "admin") else {"manager_id": manager["_id"]}
    docs = await (
        db.reschedule_requests
        .find(query)
        .sort("created_at", -1)
        .to_list(length=200)
    )
    items = [_reschedule_to_response(d) for d in docs]
    return RescheduleListResponse(items=items, total=len(items))


async def respond_to_reschedule(
    reschedule_id: str,
    data: RescheduleRespond,
    user: dict,
) -> RescheduleResponse:
    """
    Employee accepts or rejects a reschedule request.

    On accept, the original leave request is moved to the proposed dates
    (working days recomputed via the calendar engine) and continues
    through the normal approval flow. The manager is notified either way,
    including the employee's optional message.
    """
    db = get_db()

    if not ObjectId.is_valid(reschedule_id):
        raise HTTPException(status_code=400, detail="Invalid reschedule request ID.")

    doc = await db.reschedule_requests.find_one({"_id": ObjectId(reschedule_id)})
    if doc is None:
        raise HTTPException(status_code=404, detail="Reschedule request not found.")

    if doc.get("employee_id") != user["_id"]:
        raise HTTPException(
            status_code=403,
            detail="Only the employee this request was sent to can respond.",
        )

    if doc.get("status") != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"This reschedule request was already {doc.get('status')}.",
        )

    now = datetime.now(timezone.utc)
    accepted = data.action == "accept"
    new_status = "accepted" if accepted else "rejected"

    if accepted:
        leave = await db.leave_requests.find_one({"_id": doc["leave_request_id"]})
        if leave is None:
            raise HTTPException(status_code=404, detail="Original leave request no longer exists.")

        region = (user.get("region") or "IN").upper()
        new_start = CalendarService.to_date(doc["proposed_start_date"])
        new_end = CalendarService.to_date(doc["proposed_end_date"])
        working_days = CalendarService.count_leave_days(
            region=region,
            start_date=new_start,
            end_date=new_end,
            basis="WORKING_DAYS",
        )

        await db.leave_requests.update_one(
            {"_id": leave["_id"]},
            {
                "$set": {
                    "start_date": _to_dt(new_start),
                    "end_date": _to_dt(new_end),
                    "total_days": working_days,
                    "requested_days": working_days,
                    "updated_at": now,
                },
                "$push": {
                    "reschedule_history": {
                        "reschedule_id": doc["_id"],
                        "from_start": leave["start_date"],
                        "from_end": leave["end_date"],
                        "to_start": _to_dt(new_start),
                        "to_end": _to_dt(new_end),
                        "requested_by": doc["manager_id"],
                        "accepted_at": now,
                    }
                },
            },
        )

    await db.reschedule_requests.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "status": new_status,
                "employee_message": data.message,
                "responded_at": now,
            }
        },
    )

    doc["status"] = new_status
    doc["employee_message"] = data.message
    doc["responded_at"] = now

    await notification_service.notify_reschedule_responded(doc, user, accepted)

    logger.info(
        "Reschedule request %s %s by employee %s.",
        reschedule_id, new_status, user.get("email"),
    )

    return _reschedule_to_response(doc)
