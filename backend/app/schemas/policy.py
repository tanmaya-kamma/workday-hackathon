from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class TenureRule(BaseModel):
    min_years: float = Field(ge=0)
    max_years: Optional[float] = Field(default=None, gt=0)
    annual_entitlement: float = Field(gt=0)


class AccrualConfig(BaseModel):
    frequency: str
    method: str


class ProrationConfig(BaseModel):
    enabled: bool
    method: str


class CarryForwardConfig(BaseModel):
    enabled: bool
    limit: float = Field(default=0, ge=0)
    expiry: Optional[str] = None


class BalanceConfig(BaseModel):
    maximum: Optional[float] = Field(default=None, ge=0)
    allow_negative: bool = False
    negative_balance_limit: Optional[float] = None


class RoundingConfig(BaseModel):
    unit: float = 0.5
    method: str = "NEAREST"


class PolicyCreate(BaseModel):
    policy_id: str
    leave_type: str

    effective_from: date
    effective_to: Optional[date] = None

    accrual: AccrualConfig

    tenure_rules: list[TenureRule] = Field(
        default_factory=list
    )

    annual_entitlement: Optional[float] = Field(
        default=None,
        gt=0
    )

    proration: ProrationConfig

    carry_forward: CarryForwardConfig

    balance: BalanceConfig

    rounding: RoundingConfig


class PolicyResponse(PolicyCreate):
    id: Optional[str] = None