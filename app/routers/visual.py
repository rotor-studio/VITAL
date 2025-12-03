from fastapi import APIRouter
from sqlmodel import SQLModel, Session, select
from app.models import Response
from pathlib import Path
from functools import lru_cache
import csv
from datetime import datetime
import json

router = APIRouter(prefix="/api/visual", tags=["visual"])

ZIP_CSV = Path(__file__).resolve().parents[2] / "app" / "data" / "zipcode_pix.csv"
BASE_WIDTH = 1920
BASE_HEIGHT = 1080
BASE_CENTER = (BASE_WIDTH / 2, BASE_HEIGHT / 2)
ALAVA_COORD = (42.8467, -2.6720)
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

COMMENT_FIELDS = {
    "comentarios",
    "comentario",
    "comentarios_generales",
    "comentario_exposicion",
    "contenido_interesante_comentario",
    "personaje_atencion_comentario",
    "aprendizaje_alava",
    "algo_en_falta",
    "asociaciones_alava",
    "orgullo_alava",
    "sentirse_alaves",
    "visitas_expos_comentario",
    "temas_futuros",
    "actividades_centro",
    "conoces_vital_comentario",
}

QUESTIONS_PATH = Path(__file__).resolve().parents[2] / "app" / "static" / "questions.json"


@lru_cache(maxsize=1)
def _asociaciones_labels_by_lang():
    mapping = {}
    try:
        data = json.loads(QUESTIONS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return mapping
    steps_by_lang = data.get("steps") or {}
    for lang, steps in steps_by_lang.items():
        for step in steps:
            if step.get("id") != "asociaciones_alava":
                continue
            opts = step.get("options") or []
            mapping[lang] = {opt.get("value"): opt.get("label") for opt in opts if opt.get("value")}
    return mapping


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

# Aproximación de centroides provinciales (lat, lon) para códigos fuera de Álava.
PROVINCE_CENTROIDS = {
    "01": (42.8467, -2.6720),  # Álava
    "02": (38.9833, -1.85),    # Albacete
    "03": (38.3452, -0.4810),  # Alicante
    "04": (36.8340, -2.4637),  # Almería
    "05": (40.6566, -4.6810),  # Ávila
    "06": (38.8786, -6.9703),  # Badajoz
    "07": (39.6953, 3.0176),   # Baleares (Palma)
    "08": (41.3874, 2.1686),   # Barcelona
    "09": (42.3439, -3.6969),  # Burgos
    "10": (39.4753, -6.3710),  # Cáceres
    "11": (36.5164, -6.2994),  # Cádiz
    "12": (39.9864, -0.0513),  # Castellón
    "13": (38.9849, -3.9291),  # Ciudad Real
    "14": (37.8847, -4.7792),  # Córdoba
    "15": (43.3623, -8.4115),  # A Coruña
    "16": (40.0704, -2.1374),  # Cuenca
    "17": (41.9794, 2.8214),   # Girona
    "18": (37.1773, -3.5986),  # Granada
    "19": (40.6333, -3.1667),  # Guadalajara
    "20": (43.3183, -1.9812),  # Gipuzkoa
    "21": (37.2614, -6.9447),  # Huelva
    "22": (42.1361, -0.4089),  # Huesca
    "23": (37.7796, -3.7849),  # Jaén
    "24": (42.5987, -5.5671),  # León
    "25": (41.6176, 0.6200),   # Lleida
    "26": (42.4627, -2.4440),  # La Rioja
    "27": (43.0097, -7.5560),  # Lugo
    "28": (40.4168, -3.7038),  # Madrid
    "29": (36.7213, -4.4214),  # Málaga
    "30": (37.9922, -1.1307),  # Murcia
    "31": (42.8196, -1.6440),  # Navarra
    "32": (42.3383, -7.8639),  # Ourense
    "33": (43.3619, -5.8494),  # Asturias
    "34": (42.0097, -4.5288),  # Palencia
    "35": (28.0997, -15.4134), # Las Palmas
    "36": (42.4333, -8.6444),  # Pontevedra
    "37": (40.9701, -5.6635),  # Salamanca
    "38": (28.4682, -16.2546), # Santa Cruz de Tenerife
    "39": (43.4623, -3.8099),  # Cantabria
    "40": (40.9429, -4.1088),  # Segovia
    "41": (37.3891, -5.9845),  # Sevilla
    "42": (41.7660, -2.4790),  # Soria
    "43": (41.1189, 1.2445),   # Tarragona
    "44": (40.3440, -1.1069),  # Teruel
    "45": (39.8628, -4.0273),  # Toledo
    "46": (39.4699, -0.3763),  # Valencia
    "47": (41.6523, -4.7286),  # Valladolid
    "48": (43.2630, -2.9350),  # Bizkaia
    "49": (41.5033, -5.7440),  # Zamora
    "50": (41.6488, -0.8891),  # Zaragoza
    "51": (35.8894, -5.3213),  # Ceuta
    "52": (35.2923, -2.9381),  # Melilla
}

def _bearing_and_distance_km(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, atan2, sqrt
    R = 6371.0
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi/2)**2 + cos(phi1)*cos(phi2)*sin(dlambda/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    distance = R * c
    y = sin(dlambda) * cos(phi2)
    x = cos(phi1)*sin(phi2) - sin(phi1)*cos(phi2)*cos(dlambda)
    bearing = atan2(y, x)
    return bearing, distance

def _fallback_external_position(cp: str):
    """Return a pseudo-position on the edge pointing toward the origin province."""
    if not cp:
        return None
    prefix = cp[:2]
    coords = PROVINCE_CENTROIDS.get(prefix)
    if not coords:
        return None
    bearing, dist_km = _bearing_and_distance_km(ALAVA_COORD[0], ALAVA_COORD[1], coords[0], coords[1])
    # Escala la distancia para empujar más hacia el borde (0.4 a 0.95 del radio)
    from math import cos, sin
    radius_base = min(BASE_WIDTH, BASE_HEIGHT) / 2
    dist_norm = min(dist_km / 900, 1.0)  # 900 km ~ empuja a borde
    # Empuja un poco más lejos de la masa central (más de la mitad del radio)
    radius = radius_base * (0.55 + 0.6 * dist_norm)
    cx, cy = BASE_CENTER
    x = cx + radius * sin(bearing)  # x aumenta hacia el este
    y = cy - radius * cos(bearing)  # y aumenta hacia el sur en pantalla
    # Mantener dentro de los límites de la imagen
    x = max(0, min(BASE_WIDTH, x))
    y = max(0, min(BASE_HEIGHT, y))
    return x, y


@router.get("/points")
def postal_points(status: str = "approved"):
    """Return aggregated responses with pixel positions for each postal code.

    - status="approved" (por defecto): solo aprobadas.
    - status="pending": solo pendientes.
    - status="all": aprobadas + pendientes (comentarios de pendientes se ocultan).
    """
    mapping = _load_zip_mapping()
    with Session(SQLModel.engine) as session:
        if status == "all":
            rows = session.exec(select(Response).where(Response.status.in_(["approved", "pending"]))).all()
        else:
            rows = session.exec(select(Response).where(Response.status == status)).all()
    labels_by_lang = _asociaciones_labels_by_lang()
    buckets = {}
    character_counts = {}
    for row in rows:
        payload_raw = row.payload_json or {}
        payload = payload_raw
        if row.status == "pending":
            payload = {k: v for k, v in payload_raw.items() if k not in COMMENT_FIELDS}
        if not payload.get("asociaciones_alava_labels") and payload_raw.get("asociaciones_alava"):
            lang = payload_raw.get("__lang")
            labels_map = labels_by_lang.get(lang) or {}
            raw_vals = payload_raw.get("asociaciones_alava")
            vals_list = raw_vals if isinstance(raw_vals, list) else [raw_vals]
            payload["asociaciones_alava_labels"] = [
                labels_map.get(v, v) for v in vals_list if isinstance(v, str)
            ]
        character = (payload.get("personaje_importante") or "").strip()
        if character:
            character_counts[character] = character_counts.get(character, 0) + 1
        postal_raw = payload.get("codigo_postal")
        if not postal_raw:
            continue
        postal = _normalize_postal(str(postal_raw))
        entry = mapping.get(postal)
        if not entry or entry.get("x") is None or entry.get("y") is None:
            fallback_xy = _fallback_external_position(postal)
            if not fallback_xy:
                continue
            entry = {
                "codigo_postal": postal,
                "label": f"CP {postal}",
                "x": fallback_xy[0],
                "y": fallback_xy[1],
                "external": True,
            }
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
                "external": bool(entry.get("external")),
                "latest_at": None,
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
                "status": row.status,
                "payload": payload,
            }
        )
        # track la fecha más reciente del bucket
        if not bucket["latest_at"] or row.created_at > bucket["latest_at"]:
            bucket["latest_at"] = row.created_at
    # finalize genders as list
    points = []
    for data in buckets.values():
        data["genders"] = sorted(list(data["genders"]))
        if isinstance(data.get("latest_at"), datetime):
            data["latest_at"] = data["latest_at"].isoformat()
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
