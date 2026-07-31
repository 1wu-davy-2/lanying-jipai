import { client, request } from "./client";

export interface AndroidReleaseManifest {
  platform: "android";
  version_code: number;
  version_name: string;
  force_update: true;
  release_notes: string;
  apk_url: string;
  apk_sha256: string;
}

export function getLatestAndroidRelease() {
  return request<AndroidReleaseManifest | null>(client.get("/app-releases/android/latest"));
}
