from fastapi import APIRouter, Response as FastResponse
from sqlmodel import SQLModel, Session, select, delete
from app.models import Response
import csv, io, json
from datetime import datetime, timezone
from pathlib import Path
from functools import lru_cache

BASE_PATH = Path(__file__).resolve().parents[2]
QUESTIONS_PATH = BASE_PATH / "app" / "static" / "questions.json"

router = APIRouter(prefix="/api/admin", tags=["admin"])

def _normalize_value(val):
    if val is None:
        return ""
    if isinstance(val, list):
        return "; ".join(str(v) for v in val)
    if isinstance(val, dict):
        return json.dumps(val, ensure_ascii=False)
    return val

@lru_cache(maxsize=1)
def _field_info():
    """Devuelve (orden, labels) basado en el archivo de preguntas."""
    order = []
    labels = {}
    try:
        data = json.loads(QUESTIONS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return order, labels
    steps_by_lang = data.get("steps") or {}
    preferred_lang = None
    for lang in ("es", "eu", "en"):
        if lang in steps_by_lang:
            preferred_lang = lang
            break
    if not preferred_lang and steps_by_lang:
        preferred_lang = next(iter(steps_by_lang.keys()))
    steps = steps_by_lang.get(preferred_lang, [])

    def register(field_id, label):
        if not field_id:
            return
        if field_id not in order:
            order.append(field_id)
        if label and field_id not in labels:
            labels[field_id] = label

    for step in steps:
        if step.get("type") == "form":
            for sub in step.get("fields", []):
                register(sub.get("id"), sub.get("label"))
        else:
            register(step.get("id"), step.get("label"))
        comment = step.get("comment_field")
        if comment:
            register(comment.get("id"), comment.get("label"))
    register("__lang", "Idioma / Language")
    return order, labels

@router.get("/pending")
def pending():
    with Session(SQLModel.engine) as s:
        rows = s.exec(select(Response).where(Response.status == "pending").order_by(Response.created_at.asc())).all()
        return [
            {
                "id": r.id,
                "payload": r.payload_json,
                "created_at": r.created_at.isoformat(timespec="seconds"),
                "survey_id": r.survey_id,
            }
            for r in rows
        ]

@router.get("/fields")
def fields():
    order, labels = _field_info()
    return {"order": order, "labels": labels}

@router.get("/counts")
def counts():
    with Session(SQLModel.engine) as s:
        total = s.exec(select(Response)).all()
        approved = [r for r in total if r.status == "approved"]
        pending = [r for r in total if r.status == "pending"]
        rejected = [r for r in total if r.status == "rejected"]
        last_approved_at = None
        if approved:
            last_approved_at = max(a.created_at for a in approved).replace(tzinfo=timezone.utc).isoformat()
        return {
            "total": len(total),
            "approved": len(approved),
            "pending": len(pending),
            "rejected": len(rejected),
            "last_approved_at": last_approved_at
        }

@router.patch("/moderate/{response_id}")
def moderate(response_id: int, action: str):
    new_status = "approved" if action == "approve" else "rejected"
    with Session(SQLModel.engine) as s:
        r = s.get(Response, response_id)
        if not r:
            return {"ok": False}
        r.status = new_status
        s.add(r)
        s.commit()
    return {"ok": True}

@router.delete("/reset")
def reset():
    """Borra TODAS las respuestas (no elimina tablas)."""
    with Session(SQLModel.engine) as s:
        s.exec(delete(Response))
        s.commit()
    return {"ok": True, "cleared": True}

@router.get("/export.csv")
def export_csv():
    """Exporta respuestas aprobadas a CSV."""
    with Session(SQLModel.engine) as s:
        rows = s.exec(select(Response).where(Response.status == "approved").order_by(Response.created_at.asc())).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    base_cols = ["id", "survey_id", "status", "created_at"]
    order, _labels = _field_info()
    extra_keys = []
    existing = set(order)
    for r in rows:
        payload = r.payload_json or {}
        for key in payload.keys():
            if key not in existing and key not in extra_keys:
                extra_keys.append(key)
    header = base_cols + order + extra_keys
    writer.writerow(header)
    for r in rows:
        p = r.payload_json or {}
        row = [
            r.id,
            r.survey_id,
            r.status,
            r.created_at.isoformat(timespec="seconds"),
        ]
        for key in order + extra_keys:
            row.append(_normalize_value(p.get(key, "")))
        writer.writerow(row)
    data = buf.getvalue()
    return FastResponse(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="respuestas_aprobadas.csv"'}
    )
