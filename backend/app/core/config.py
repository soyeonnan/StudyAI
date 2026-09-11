"""애플리케이션 설정. 모든 값은 환경변수(.env)에서 읽어오며 하드코딩하지 않는다."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # 앱 기본
    app_name: str = "Study Calendar API"
    api_prefix: str = "/api"

    # 보안: SECRET_KEY는 반드시 환경변수로 주입한다 (기본값 없음).
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 1일

    # DB: 기본은 SQLite. 운영에서는 PostgreSQL URL을 환경변수로 주입한다.
    database_url: str = "sqlite:///./study_calendar.db"

    # CORS: 허용 오리진 (쉼표로 구분된 문자열)
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
