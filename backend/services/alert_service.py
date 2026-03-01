from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Any, Optional

from backend.database import Alert


def check_alerts(db: Session, symbol: str, current_price: float, previous_close: Optional[float]) -> List[Dict[str, Any]]:
    """
    Evaluate active, non-triggered alerts for a symbol.
    Returns a list of alerts that fired.
    """
    if current_price is None:
        return []

    active_alerts = (
        db.query(Alert)
        .filter(Alert.symbol == symbol.upper(), Alert.active == True, Alert.triggered == False)
        .all()
    )

    fired = []
    for alert in active_alerts:
        triggered = False

        if alert.alert_type == "above" and current_price >= alert.threshold:
            triggered = True
        elif alert.alert_type == "below" and current_price <= alert.threshold:
            triggered = True
        elif alert.alert_type == "pct_change" and previous_close and previous_close != 0:
            pct = abs((current_price - previous_close) / previous_close * 100)
            if pct >= abs(alert.threshold):
                triggered = True

        if triggered:
            alert.triggered = True
            alert.triggered_at = datetime.utcnow()
            db.add(alert)
            fired.append({
                "id": alert.id,
                "symbol": alert.symbol,
                "alert_type": alert.alert_type,
                "threshold": alert.threshold,
                "current_price": current_price,
                "message": alert.message or _default_message(alert, current_price),
                "triggered_at": alert.triggered_at.isoformat(),
            })

    if fired:
        db.commit()

    return fired


def _default_message(alert: Alert, current_price: float) -> str:
    if alert.alert_type == "above":
        return f"{alert.symbol} crossed above {alert.threshold:.2f} (now {current_price:.2f})"
    elif alert.alert_type == "below":
        return f"{alert.symbol} dropped below {alert.threshold:.2f} (now {current_price:.2f})"
    elif alert.alert_type == "pct_change":
        return f"{alert.symbol} moved ±{alert.threshold:.1f}% from previous close (now {current_price:.2f})"
    return f"Alert triggered for {alert.symbol}"
