# DB 설계 문서

이 문서는 공부 캘린더의 데이터베이스 설계를 설명합니다. 학습용으로 각 테이블의 의도와
핵심 설계인 **루틴 시간 독립 버전 관리**를 코드와 함께 정리했습니다.

## 왜 관계형 DB(PostgreSQL)인가

데이터가 이미 관계 구조입니다. 사용자 → 과목 → 공부 기록(1:N), 루틴 → 버전 → 완료 이력.
"과목별 통계", "월간 집중도 추이" 같은 집계·조인이 핵심이라 관계형이 유리합니다.
개발은 SQLite로 시작하고, `DATABASE_URL` 환경변수만 바꾸면 PostgreSQL로 전환됩니다(코드 변경 없음).

## 테이블 개요

| 테이블 | 설명 |
| --- | --- |
| `users` | 사용자. `role`(user/admin)로 권한 구분 |
| `subjects` | 공부 과목. `parent_id` 자기참조로 대분류/소분류 2단계 |
| `study_sessions` | 공부 기록(공부/휴식 시간, 집중도 1~5, 메모) |
| `schedule_items` | 일정(할 일). 날짜 + 완료 여부 |
| `routine_definitions` | 루틴의 정체성(하나의 루틴) |
| `routine_versions` | 루틴의 특정 기간 유효한 버전(제목/요일/과목) |
| `routine_completions` | 특정 날짜에 특정 버전을 완료한 이력 |

## 관계도 (개념)

```
users 1 ── N subjects (parent_id로 자기 계층)
users 1 ── N study_sessions ── N:1 subjects
users 1 ── N schedule_items
users 1 ── N routine_definitions 1 ── N routine_versions 1 ── N routine_completions
                                            └ N:1 subjects (선택)
```

## 과목 계층 (대분류 / 소분류)

`Subject`는 자기 자신을 참조합니다. `parent_id`가 NULL이면 대분류, 값이 있으면 소분류입니다.

```python
class Subject(Base):
    __tablename__ = "subjects"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(100))
```

- 2단계로만 제한합니다(소분류 아래에 다시 하위 과목 금지). 라우터에서 부모의 `parent_id`가
  이미 있으면 400을 반환합니다.
- 대분류를 삭제하면 `ondelete="CASCADE"`로 소분류도 함께 삭제됩니다.

## 핵심: 루틴 시간 독립 버전 관리

### 문제

"매일 영어 단어 30개"라는 루틴을 오늘 "영어 단어 50개"로 수정했다고 합시다.
그런데 **지난주에 본 루틴은 여전히 30개**여야 합니다. 단순히 한 행을 UPDATE하면
과거 데이터까지 바뀌어 버립니다.

### 해결: effective date 버전 관리

루틴을 두 개로 나눕니다.

- **RoutineDefinition**: 루틴의 정체성(id). "이 루틴"이라는 식별자.
- **RoutineVersion**: 특정 기간(`effective_from` ~ `effective_to`) 동안 유효한 상태(제목/요일/과목).

```python
class RoutineVersion(Base):
    __tablename__ = "routine_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    definition_id: Mapped[int] = mapped_column(ForeignKey("routine_definitions.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    weekday_mask: Mapped[int] = mapped_column(Integer, default=127)  # 요일 비트마스크(일=0 ~ 토=6)
    subject_id: Mapped[int | None] = mapped_column(ForeignKey("subjects.id", ondelete="SET NULL"))
    effective_from: Mapped[date] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)  # NULL이면 현재까지 유효
```

### 수정 시 동작

루틴을 수정하면 **현재 버전을 닫고(effective_to 설정) 새 버전을 만듭니다.**

```
수정 전:  v1  effective_from=09-01, effective_to=NULL   (title="30개")

09-10에 "50개"로 수정하면:

수정 후:  v1  09-01 ~ 09-09  (title="30개")   ← 과거 보존
          v2  09-10 ~ NULL   (title="50개")   ← 현재
```

### 특정 날짜의 루틴 조회

각 날짜는 "그 시점에 유효했던 버전"을 봅니다.

```python
def _version_on_date(definition_id, target, db):
    return db.scalar(
        select(RoutineVersion).where(
            RoutineVersion.definition_id == definition_id,
            RoutineVersion.effective_from <= target,
            or_(RoutineVersion.effective_to.is_(None),
                RoutineVersion.effective_to >= target),
        )
    )
```

- 09-05를 조회하면 v1("30개"), 09-15를 조회하면 v2("50개").
- **과거·현재·미래가 완전히 독립적**입니다.

### 완료 이력도 버전에 고정

`RoutineCompletion`은 `version_id`를 참조합니다. 어떤 버전을 완료했는지 고정하므로,
나중에 루틴을 수정해도 과거 완료 기록은 그대로 유지됩니다.

```python
class RoutineCompletion(Base):
    __tablename__ = "routine_completions"
    __table_args__ = (UniqueConstraint("version_id", "completed_date", name="uq_version_date"),)
    version_id: Mapped[int] = mapped_column(ForeignKey("routine_versions.id", ondelete="CASCADE"))
    completed_date: Mapped[date] = mapped_column(Date)
```

### 삭제

루틴을 삭제하면 물리 삭제 대신 **보관 처리**합니다. `RoutineDefinition.archived_at`을 설정하고
현재 버전의 `effective_to`를 어제로 닫아, 오늘 이후로는 안 보이지만 과거 이력은 남습니다.

## 요일 비트마스크

`weekday_mask`는 반복 요일을 비트로 저장합니다. 일=0비트 ~ 토=6비트, 127이면 매일.

```python
def _weekday_bit(target: date) -> int:
    # date.weekday()는 월=0 이므로 일=0 기준으로 변환
    return 1 << ((target.weekday() + 1) % 7)
```

## 인덱스/제약 요약

- `study_sessions.focus_level`에 CHECK 제약(1~5).
- `routine_completions`에 (version_id, completed_date) 유니크 제약.
- 외래키에 인덱스, 날짜 컬럼(`effective_from`, `scheduled_date`, `completed_date`)에 인덱스.
