from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db, Alert
from backend.schemas import AlertCreate, AlertOut

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=List[AlertOut])
def list_alerts(
    symbol: str = Query(None),
    active_only: bool = Query(False),
    triggered_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    q = db.query(Alert)
    if symbol:
        q = q.filter(Alert.symbol == symbol.upper())
    if active_only:
        q = q.filter(Alert.active == True, Alert.triggered == False)
    if triggered_only:
        q = q.filter(Alert.triggered == True)
    return q.order_by(Alert.created_at.desc()).all()


@router.post("", response_model=AlertOut, status_code=201)
def create_alert(payload: AlertCreate, db: Session = Depends(get_db)):
    alert = Alert(
        symbol=payload.symbol.upper(),
        alert_type=payload.alert_type,
        threshold=payload.threshold,
        message=payload.message,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.delete("/{alert_id}", status_code=204)
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    db.delete(alert)
    db.commit()


@router.patch("/{alert_id}/reset", response_model=AlertOut)
def reset_alert(alert_id: int, db: Session = Depends(get_db)):
    """Re-arm a triggered alert so it can fire again."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    alert.triggered = False
    alert.triggered_at = None
    db.commit()
    db.refresh(alert)
    return alert
