from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers.visits import router as visits_router
from .routers.absences import router as absences_router

app = FastAPI(title="Visits Dashboard API", version="1.0.0", docs_url="/api/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(visits_router)
app.include_router(absences_router)
