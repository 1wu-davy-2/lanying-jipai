from pathlib import Path


def test_example_database_url_leaves_cloud_host_for_manual_configuration() -> None:
    example = Path(__file__).parents[1] / ".env.example"

    assert "@YOUR_DB_HOST:" in example.read_text(encoding="utf-8")


def test_example_includes_cos_and_minio_media_settings() -> None:
    content = (Path(__file__).parents[1] / ".env.example").read_text(encoding="utf-8")

    assert "UPLOAD_STORAGE_DRIVER=minio" in content
    assert "COS_BUCKET=" in content
    assert "MINIO_BUCKET=" in content
    assert "MINIO_PUBLIC_BASE_URL=" in content
