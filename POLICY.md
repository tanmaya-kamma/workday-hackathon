# Dynamic PTO and Leave Management System

## Master Business Policy — MVP

**Version:** 1.0  
**Status:** Active  
**Purpose:** Hackathon MVP  
**Leave Year:** January 1 – December 31

---

# 1. Policy Philosophy

The Dynamic PTO and Leave Management System shall use a **policy-driven and deterministic leave calculation engine**.

The system must not hardcode leave entitlement, accrual rates, carry-forward limits, or balance limits inside business logic.

Instead:

- Leave policies are stored as configurable data.
- The Accrual Engine reads the applicable policy.
- Employee attributes are evaluated against the policy.
- Accrual is calculated as of a specific date.
- Every balance-changing event is recorded in an immutable accrual ledger.
- The same inputs must always produce the same calculation result.
- AI may explain results but must not independently determine leave balances.

---

# 2. Leave Year

The leave year is:

**January 1 to December 31.**

All annual entitlements, accruals, carry-forward calculations, and expiry calculations are evaluated within the applicable leave year.

The Accrual Engine must support an `as_of_date`.

This means the system must be capable of answering:

> "How much leave had this employee earned as of this date?"

The engine must never include accruals that occur after the requested `as_of_date`.

---

# 3. Supported Leave Types

The MVP supports three leave types:

1. Vacation / PTO
2. Sick Leave
3. Personal Leave

Each leave type is represented as an independent Leave Plan.

Each Leave Plan can have its own:

- Annual entitlement
- Accrual frequency
- Accrual method
- Proration method
- Carry-forward rule
- Maximum balance
- Rounding rule
- Negative-balance rule

---

# 4. Vacation / PTO Policy

## 4.1 Annual Entitlement

Vacation entitlement depends on employee tenure.

| Employee Tenure              | Annual Entitlement |
| ---------------------------- | -----------------: |
| Less than 1 year             |            12 days |
| 1 year to less than 3 years  |            18 days |
| 3 years to less than 5 years |            24 days |
| 5 years or more              |            30 days |

Tenure is calculated using the employee's joining date.

---

## 4.2 Tenure Tier Effective Date

A change in entitlement due to tenure occurs on the employee's **work anniversary**.

Example:

Employee joining date:

`15 July 2023`

The employee reaches 3 years of service on:

`15 July 2026`

The new entitlement becomes effective from:

`15 July 2026`

The system must not retroactively recalculate all previous accruals using the new entitlement.

Accrual before the effective date uses the previous applicable entitlement.

Accrual after the effective date uses the new applicable entitlement.

---

# 5. Vacation Accrual Frequency

Vacation leave accrues monthly.

The standard accrual date is:

**The first day of each calendar month.**

Monthly accrual is calculated as:

```text
Monthly Accrual
=
Annual Entitlement / 12
```
