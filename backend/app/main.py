"""FastAPI 애플리케이션 진입점."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.api.routes import api_router
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine

# 모델 메타데이터 등록을 위해 반드시 import 한다.
import app.models  # noqa: F401

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 개발 편의를 위한 테이블 자동 생성. 운영에서는 마이그레이션 도구로 대체한다.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)

# Prometheus 계측: 요청 수·지연시간 등을 수집하고 /metrics 로 노출한다.
Instrumentator().instrument(app).expose(app, endpoint="/metrics", tags=["monitoring"])


# 루트(/health)는 컨테이너 헬스체크용, /api/health는 프론트 프록시 경유 확인용.
@app.get("/health", tags=["health"])
@app.get(f"{settings.api_prefix}/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
