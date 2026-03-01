from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class StockAdd(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=10)


class StockOut(BaseModel):
    id: int
    symbol: str
    name: Optional[str]
    added_at: datetime

    class Config:
        from_attributes = True


class StockPrice(BaseModel):
    symbol: str
    name: Optional[str]
    price: Optional[float]
    previous_close: Optional[float]
    change: Optional[float]
    change_pct: Optional[float]
    volume: Optional[float]
    market_cap: Optional[float]
    day_high: Optional[float]
    day_low: Optional[float]
    week_52_high: Optional[float]
    week_52_low: Optional[float]
    currency: Optional[str]


class PriceSnapshotOut(BaseModel):
    price: float
    volume: Optional[float]
    recorded_at: datetime

    class Config:
        from_attributes = True


class AlertCreate(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=10)
    alert_type: str = Field(..., pattern="^(above|below|pct_change)$")
    threshold: float
    message: Optional[str] = None


class AlertOut(BaseModel):
    id: int
    symbol: str
    alert_type: str
    threshold: float
    message: Optional[str]
    active: bool
    triggered: bool
    triggered_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class SearchResult(BaseModel):
    symbol: str
    name: str
    exchange: Optional[str]
    type: Optional[str]
