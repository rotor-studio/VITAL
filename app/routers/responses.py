from fastapi import APIRouter
from typing import Dict
from sqlmodel import SQLModel, Session, create_engine, select
from app.models import Response

router = APIRouter(prefix="/api", tags=["responses"])

@router.post("/responses")
def create_response(data: Dict):
    # data: {"survey_id": 1, "payload": {...}}
    engine = SQLModel.engine
    with Session(engine) as s:
        r = Response(survey_id=data["survey_id"], payload_json=data["payload"], status="pending")
        s.add(r)
        s.commit()
        s.refresh(r)
        return {"id": r.id, "survey_id": r.survey_id, "payload": r.payload_json, "status": r.status}

@router.get("/responses")
def list_responses(status: str = "approved"):
    engine = SQLModel.engine
    with Session(engine) as s:
        rows = s.exec(select(Response).where(Response.status == status).order_by(Response.created_at.desc()).limit(200)).all()
        return [{"id": r.id, "survey_id": r.survey_id, "payload": r.payload_json, "status": r.status} for r in rows]

