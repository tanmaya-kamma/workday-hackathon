from datetime import date
from pydantic import BaseModel, Field


class AccrualCalculationRequest(BaseModel):
    employee_id: str
    leave_type: str
    as_of_date: date


class AccrualTransactionResponse(BaseModel):
    date: date
    type: str
    amount: float
    description: str


class AccrualCalculationResponse(BaseModel):
    employee_id: str
    leave_type: str
    as_of_date: date

    annual_entitlement: float
    accrual_method: str
    accrual_rate: float
    completed_periods: int

    earned: float
    carry_forward: float
    used: float
    adjustments: float
    expired: float

    available_balance: float

    explanation: str

    transactions: list[AccrualTransactionResponse] = Field(
        default_factory=list
    )


class BalanceResponse(BaseModel):
    employee_id: str
    leave_type: str
    balance: float