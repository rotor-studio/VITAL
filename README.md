# Encuesta y visualización

Repositorio del proyecto FastAPI que gestiona la encuesta multilingüe y sus herramientas de moderación y visualización.

## Estructura principal

- `app/main.py` – Configura FastAPI, monta estáticos e incluye routers.
- `app/routers/` – Endpoints de respuestas, administración y visualización.
- `app/static/` – JS/CSS para el cuestionario, panel admin y el mapa radial.
- `app/templates/` – Plantillas HTML para /, /admin y /visual.
- `app/images/personajes/` – Retratos utilizados en la pila lateral de personajes.
- `encuesta.db` – Base SQLite (ignorada en Git) con las respuestas.

## Puesta en marcha

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt  # o pip install fastapi uvicorn sqlmodel
uvicorn app.main:app --reload
```

- `/` carga la encuesta (3 idiomas, lógica condicional).
- `/admin` muestra las respuestas aprobadas (requiere auth básica del archivo `app/deps.py`).
- `/visual` renderiza el mapa con puntos por código postal y el stack animado de personajes.

## Visualización de personajes

El endpoint `/api/visual/points` agrega las menciones a `personaje_importante`, adjunta rutas de imagen y porcentajes, y el frontend (`visual_map.js`) dibuja un mazo de cartas que se pliega/despliega automáticamente cuando llegan nuevos datos.

## Exportaciones y moderación

El panel de administración dispone de tarjetas por respuesta y permite exportar CSV con todas las columnas dinámicas según los campos definidos en `app/static/questions.json`.
