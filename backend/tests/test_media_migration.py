from scripts.migrate_cos_media_to_minio import rewrite_urls


def test_rewrite_urls_only_replaces_the_configured_cos_public_prefix() -> None:
    source = "https://example-1250000000.cos.ap-guangzhou.myqcloud.com"
    target = "https://media.example.com"
    urls, object_keys = rewrite_urls(
        [
            f"{source}/2026/07/photo%20one.png",
            "https://unrelated.example.com/2026/07/keep.png",
            "/uploads/legacy.png",
        ],
        source,
        target,
    )

    assert urls == [
        "https://media.example.com/2026/07/photo%20one.png",
        "https://unrelated.example.com/2026/07/keep.png",
        "/uploads/legacy.png",
    ]
    assert object_keys == ["2026/07/photo one.png"]
