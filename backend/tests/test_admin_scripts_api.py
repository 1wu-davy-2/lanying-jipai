from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import get_session_factory
from app.main import app
from app.models.script import ScriptCategory, ScriptDocument
from app.models.user import User
from app.security import create_access_token, hash_password


def add_script_data(session: Session) -> None:
    general = ScriptCategory(code="douyin_ops", name="抖音运营话术", description="私信和跟进", display_order=10, is_restricted=False)
    sensitive = ScriptCategory(code="sensitive_category", name="敏感品类话术", description="合规沟通", display_order=20, is_restricted=True)
    session.add_all([general, sensitive])
    session.flush()
    session.add_all([
        ScriptDocument(category_id=general.id, source_key="private-message", source_filename="private-message.md", title="私信开场", markdown_body="## 开场\n\n```text\n你好，欢迎了解寄拍合作。\n```", content_sha256="a" * 64, section_count=1, copy_block_count=1),
        ScriptDocument(category_id=sensitive.id, source_key="sensitive", source_filename="sensitive.md", title="敏感品类知情确认", markdown_body="## 说明\n\n```text\n请先确认品类和拍摄边界，可自由拒绝。\n```", content_sha256="b" * 64, section_count=1, copy_block_count=1),
    ])
    session.commit()


def admin_headers(session: Session) -> dict[str, str]:
    admin = User(phone="13100000001", password_hash=hash_password("secure-password"), role="admin", nickname="管理员")
    session.add(admin)
    session.commit()
    return {"Authorization": f"Bearer {create_access_token(admin.id)}"}


def test_admin_can_browse_search_and_read_script_library() -> None:
    with get_session_factory()() as session:
        add_script_data(session)
        headers = admin_headers(session)

    client = TestClient(app)
    denied = client.get("/api/admin/scripts/categories")
    assert denied.status_code == 401

    categories = client.get("/api/admin/scripts/categories", headers=headers)
    assert categories.status_code == 200
    assert [item["code"] for item in categories.json()["data"]] == ["douyin_ops", "sensitive_category"]
    assert categories.json()["data"][1]["is_restricted"] is True

    listed = client.get("/api/admin/scripts", headers=headers, params={"category": "douyin_ops"})
    assert listed.status_code == 200
    assert listed.json()["data"]["total"] == 1
    document_id = listed.json()["data"]["items"][0]["id"]

    searched = client.get("/api/admin/scripts", headers=headers, params={"keyword": "拍摄边界"})
    assert searched.status_code == 200
    assert searched.json()["data"]["items"][0]["source_key"] == "sensitive"

    detail = client.get(f"/api/admin/scripts/{document_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["data"]["markdown_body"].startswith("## 开场")
