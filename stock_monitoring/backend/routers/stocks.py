from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from backend.database import get_db, WatchedStock, PriceSnapshot
from backend.schemas import StockAdd, StockOut, StockPrice, PriceSnapshotOut, SearchResult
from backend.services.stock_service import get_stock_price, get_stock_history, search_symbols
from backend.services.alert_service import check_alerts

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


@router.get("/search", response_model=List[SearchResult])
def search(q: str = Query(..., min_length=1)):
    return search_symbols(q)


@router.get("", response_model=List[StockPrice])
def list_stocks(db: Session = Depends(get_db)):
    """Return all watchlisted stocks with live prices."""
    watched = db.query(WatchedStock).all()
    results = []
    for w in watched:
        data = get_stock_price(w.symbol)
        if data:
            # Store snapshot
            snap = PriceSnapshot(
                symbol=w.symbol,
                price=data["price"] or 0,
                volume=data.get("volume"),
                market_cap=data.get("market_cap"),
            )
            db.add(snap)

            # Check alerts
            check_alerts(db, w.symbol, data.get("price") or 0, data.get("previous_close"))

            results.append(StockPrice(**data))
        else:
            results.append(StockPrice(symbol=w.symbol, name=w.name))
    db.commit()
    return results


@router.post("", response_model=StockOut, status_code=201)
def add_stock(payload: StockAdd, db: Session = Depends(get_db)):
    symbol = payload.symbol.upper().strip()
    existing = db.query(WatchedStock).filter(WatchedStock.symbol == symbol).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"{symbol} is already in your watchlist.")

    # Validate the symbol exists
    data = get_stock_price(symbol)
    if not data or data.get("price") is None:
        raise HTTPException(status_code=404, detail=f"Could not find price data for '{symbol}'. Check the symbol and try again.")

    stock = WatchedStock(symbol=symbol, name=data.get("name"))
    db.add(stock)
    db.commit()
    db.refresh(stock)
    return stock


@router.delete("/{symbol}", status_code=204)
def remove_stock(symbol: str, db: Session = Depends(get_db)):
    symbol = symbol.upper()
    stock = db.query(WatchedStock).filter(WatchedStock.symbol == symbol).first()
    if not stock:
        raise HTTPException(status_code=404, detail=f"{symbol} not found in watchlist.")
    db.delete(stock)
    db.commit()


@router.get("/{symbol}/price", response_model=StockPrice)
def get_price(symbol: str):
    data = get_stock_price(symbol.upper())
    if not data:
        raise HTTPException(status_code=404, detail=f"Could not fetch data for {symbol}.")
    return StockPrice(**data)


@router.get("/{symbol}/history")
def get_history(
    symbol: str,
    period: str = Query("1mo", pattern="^(1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max)$"),
    interval: str = Query("1d", pattern="^(1m|2m|5m|15m|30m|60m|90m|1h|1d|5d|1wk|1mo|3mo)$"),
):
    data = get_stock_history(symbol.upper(), period=period, interval=interval)
    return {"symbol": symbol.upper(), "period": period, "interval": interval, "data": data}


@router.get("/{symbol}/snapshots", response_model=List[PriceSnapshotOut])
def get_snapshots(symbol: str, limit: int = Query(100, ge=1, le=1000), db: Session = Depends(get_db)):
    snaps = (
        db.query(PriceSnapshot)
        .filter(PriceSnapshot.symbol == symbol.upper())
        .order_by(PriceSnapshot.recorded_at.desc())
        .limit(limit)
        .all()
    )
    return snaps
