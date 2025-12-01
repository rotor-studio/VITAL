from fastapi import Depends
from app.deps import get_current_user
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlmodel import SQLModel, create_engine

from app.models import Survey, Response
from app.routers import responses, admin, visual

app = FastAPI(title="Encuesta Local")

# DB SQLite
engine = create_engine("sqlite:///./encuesta.db", echo=False)
SQLModel.metadata.create_all(engine)
SQLModel.engine = engine  # para usarlo en las rutas

# Rutas API
# Rutas API
app.include_router(responses.router)

app.include_router(admin.router, dependencies=[Depends(get_current_user)])
app.include_router(visual.router)

# Estáticos y plantillas
app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.mount("/images", StaticFiles(directory="app/images"), name="images")
app.mount("/data", StaticFiles(directory="app/data"), name="data")
templates = Jinja2Templates(directory="app/templates")

@app.get("/")
def survey_page(request: Request):
    return templates.TemplateResponse("survey.html", {"request": request})

@app.get("/visual")
def visual_page(request: Request):
    return templates.TemplateResponse("visual.html", {"request": request})

@app.get("/admin")
def admin_page(request: Request, user: str = Depends(get_current_user)):
    return templates.TemplateResponse("admin.html", {"request": request})

@app.get("/grid")
def grid_page(request: Request):
    return templates.TemplateResponse("grid.html", {"request": request})
