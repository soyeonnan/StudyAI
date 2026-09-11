# 백엔드 이미지 (FastAPI + uvicorn)
FROM python:3.12-slim

# 파이썬 로그 버퍼링 비활성화, pyc 생성 방지
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# 의존성 먼저 설치해 레이어 캐시를 활용한다.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
