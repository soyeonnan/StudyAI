# StudyAI — 공부 캘린더

공부 타이머, 일정 관리, 공부 루틴/기록, 학습 분석 대시보드를 한곳에서 다루는 개인용 풀스택 웹 애플리케이션입니다.
관측성(모니터링) 스택과 관리자 학습 가이드까지 포함해, 실무에 가까운 구성을 목표로 만들었습니다.

## 주요 기능

- **대시보드(index)** — 오늘(Today)과 이번 달(This Month)의 학습 현황을 요약. 공부 시간·평균 집중도·루틴/일정 진행률·일별 공부량 그래프·과목별 비중을 실제 데이터로 집계해 보여줍니다.
- **공부 타이머** — 시작 / 일시정지(휴식) / 재개 / 중지로 공부·휴식 시간을 자동 측정하고, 과목·집중도(5단계)·메모와 함께 기록으로 저장합니다.
- **일정 캘린더** — 개별 일정과 루틴을 탭으로 분리 관리. 일정마다 색상을 지정하고 달력에 개수만큼 표시하며, 완료한 루틴은 진행 막대로 보여줍니다. 개별+루틴 통합 완료율도 표시합니다.
- **공부 캘린더** — 루틴 탭과 기록 탭으로 분리. 달력 칸에 날짜별 루틴 진행률을 색상 막대로 표시합니다.
  - *공부 루틴*: 미리 짜두는 반복 할 일. **시간 독립 버전 관리**로, 루틴을 수정해도 과거 날짜가 본 루틴은 바뀌지 않습니다. 공부 캘린더 루틴과 일정 캘린더 루틴은 분리됩니다.
  - *공부 기록*: 타이머 기록을 보여주고, 직접 추가·수정·삭제할 수 있습니다.
- **공부 목표 & 로드맵** — 간단 시간목표(예: "○○ 3시간")와 단계형 목표(로드맵)를 만들고 진도를 추적합니다. 목표 수정·완료 처리가 가능합니다.
- **오늘 플래너** — 가용 시간을 입력하면 마감·중요도·진도를 규칙 기반으로 계산해 오늘 할 일을 추천합니다. 목표가 없어도 과목만으로 추천받을 수 있습니다. ([규칙 문서](docs/플래너-추천-규칙.md))
- **달성률** — 기간별(주 단위) 공부/루틴 추이와 목표 달성 요약. 시간형 목표를 우선 표시하고 중요도를 배지로 보여줍니다.
- **커뮤니티** — 공부 인증글/좋아요/댓글. 닉네임을 쓸 수 있고 비속어 필터로 악플을 막습니다.
- **과목 계층** — **무제한 depth**(대분류 > 중분류 > 소분류 > ...). 타이머·루틴·목표가 동일한 과목 소스를 사용합니다. 카테고리 카드를 눌러 하위를 펼치는 트리 UI로 관리합니다.
- **진행률 표시** — 완료 비율을 숫자와 색상(진행도별)으로 표현합니다.
- **수정/삭제 확인** — 되돌리기 어려운 동작은 확인 다이얼로그를 거칩니다.
- **관리자 학습 가이드** — 관리자(role=admin)만 접근하는 프론트/백/클라우드/정보보안 학습 가이드. 정보보안은 교육·방어 중심입니다.
- **모니터링** — Prometheus + Loki + Promtail + Grafana 스택(선택 실행).
- **JWT 인증** — 회원가입/로그인으로 개인 데이터를 보호합니다.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 프론트엔드 | React, Vite, React Router, Axios |
| 백엔드 | FastAPI, SQLAlchemy 2.0, python-jose(JWT), bcrypt |
| 데이터베이스 | PostgreSQL (개발 시 SQLite로도 동작) |
| 인프라 | Docker, docker-compose, Nginx |
| 모니터링 | Prometheus, Grafana, Loki, Promtail |

## 프로젝트 구조

전체 디렉토리 설명은 [docs/디렉토리-구조.md](docs/디렉토리-구조.md)에 정리되어 있습니다.

```
study-calendar/
├── backend/            # FastAPI 백엔드
├── frontend/           # React 프론트엔드
├── monitoring/         # Prometheus/Loki/Promtail/Grafana 설정
├── docs/               # 학습·설계 문서
├── docker-compose.yml              # 앱(3-tier)
├── docker-compose.monitoring.yml   # 모니터링 스택(선택)
└── .env.example
```

## 실행 방법

### 1) Docker로 한 번에 실행 (권장)

```bash
cp .env.example .env
# SECRET_KEY, POSTGRES_PASSWORD 등을 채운다.
# SECRET_KEY 생성:
python -c "import secrets; print(secrets.token_urlsafe(64))"

docker compose up --build
```

- 프론트엔드: http://localhost:8080

### 2) 로컬 개발 실행

**백엔드**
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows PowerShell
pip install -r requirements.txt
# backend/.env 에 SECRET_KEY, DATABASE_URL 설정 후
uvicorn app.main:app --reload
```

**프론트엔드**
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173, /api는 8000으로 프록시
```

### 3) 모니터링 스택 함께 실행 (선택)

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up --build
```

- Grafana: http://localhost:3000 (`.env`의 GRAFANA_ADMIN_PASSWORD 필요)

### 관리자 계정 만들기

```bash
cd backend
python -m scripts.make_admin your@email.com
```

자세한 사용법은 [docs/사용-가이드.md](docs/사용-가이드.md)를 참고하세요.

## 문서

- [사용 가이드](docs/사용-가이드.md)
- [서버 실행 가이드](docs/서버-실행-가이드.md) — 로컬/Docker 실행 방법
- [API 문서](docs/API-문서.md)
- [DB 설계 문서](docs/DB-설계.md) — 테이블 명세, 루틴 시간 독립 버전 관리
- [플래너 추천 규칙](docs/플래너-추천-규칙.md)
- [개선 제안](docs/개선-제안.md) — 향후 업그레이드/조정 포인트
- [디렉토리 구조](docs/디렉토리-구조.md)

## 핵심 설계: 루틴 시간 독립성

이 프로젝트의 가장 특징적인 설계는 **루틴의 시간 독립성**입니다.
"오늘 루틴을 바꿔도 지난주 기록은 그대로여야 한다"를 만족시키기 위해,
루틴을 **정의(RoutineDefinition)** 와 **버전(RoutineVersion, effective_from~effective_to)** 으로 분리했습니다.
각 날짜는 "그 시점에 유효했던 버전"을 조회하므로 과거·현재·미래가 독립적입니다.
자세한 내용은 [DB 설계 문서](docs/DB-설계.md)에 있습니다.

## 보안 설계

- **비밀값 하드코딩 없음** — `SECRET_KEY`, DB 접속 정보 등은 환경변수로만 주입. `SECRET_KEY`는 기본값이 없어 미설정 시 앱이 시작되지 않습니다.
- **비밀번호 해싱** — bcrypt 단방향 해싱.
- **인가** — 모든 데이터 API가 사용자 소유권을 확인하고, 관리자 기능은 role 기반으로 통제합니다.
- **입력 검증** — Pydantic으로 요청을 검증(집중도 1~5, 시간 음수 방지 등).
- `.env`, DB 파일 등은 `.gitignore`로 커밋에서 제외됩니다.
