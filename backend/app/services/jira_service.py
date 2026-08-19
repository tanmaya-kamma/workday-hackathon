"""
Jira workload and leave-impact analysis service.

Jira remains the source of truth for issues.  This module only reads Jira
Cloud data, normalizes it, and compares it with an HCM leave period.
"""

import asyncio
import base64
import json
import os
import re
from datetime import date
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


JIRA_PROJECT_KEY = "KAN"
DEFAULT_JIRA_URL = "https://meiyappansworkspace-43655612.atlassian.net/jira/software/projects/KAN/list?jql=project%20%3D%20KAN%20ORDER%20BY%20cf%5B10019%5D%20ASC"
ACTIVE_STATUS_NAMES = {
    "in progress",
    "in review",
    "to do",
    "selected for development",
    "testing",
    "blocked",
}
HIGH_PRIORITIES = {"highest", "high"}
DEPLOYMENT_TERMS = (
    "deployment",
    "release",
    "production",
    "hotfix",
    "go-live",
    "go live",
    "launch",
    "migration",
)


# ---------------------------------------------------------------------------
# Jira configuration and authentication
# ---------------------------------------------------------------------------

def _env_value(name: str) -> str:
    """Read a setting from process environment or the ignored backend/.env file."""
    if value := os.getenv(name):
        return value.strip()

    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.is_file():
        return ""
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() == name:
            return value.strip().strip("\"'")
    return ""


def _config() -> tuple[str, str, str, str]:
    """Return validated Jira settings without ever returning them to clients."""
    base_url = _env_value("JIRA_BASE_URL").rstrip("/")
    project_key = _env_value("JIRA_PROJECT_KEY") or JIRA_PROJECT_KEY
    email = _env_value("JIRA_EMAIL")
    api_token = _env_value("JIRA_API_TOKEN")
    if not all((base_url, project_key, email, api_token)):
        raise JiraConfigurationError(
            "Jira is not configured. Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN."
        )
    return base_url, project_key, email, api_token


class JiraError(Exception):
    """A safe Jira integration failure that can be shown as availability metadata."""


class JiraConfigurationError(JiraError):
    """Jira configuration is missing or incomplete."""


def _request_json(path: str, query: dict[str, Any] | None = None) -> Any:
    """Make one authenticated Jira GET request; intended to run in a worker thread."""
    base_url, _, email, api_token = _config()
    url = f"{base_url}{path}"
    if query:
        url = f"{url}?{urlencode(query, doseq=True)}"
    credentials = base64.b64encode(f"{email}:{api_token}".encode()).decode()
    request = Request(
        url,
        headers={"Accept": "application/json", "Authorization": f"Basic {credentials}"},
        method="GET",
    )
    try:
        with urlopen(request, timeout=15) as response:
            if response.status != 200:
                raise JiraError(f"Jira returned HTTP {response.status}.")
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise JiraError(f"Jira returned HTTP {exc.code}.") from exc
    except URLError as exc:
        raise JiraError("Could not reach Jira.") from exc
    except json.JSONDecodeError as exc:
        raise JiraError("Jira returned an invalid response.") from exc


async def test_jira_connection() -> dict[str, Any]:
    """Phase 1: verify Jira credentials and connectivity."""
    try:
        profile = await asyncio.to_thread(_request_json, "/rest/api/3/myself")
        return {"jira_available": True, "account_id": profile.get("accountId")}
    except JiraError as exc:
        return {"jira_available": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Jira issue retrieval and employee matching
# ---------------------------------------------------------------------------

async def get_project_issues() -> list[dict[str, Any]]:
    """Phase 2: retrieve current issues from the configured Jira project."""
    _, project_key, _, _ = _config()
    jql = f'project = "{project_key}" ORDER BY updated DESC'
    try:
        payload = await asyncio.to_thread(
            _request_json,
            "/rest/api/3/search/jql",
            {"jql": jql, "maxResults": 100, "fields": "*all", "expand": "names"},
        )
    except JiraError as modern_error:
        # Older Jira Cloud tenants may still expose the prior search endpoint.
        try:
            payload = await asyncio.to_thread(
                _request_json,
                "/rest/api/3/search",
                {"jql": jql, "maxResults": 100, "fields": "*all", "expand": "names"},
            )
        except JiraError:
            raise modern_error
    field_names = payload.get("names", {})
    issues = payload.get("issues", [])
    # Jira returns custom-field labels once at the response level. Preserve them
    # with each raw issue so sprint/epic extraction works without shared state.
    for issue in issues:
        if isinstance(issue, dict):
            issue["_jira_field_names"] = field_names
    return issues


def _normalized_name(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]", "", (value or "").casefold())


def _employee_jira_id(employee: dict[str, Any]) -> str | None:
    """Use an explicit HCM-to-Jira account mapping before any name-based matching."""
    direct_keys = ("jira_account_id", "jiraAccountId")
    for key in direct_keys:
        if employee.get(key):
            return str(employee[key])
    integration = employee.get("jira") or employee.get("jira_mapping") or {}
    if isinstance(integration, dict):
        for key in ("account_id", "accountId", "jira_account_id"):
            if integration.get(key):
                return str(integration[key])
    return None


async def _find_jira_user(employee: dict[str, Any], project_key: str) -> dict[str, Any] | None:
    """Resolve email, then exact normalized name; never use fuzzy name matching."""
    explicit_id = _employee_jira_id(employee)
    if explicit_id:
        return {"accountId": explicit_id}

    candidates: list[dict[str, Any]] = []
    for query in (employee.get("email"), employee.get("full_name") or employee.get("name")):
        if not query:
            continue
        try:
            results = await asyncio.to_thread(
                _request_json,
                "/rest/api/3/user/assignable/search",
                {"project": project_key, "query": str(query), "maxResults": 50},
            )
        except JiraError:
            continue
        if isinstance(results, list):
            candidates.extend(item for item in results if isinstance(item, dict))

    unique = {candidate.get("accountId"): candidate for candidate in candidates if candidate.get("accountId")}
    email = (employee.get("email") or "").casefold()
    email_matches = [user for user in unique.values() if (user.get("emailAddress") or "").casefold() == email]
    if len(email_matches) == 1:
        return email_matches[0]

    name = _normalized_name(employee.get("full_name") or employee.get("name"))
    name_matches = [user for user in unique.values() if _normalized_name(user.get("displayName")) == name]
    return name_matches[0] if len(name_matches) == 1 else None


def _employee_list_url(base_url: str, project_key: str, account_id: str, manager_account_id: str | None = None) -> str:
    """Build the Jira List view URL shown in the KAN project, scoped to assignee and optionally reporter."""
    if manager_account_id:
        jql = f'project = "{project_key}" AND assignee = "{account_id}" AND reporter = "{manager_account_id}" ORDER BY cf[10019] ASC'
    else:
        jql = f'project = "{project_key}" AND assignee = "{account_id}" ORDER BY cf[10019] ASC'
    return (
        f"{base_url}/jira/software/projects/{quote(project_key, safe='-')}/list"
        f"?jql={quote(jql, safe='')}"
    )


def _employee_list_url_by_email(base_url: str, project_key: str, employee_email: str, manager_email: str | None = None) -> str:
    """Build the Jira List view URL shown in the KAN project, scoped to assignee email and optionally reporter email."""
    if manager_email:
        jql = f'project = "{project_key}" AND assignee = "{employee_email}" AND reporter = "{manager_email}" ORDER BY cf[10019] ASC'
    else:
        jql = f'project = "{project_key}" AND assignee = "{employee_email}" ORDER BY cf[10019] ASC'
    return (
        f"{base_url}/jira/software/projects/{quote(project_key, safe='-')}/list"
        f"?jql={quote(jql, safe='')}"
    )


async def get_employee_jira_list_link(employee: dict[str, Any], manager: dict[str, Any] | None = None) -> dict[str, Any]:
    """Resolve one HCM employee and return their KAN Jira List-view URL."""
    try:
        base_url, project_key, _, _ = _config()
        emp_name = employee.get("full_name") or employee.get("name")

        jira_user = await _find_jira_user(employee, project_key)
        if jira_user and jira_user.get("accountId"):
            account_id = jira_user["accountId"]
            return {
                "jira_available": True,
                "jira_match": True,
                "employee": {"name": emp_name, "jira_account_id": account_id},
                "jira_list_url": _employee_list_url(base_url, project_key, account_id),
            }

        emp_email = employee.get("email")
        if emp_email:
            return {
                "jira_available": True,
                "jira_match": False,
                "employee": {"name": emp_name, "email": emp_email},
                "jira_list_url": _employee_list_url_by_email(base_url, project_key, emp_email),
                "message": "Could not resolve Jira account; using email-based URL as fallback.",
            }

        return {
            "jira_available": True,
            "jira_match": False,
            "employee": {"name": emp_name},
            "jira_list_url": DEFAULT_JIRA_URL,
            "message": "Could not match employee to a Jira account.",
        }
    except Exception as exc:
        return {
            "jira_available": False,
            "jira_match": False,
            "jira_list_url": DEFAULT_JIRA_URL,
            "message": str(exc),
        }


# ---------------------------------------------------------------------------
# Jira normalization, sprint analysis, and leave-period analysis
# ---------------------------------------------------------------------------

def _as_date(value: Any) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _sprint_data(fields: dict[str, Any], names: dict[str, str]) -> tuple[str | None, date | None, date | None]:
    """Extract sprint values from modern objects and legacy Jira sprint strings."""
    for field_id, value in fields.items():
        label = names.get(field_id, "").casefold()
        if "sprint" not in label and not field_id.casefold().endswith("sprint"):
            continue
        item = value[-1] if isinstance(value, list) and value else value
        if isinstance(item, dict):
            return item.get("name"), _as_date(item.get("startDate")), _as_date(item.get("endDate"))
        if isinstance(item, str):
            name = re.search(r"name=([^,\]]+)", item)
            start = re.search(r"startDate=([^,\]]+)", item)
            end = re.search(r"endDate=([^,\]]+)", item)
            return (
                name.group(1) if name else item,
                _as_date(start.group(1)) if start else None,
                _as_date(end.group(1)) if end else None,
            )
    return None, None, None


def _epic_or_parent(fields: dict[str, Any], names: dict[str, str]) -> str | None:
    parent = fields.get("parent")
    if isinstance(parent, dict):
        parent_summary = (parent.get("fields") or {}).get("summary")
        return parent_summary or parent.get("key")
    for field_id, value in fields.items():
        label = names.get(field_id, "").casefold()
        if "epic" in label and value:
            return value.get("name") if isinstance(value, dict) else str(value)
    return None


def _normalize_issue(issue: dict[str, Any], names: dict[str, str], base_url: str) -> dict[str, Any]:
    fields = issue.get("fields") or {}
    assignee = fields.get("assignee") or {}
    reporter = fields.get("reporter") or {}
    status_value = fields.get("status") or {}
    priority = fields.get("priority") or {}
    issue_type = fields.get("issuetype") or {}
    sprint, sprint_start, sprint_end = _sprint_data(fields, names)
    summary = fields.get("summary") or ""
    searchable_text = " ".join(
        str(value or "")
        for value in (summary, issue_type.get("name"), _epic_or_parent(fields, names), fields.get("labels"))
    ).casefold()
    key = issue.get("key") or ""
    return {
        "key": key,
        "summary": summary,
        "assignee": assignee.get("displayName") or assignee.get("emailAddress") or assignee.get("accountId"),
        "assignee_account_id": assignee.get("accountId"),
        "assignee_email": assignee.get("emailAddress") or "",
        "reporter": reporter.get("displayName") or reporter.get("emailAddress") or reporter.get("accountId"),
        "reporter_account_id": reporter.get("accountId"),
        "reporter_email": reporter.get("emailAddress") or "",
        "priority": priority.get("name"),
        "status": status_value.get("name"),
        "status_category": (status_value.get("statusCategory") or {}).get("key"),
        "issue_type": issue_type.get("name"),
        "due_date": fields.get("duedate") or None,
        "sprint": sprint,
        "sprint_start": sprint_start.isoformat() if sprint_start else None,
        "sprint_end": sprint_end.isoformat() if sprint_end else None,
        "epic": _epic_or_parent(fields, names),
        "deployment_related": any(term in searchable_text for term in DEPLOYMENT_TERMS),
        "jira_url": f"{base_url}/browse/{quote(key, safe='-')}",
    }


def _analyze_issue(issue: dict[str, Any], leave_start: date, leave_end: date) -> dict[str, Any]:
    due_date = _as_date(issue.get("due_date"))
    sprint_start = _as_date(issue.get("sprint_start"))
    sprint_end = _as_date(issue.get("sprint_end"))
    deadline_conflict = bool(due_date and leave_start <= due_date <= leave_end)
    sprint_conflict = bool(sprint_start and sprint_end and sprint_start <= leave_end and leave_start <= sprint_end)
    status_name = (issue.get("status") or "").casefold()
    active = issue.get("status_category") != "done" and status_name not in {"done", "closed", "resolved", "cancelled"}
    high_priority = (issue.get("priority") or "").casefold() in HIGH_PRIORITIES
    deployment_conflict = active and bool(issue["deployment_related"])
    high_priority_conflict = active and high_priority
    leave_impact = deadline_conflict or sprint_conflict or high_priority_conflict or deployment_conflict
    reasons: list[str] = []
    if active:
        reasons.append(f"Currently {issue.get('status') or 'active'}")
    if deadline_conflict:
        reasons.append("Due date falls during leave")
    if sprint_conflict:
        reasons.append("Sprint overlaps requested leave")
    if high_priority_conflict:
        reasons.append("High-priority active task")
    if deployment_conflict:
        reasons.append("Deployment-related active task")
    impact_level = "high" if leave_impact and (deadline_conflict and (high_priority or deployment_conflict) or sprint_conflict and (high_priority or deployment_conflict)) else "medium" if leave_impact else "low"
    return {
        **issue,
        "deadline_conflict": deadline_conflict,
        "sprint_conflict": sprint_conflict,
        "active": active,
        "impact_level": impact_level,
        "reasons": reasons,
        "leave_impact": leave_impact,
    }


# ---------------------------------------------------------------------------
# Leave request integration entry point
# ---------------------------------------------------------------------------

async def analyze_leave_impact(employee: dict[str, Any], leave_start: date, leave_end: date, manager: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return the safe, normalized Jira workload view for one leave request.

    Failures deliberately return ``jira_available: false`` so the leave request
    remains usable when Jira is unavailable or an employee cannot be matched.
    """
    if leave_start > leave_end:
        raise ValueError("leave_start must be on or before leave_end")
    try:
        base_url, project_key, _, _ = _config()
        
        emp_email = employee.get("email")
        mgr_email = manager.get("email") if manager else None

        raw_issues = await get_project_issues()
        normalized = [
            _normalize_issue(raw, raw.get("_jira_field_names") or {}, base_url)
            for raw in raw_issues
        ]

        assigned = []
        is_matched = False
        list_url = DEFAULT_JIRA_URL

        # Try email matching first, then fall back to accountId matching.
        # Jira Cloud often hides emails in issue data (privacy settings),
        # so email matching against issue fields may yield nothing even
        # when the employee email is known.
        if emp_email:
            emp_lower = emp_email.strip().lower()
            for issue in normalized:
                issue_assignee = (issue.get("assignee_email") or "").strip().lower()
                if issue_assignee and issue_assignee == emp_lower:
                    assigned.append(issue)
            if assigned:
                is_matched = True
                list_url = _employee_list_url_by_email(base_url, project_key, emp_email, mgr_email)

        # Fall back to accountId matching via user search API
        if not assigned:
            jira_user = await _find_jira_user(employee, project_key)
            if jira_user and jira_user.get("accountId"):
                account_id = jira_user["accountId"]
                for issue in normalized:
                    if issue.get("assignee_account_id") == account_id:
                        assigned.append(issue)
                is_matched = True
                list_url = _employee_list_url(base_url, project_key, account_id)

        analyzed = [_analyze_issue(issue, leave_start, leave_end) for issue in assigned]
        impact = [issue for issue in analyzed if issue["leave_impact"]]
        active = [issue for issue in analyzed if issue["active"]]

        return {
            "jira_available": True,
            "jira_match": is_matched,
            "employee": {
                "name": employee.get("full_name") or employee.get("name"),
                "email": emp_email,
            },
            "summary": {
                "total_assigned": len(analyzed),
                "active": len(active),
                "leave_impact": len(impact),
                "other_active_work": len([issue for issue in active if not issue["leave_impact"]]),
            },
            "issues": analyzed,
            "leave_impact_issues": impact,
            "other_active_issues": [issue for issue in active if not issue["leave_impact"]],
            "jira_list_url": list_url,
        }
    except Exception as exc:
        return {
            "jira_available": False,
            "jira_match": False,
            "summary": {"total_assigned": 0, "active": 0, "leave_impact": 0},
            "issues": [],
            "jira_list_url": DEFAULT_JIRA_URL,
            "message": str(exc),
        }
