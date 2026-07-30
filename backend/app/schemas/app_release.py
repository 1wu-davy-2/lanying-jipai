from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator


class AndroidReleaseManifest(BaseModel):
    platform: Literal["android"] = "android"
    version_code: int = Field(gt=0)
    version_name: str = Field(min_length=1)
    force_update: Literal[True] = True
    release_notes: str = Field(min_length=1)
    apk_url: HttpUrl
    apk_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")

    @field_validator("apk_url")
    @classmethod
    def apk_url_must_use_https(cls, value: HttpUrl) -> HttpUrl:
        if value.scheme != "https":
            raise ValueError("APK URL must use HTTPS")
        return value
