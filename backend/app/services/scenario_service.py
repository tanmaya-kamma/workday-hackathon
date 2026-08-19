from calendar import monthrange
from datetime import date, timedelta
from collections import defaultdict

from app.services.accrual_service import AccrualService
from app.services.calendar_service import CalendarService


LEAVE_TYPE_MAP = {
    "annual": "vacation",
    "casual": "personal",
    "vacation": "vacation",
    "sick": "sick",
    "personal": "personal",
}


class ScenarioService:

    @staticmethod
    def simulate_balance(employee_id: str, hypothetical_leaves: list) -> dict:
        today = date.today()

        employee = AccrualService.get_employee(employee_id)
        if employee is None:
            raise ValueError(f"Employee {employee_id} not found.")

        region = employee.get("region", "IN")

        current = AccrualService.calculate_employee_balance(
            employee_id=employee_id,
            as_of_date=today,
        )
        current_balances = current["balances"]

        hypo_days = defaultdict(float)
        hypo_details = []

        for leave in hypothetical_leaves:
            raw_type = leave.leave_type if isinstance(leave, object) and hasattr(leave, "leave_type") else leave["leave_type"]
            start = leave.start_date if hasattr(leave, "start_date") else leave["start_date"]
            end = leave.end_date if hasattr(leave, "end_date") else leave["end_date"]

            engine_type = LEAVE_TYPE_MAP.get(raw_type.lower(), raw_type.lower())

            working_days = CalendarService.count_leave_days(
                region=region,
                start_date=start,
                end_date=end,
                basis="WORKING_DAYS",
            )

            holidays_in_range = []
            all_holidays = CalendarService.get_holidays(region, start.year)
            for h in all_holidays:
                h_date = CalendarService.to_date(h["date"])
                if start <= h_date <= end:
                    holidays_in_range.append({
                        "date": h_date.isoformat(),
                        "name": h.get("name", "Holiday"),
                    })

            calendar_days = (end - start).days + 1

            weekend_dates = []
            d = start
            while d <= end:
                if CalendarService.is_weekend(region=region, target_date=d):
                    weekend_dates.append(d.isoformat())
                d += timedelta(days=1)

            hypo_days[engine_type] += working_days

            hypo_details.append({
                "leave_type": engine_type,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "working_days_charged": working_days,
                "calendar_days": calendar_days,
                "weekends_excluded": len(weekend_dates),
                "weekend_dates": weekend_dates,
                "holidays_in_range": holidays_in_range,
            })

        projected = {}
        for lt in ["vacation", "sick", "personal"]:
            bal = current_balances.get(lt, {})
            current_usable = bal.get("usable", 0.0)
            hyp = hypo_days.get(lt, 0.0)
            proj_remaining = current_usable - hyp
            projected[lt] = {
                "current_usable": current_usable,
                "hypothetical_days": hyp,
                "projected_remaining": round(proj_remaining, 2),
                "sufficient": proj_remaining >= 0,
            }

        monthly_projection = ScenarioService._build_monthly_projection(
            employee_id=employee_id,
            hypothetical_leaves=hypo_details,
            current_month=today.month,
            current_year=today.year,
            region=region,
        )

        return {
            "employee_id": current["employee_id"],
            "full_name": current.get("full_name"),
            "region": region,
            "current_balances": current_balances,
            "hypothetical_leaves": hypo_details,
            "projected_balances": projected,
            "monthly_projection": monthly_projection,
        }

    @staticmethod
    def _build_monthly_projection(
        employee_id: str,
        hypothetical_leaves: list,
        current_month: int,
        current_year: int,
        region: str = "IN",
    ) -> list:
        month_names = [
            "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ]

        projection = []

        for month in range(current_month, 13):
            last_day = date(
                current_year, month,
                monthrange(current_year, month)[1],
            )

            try:
                bal = AccrualService.calculate_employee_balance(
                    employee_id=employee_id,
                    as_of_date=last_day,
                )
            except Exception:
                continue

            balances = bal["balances"]

            hypo_by_type = defaultdict(float)
            for h in hypothetical_leaves:
                h_start = date.fromisoformat(h["start_date"])
                h_end = date.fromisoformat(h["end_date"])
                if h_start > last_day:
                    continue
                clamped_end = min(h_end, last_day)
                if clamped_end >= h_end:
                    hypo_by_type[h["leave_type"]] += h["working_days_charged"]
                else:
                    # Leave is mid-flight at month end: charge only the working
                    # days that have elapsed so far.
                    hypo_by_type[h["leave_type"]] += CalendarService.count_leave_days(
                        region=region,
                        start_date=h_start,
                        end_date=clamped_end,
                        basis="WORKING_DAYS",
                    )

            entry = {
                "month": f"{current_year}-{month:02d}",
                "label": month_names[month],
            }

            for lt in ["vacation", "sick", "personal"]:
                usable = balances.get(lt, {}).get("usable", 0.0)
                hyp = hypo_by_type.get(lt, 0.0)
                entry[lt] = round(usable - hyp, 2)
                entry[f"{lt}_baseline"] = round(usable, 2)

            projection.append(entry)

        return projection
