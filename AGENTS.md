# Repository Guidelines

## Project Structure & Module Organization
- `app/main.py`: FastAPI entrypoint; mounts static assets, templates and includes routers.
- `app/routers/`: API endpoints (`responses`, `admin`, `visual`).
- `app/templates/`: Jinja templates (`survey`, `admin`, `visual`, `grid`).
- `app/static/`: JS/CSS, questions JSON, images, sounds (`mapa_referencia.png`, blip sounds).
- `app/data/`: CSV for zip pixel mapping and audio files.
- `scripts/run_server.sh`: Convenience script to activate conda env `server` and run uvicorn.

## Build, Test, and Development Commands
- Create env: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt` (or install FastAPI/uvicorn/sqlmodel/aiofiles/jinja2/python-multipart).
- Run dev server: `./scripts/run_server.sh` (expects conda env `server`) or `uvicorn app.main:app --reload`.
- No automated test suite; rely on manual QA of endpoints: `/`, `/admin`, `/visual`, `/grid`.

## Coding Style & Naming Conventions
- Python: 4-space indent, type hints where convenient, keep handlers small. Follow FastAPI patterns; prefer dependency injection over globals.
- JS/CSS: Keep selectors scoped to template, avoid inline styles; prefer descriptive const names. Maintain existing pixel-art aesthetic in `/grid`.
- Templates: Use Jinja2; keep logic minimal, offload to static JS where possible.
- Naming: snake_case for Python, kebab-case for static assets, lowercase paths.

## Testing & QA Guidelines
- Manual checks:
  - `/` survey loads in three languages; conditional questions work.
  - `/admin` lists approved/pending, CSV export includes dynamic fields.
  - `/visual` renders map, toggles background with `M`.
  - `/grid` shows grid, points, sounds (blip on new points, blip2 on bubbles), timeline rotates comments.
- If adding tests, place under `tests/` with pytest-style names (`test_*.py`); prefer fixture-based HTTP calls via `TestClient`.

## Commit & Pull Request Guidelines
- Use concise, imperative commit messages (e.g., “Add timeline bubble rotation”, “Fix visual zip fallback”).
- One logical change per commit; update `WORK_LOG.md` when altering features/flows.
- PRs: include purpose, key changes, manual test notes, and screenshots/GIFs for UI changes (`/visual`, `/grid`), noting language selector behavior when relevant.

## Security & Configuration Tips
- Basic auth for `/admin` is configured in `app/deps.py`; avoid logging credentials.
- SQLite `encuesta.db` is local; do not commit it. Ensure new assets go in `app/static` or `app/data` as appropriate.***
