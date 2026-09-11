"""기존 사용자를 관리자로 승격하는 스크립트.

사용법 (backend 디렉토리에서, 가상환경 활성화 후):
    python -m scripts.make_admin user@example.com

이미 가입한 사용자의 role을 'admin'으로 바꾼다. 비밀번호는 다루지 않는다.
"""
import sys

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import User


def main() -> None:
    if len(sys.argv) != 2:
        print("사용법: python -m scripts.make_admin <email>")
        sys.exit(1)

    email = sys.argv[1]
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            print(f"사용자를 찾을 수 없습니다: {email}")
            sys.exit(1)
        user.role = "admin"
        db.commit()
        print(f"'{email}' 계정을 관리자로 승격했습니다.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
