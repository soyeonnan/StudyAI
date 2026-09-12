"""모든 라우터를 하나의 APIRouter로 묶는다."""
from fastapi import APIRouter

from app.api.routes import admin, analytics, auth, goals, routines, schedules, sessions, subjects

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(subjects.router)
api_router.include_router(sessions.router)
api_router.include_router(schedules.router)
api_router.include_router(routines.router)
api_router.include_router(goals.router)
api_router.include_router(analytics.router)
api_router.include_router(admin.router)
