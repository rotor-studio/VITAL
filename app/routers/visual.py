from fastapi import APIRouter
from sqlmodel import SQLModel, Session, select
from app.models import Response
from pathlib import Path
from functools import lru_cache
import csv

router = APIRouter(prefix="/api/visual", tags=["visual"])

ZIP_CSV = Path(__file__).resolve().parents[2] / "app" / "data" / "zipcode_pix.csv"
BASE_WIDTH = 1920
BASE_HEIGHT = 1080
CHARACTER_IMAGE_BASE = "/images/personajes"
CHARACTER_CARDS = {
    "simon_de_anda": {"label": "Simón de Anda", "image": "Simon de Anda R.jpg"},
    "manuel_iradier": {"label": "Manuel Iradier", "image": "Manuel Iradier R.jpg"},
    "mariano_diez_tobar": {"label": "Mariano Díez Tobar", "image": "Mariano Diez Tobar R.jpg"},
    "maria_sarmiento": {"label": "María Sarmiento", "image": "Maria Sarmiento R.jpg"},
    "ernestina_de_champourcin": {
        "label": "Ernestina de Champourcín",
        "image": "Ernestina de Champoucin R.jpg",
    },
    "pedro_lopez_de_ayala": {"label": "Pedro López de Ayala", "image": "Pedro Lopez de Ayala R.jpg"},
    "juan_perez_de_lazarraga": {
        "label": "Juan Pérez de Lazarraga",
        "image": "Juan Perez de Larrazaga R.jpg",
    },
    "micaela_portilla": {"label": "Micaela Portilla", "image": "Micaela Portilla R.jpg"},
    "ella_fitzgerald": {"label": "Ella Fitzgerald", "image": "Ella Fitzgerald R.jpg"},
    "jesus_guridi": {"label": "Jesús Guridi", "image": "Jesus Guridi R.jpg"},
    "maria_de_maeztu": {"label": "María de Maeztu", "image": "Maria de Maeztu R.jpg"},
    "naipera": {"label": "Naipera", "image": None},
}


@lru_cache(maxsize=1)
def _load_zip_mapping():
    """
    Returns {cp: {"codigo_postal": cp, "label": name, "x": avgX, "y": avgY}}
    """
    mapping = {}
    if not ZIP_CSV.exists():
        return mapping
    with ZIP_CSV.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            cp = (row.get("cod_postal") or "").strip()
            if not cp:
                continue
            if len(cp) == 4:
                cp = cp.zfill(5)
            entry = mapping.setdefault(
                cp,
                {
                    "codigo_postal": cp,
                    "label": row.get("denominacion_cp", cp),
                    "points": [],
                },
            )
            try:
                entry["points"].append(
                    (
                        float(row.get("x_px", 0.0)),
                        float(row.get("y_px", 0.0)),
                    )
                )
            except (TypeError, ValueError):
                continue
    for cp, entry in mapping.items():
        pts = entry.pop("points", [])
        if not pts:
            entry["x"] = entry["y"] = None
            continue
        entry["x"] = sum(p[0] for p in pts) / len(pts)
        entry["y"] = sum(p[1] for p in pts) / len(pts)
    return mapping


def _normalize_postal(cp: str) -> str:
    value = (cp or "").strip()
    if len(value) == 4:
        value = value.zfill(5)
    return value


@router.get("/points")
def postal_points(status: str = "approved"):
    """Return aggregated responses with pixel positions for each postal code."""
    mapping = _load_zip_mapping()
    with Session(SQLModel.engine) as session:
        rows = session.exec(
            select(Response).where(Response.status == status)
        ).all()
    buckets = {}
    character_counts = {}
    for row in rows:
        payload = row.payload_json or {}
        character = (payload.get("personaje_importante") or "").strip()
        if character:
            character_counts[character] = character_counts.get(character, 0) + 1
        postal_raw = payload.get("codigo_postal")
        if not postal_raw:
            continue
        postal = _normalize_postal(str(postal_raw))
        entry = mapping.get(postal)
        if not entry or entry.get("x") is None or entry.get("y") is None:
            continue
        bucket = buckets.setdefault(
            postal,
            {
                "codigo_postal": postal,
                "label": entry.get("label", postal),
                "x": entry.get("x"),
                "y": entry.get("y"),
                "count": 0,
                "genders": set(),
                "responses": [],
                "gender_counts": {},
            },
        )
        bucket["count"] += 1
        gender = str(payload.get("genero") or "").strip()
        if gender:
            bucket["genders"].add(gender)
            bucket["gender_counts"][gender] = bucket["gender_counts"].get(gender, 0) + 1
        bucket["responses"].append(
            {
                "id": row.id,
                "created_at": row.created_at.isoformat(timespec="seconds"),
                "payload": payload,
            }
        )
    # finalize genders as list
    points = []
    for data in buckets.values():
        data["genders"] = sorted(list(data["genders"]))
        points.append(data)
    characters = _format_character_cards(character_counts)
    return {
        "points": points,
        "characters": characters,
        "base_size": {"width": BASE_WIDTH, "height": BASE_HEIGHT},
    }


def _format_character_cards(counts: dict[str, int]):
    if not counts:
        return []
    total = sum(counts.values())
    sorted_counts = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    formatted = []
    for character_id, count in sorted_counts:
        meta = CHARACTER_CARDS.get(character_id, {})
        image_name = meta.get("image")
        entry = {
            "id": character_id,
            "label": meta.get("label", _prettify_character(character_id)),
            "count": count,
            "percentage": round((count / total) * 100, 1) if total else 0,
            "image": f"{CHARACTER_IMAGE_BASE}/{image_name}" if image_name else None,
        }
        formatted.append(entry)
    return formatted


def _prettify_character(value: str) -> str:
    if not value:
        return ""
    return value.replace("_", " ").title()
