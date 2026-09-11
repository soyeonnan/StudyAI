# API 문서

기본 경로(prefix): `/api`
인증: 대부분의 엔드포인트는 `Authorization: Bearer <JWT>` 헤더가 필요합니다.
로그인 시 발급된 access token을 사용합니다.

> FastAPI는 실행 중 `/docs`(Swagger UI)와 `/openapi.json`으로 대화형 문서를 자동 제공합니다.
> 이 문서는 빠른 참조용 요약입니다.

## 인증 (auth)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 회원가입 | 불필요 |
| POST | `/api/auth/login` | 로그인(OAuth2 폼: username=이메일, password) | 불필요 |
| GET | `/api/auth/me` | 현재 사용자 정보(role 포함) | 필요 |

**회원가입 요청 예시**
```json
{ "email": "me@example.com", "password": "password123", "display_name": "소연" }
```

**로그인** — `application/x-www-form-urlencoded` 로 `username`, `password` 전송.
응답: `{ "access_token": "...", "token_type": "bearer" }`

## 과목 (subjects)

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/subjects` | 과목 평면 목록(대분류+소분류) |
| GET | `/api/subjects/tree` | 대분류별로 소분류를 묶은 트리 |
| POST | `/api/subjects` | 과목 생성 (`parent_id` 있으면 소분류) |
| DELETE | `/api/subjects/{id}` | 과목 삭제(대분류 삭제 시 소분류 함께) |

**생성 예시**
```json
{ "name": "영어단어", "color": "#3b82f6", "parent_id": 1 }
```

## 공부 기록 (sessions)

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/sessions?start=&end=` | 기간별 기록 조회 |
| POST | `/api/sessions` | 기록 생성(타이머 저장/수동 추가) |
| PATCH | `/api/sessions/{id}` | 기록 부분 수정(집중도·메모·시간·과목) |
| DELETE | `/api/sessions/{id}` | 기록 삭제 |

**생성 예시** (시간은 초 단위, 집중도 1~5)
```json
{
  "subject_id": 1,
  "started_at": "2026-09-08T09:00:00",
  "ended_at": "2026-09-08T10:00:00",
  "study_seconds": 3600,
  "break_seconds": 300,
  "focus_level": 4,
  "memo": "미적분 복습"
}
```

## 일정 (schedules)

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/schedules?start=&end=` | 기간별 일정 조회 |
| POST | `/api/schedules` | 일정 생성 |
| PATCH | `/api/schedules/{id}` | 일정 수정(제목·설명·날짜·완료) |
| DELETE | `/api/schedules/{id}` | 일정 삭제 |

## 루틴 (routines) — 버전 관리

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/routines` | 현재 유효한 루틴 목록 |
| GET | `/api/routines/on/{date}` | 특정 날짜에 유효한 루틴 + 완료 여부 |
| GET | `/api/routines/{definition_id}/history` | 루틴의 전체 버전 이력 |
| POST | `/api/routines` | 루틴 생성 |
| PATCH | `/api/routines/{definition_id}` | 루틴 수정(새 버전 생성, 과거 보존) |
| DELETE | `/api/routines/{definition_id}` | 루틴 보관 처리 |
| POST | `/api/routines/{definition_id}/toggle` | 특정 날짜 완료 토글 |

**생성 예시**
```json
{ "title": "영어 단어 30개", "weekday_mask": 127, "subject_id": 1, "effective_from": "2026-09-01" }
```

**완료 토글 예시**
```json
{ "completed_date": "2026-09-08", "done": true }
```

## 통계 (stats) — 대시보드

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/stats/daily?date=YYYY-MM-DD` | 특정 날짜 요약 |
| GET | `/api/stats/monthly?year=&month=` | 특정 월 요약 + 그래프 데이터 |

**daily 응답 예시**
```json
{
  "date": "2026-09-08",
  "total_study_seconds": 5400,
  "total_break_seconds": 300,
  "session_count": 2,
  "avg_focus": 3.0,
  "routine_done": 1, "routine_total": 2,
  "schedule_done": 2, "schedule_total": 3
}
```

## 관리자 (admin) — role=admin 전용

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/admin/guides` | 학습 가이드 목록 (관리자 아니면 403) |

## 기타

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/health`, `/api/health` | 헬스 체크 |
| GET | `/metrics` | Prometheus 메트릭 |

## 공통 응답 규칙

- 인증 실패: `401`
- 권한 부족(관리자 아님): `403`
- 리소스 없음/소유자 아님: `404`
- 잘못된 요청(검증 실패): `422`(FastAPI 기본) 또는 `400`
