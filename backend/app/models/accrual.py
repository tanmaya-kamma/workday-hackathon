from datetime import date
from typing import Any


ACCRUAL_TRANSACTION_TYPES = {
    "accrual",
    "carry_forward",
    "usage",
    "adjustment",
    "expiry",
}


def create_accrual_transaction(
    transaction_date: date,
    transaction_type: str,
    amount: float,
    description: str,
) -> dict[str, Any]:
    """
    Create a single accrual ledger transaction.

    Positive amounts:
        accrual
        carry_forward
        adjustment

    Negative amounts:
        usage
        expiry
    """

    if transaction_type not in ACCRUAL_TRANSACTION_TYPES:
        raise ValueError(
            f"Invalid accrual transaction type: {transaction_type}"
        )

    return {
        "date": transaction_date,
        "type": transaction_type,
        "amount": amount,
        "description": description,
    }


def create_accrual_document(
    employee_id: str,
    leave_type: str,
    year: int,
) -> dict[str, Any]:
    """
    Create the initial MongoDB accrual document.
    """

    return {
        "employee_id": employee_id,
        "leave_type": leave_type,
        "year": year,
        "transactions": [],
        "earned": 0.0,
        "carry_forward": 0.0,
        "used": 0.0,
        "adjustments": 0.0,
        "expired": 0.0,
        "balance": 0.0,
    }