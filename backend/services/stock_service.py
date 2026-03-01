import yfinance as yf
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta


def get_stock_price(symbol: str) -> Optional[Dict[str, Any]]:
    """Fetch current price and key info for a single stock symbol."""
    try:
        ticker = yf.Ticker(symbol.upper())
        info = ticker.info

        price = (
            info.get("currentPrice")
            or info.get("regularMarketPrice")
            or info.get("ask")
            or info.get("bid")
        )

        if price is None:
            # Try fast_info as fallback
            fast = ticker.fast_info
            price = getattr(fast, "last_price", None)

        previous_close = info.get("previousClose") or info.get("regularMarketPreviousClose")
        change = None
        change_pct = None
        if price is not None and previous_close is not None and previous_close != 0:
            change = round(price - previous_close, 4)
            change_pct = round((change / previous_close) * 100, 4)

        return {
            "symbol": symbol.upper(),
            "name": info.get("longName") or info.get("shortName") or symbol.upper(),
            "price": price,
            "previous_close": previous_close,
            "change": change,
            "change_pct": change_pct,
            "volume": info.get("regularMarketVolume") or info.get("volume"),
            "market_cap": info.get("marketCap"),
            "day_high": info.get("dayHigh") or info.get("regularMarketDayHigh"),
            "day_low": info.get("dayLow") or info.get("regularMarketDayLow"),
            "week_52_high": info.get("fiftyTwoWeekHigh"),
            "week_52_low": info.get("fiftyTwoWeekLow"),
            "currency": info.get("currency", "USD"),
        }
    except Exception as e:
        print(f"Error fetching price for {symbol}: {e}")
        return None


def get_stock_history(symbol: str, period: str = "1mo", interval: str = "1d") -> List[Dict[str, Any]]:
    """Fetch OHLCV historical data for charting."""
    try:
        ticker = yf.Ticker(symbol.upper())
        hist = ticker.history(period=period, interval=interval)
        if hist.empty:
            return []

        records = []
        for ts, row in hist.iterrows():
            records.append({
                "timestamp": ts.isoformat(),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row["Volume"]) if row["Volume"] else 0,
            })
        return records
    except Exception as e:
        print(f"Error fetching history for {symbol}: {e}")
        return []


def search_symbols(query: str) -> List[Dict[str, Any]]:
    """Search for tickers using yfinance's search functionality."""
    try:
        results = yf.Search(query, max_results=10)
        quotes = results.quotes if hasattr(results, "quotes") else []
        out = []
        for q in quotes:
            out.append({
                "symbol": q.get("symbol", ""),
                "name": q.get("longname") or q.get("shortname") or q.get("symbol", ""),
                "exchange": q.get("exchange", ""),
                "type": q.get("quoteType", ""),
            })
        return out
    except Exception as e:
        print(f"Error searching '{query}': {e}")
        return []


def get_multi_prices(symbols: List[str]) -> Dict[str, Optional[Dict[str, Any]]]:
    """Bulk-fetch current prices for a list of symbols."""
    if not symbols:
        return {}
    results = {}
    for symbol in symbols:
        results[symbol] = get_stock_price(symbol)
    return results
