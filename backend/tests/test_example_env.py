from pathlib import Path


def test_example_database_url_leaves_cloud_host_for_manual_configuration() -> None:
    example = Path(__file__).parents[1] / ".env.example"

    assert "@YOUR_DB_HOST:" in example.read_text(encoding="utf-8")
