"""간단한 비속어(욕설) 필터.

커뮤니티 글/댓글의 악플을 막기 위한 서버측 방어다. 외부 라이브러리 없이
기본 사전 기반으로 검사한다. 완벽한 필터는 아니며, 대표적인 한국어 비속어를
차단하는 수준이다. 우회(자모 분리 등)까지 막지는 않는다.

정책: 비속어가 포함되면 작성을 거부한다(마스킹이 아니라 거부).
"""
import re

# 대표적인 한국어 비속어 어간. 필요 시 확장한다.
# 과도한 오탐을 줄이기 위해 명백한 욕설 위주로 최소한만 둔다.
_BASE_WORDS = [
    "시발", "씨발", "씨발", "ㅅㅂ", "시바", "씨바",
    "병신", "ㅄ", "ㅂㅅ",
    "지랄", "ㅈㄹ",
    "개새끼", "개색기", "새끼", "새꺄",
    "좆", "좇", "존나", "존내", "졸라",
    "닥쳐", "꺼져",
    "미친놈", "미친년", "또라이",
    "엿먹",
    "fuck", "shit", "bitch", "asshole",
]

# 공백/특수문자로 끊어 쓴 우회를 어느 정도 잡기 위해, 검사 전에 비문자를 제거한다.
_NON_WORD = re.compile(r"[\s\.\-_*~!@#$%^&()\[\]{}<>/\\|+=,]")


def _normalize(text: str) -> str:
    return _NON_WORD.sub("", text).lower()


def contains_profanity(text: str) -> bool:
    """텍스트에 비속어가 포함되어 있으면 True."""
    if not text:
        return False
    normalized = _normalize(text)
    return any(word in normalized for word in (w.lower() for w in _BASE_WORDS))


def find_profanities(text: str) -> list[str]:
    """포함된 비속어 목록을 반환한다(중복 제거)."""
    if not text:
        return []
    normalized = _normalize(text)
    found = {w for w in _BASE_WORDS if w.lower() in normalized}
    return sorted(found)
