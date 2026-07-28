export type UserRole = "merchant" | "model" | "admin";

export interface CurrentUser {
  id: number;
  phone: string;
  role: UserRole;
  nickname: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: CurrentUser;
}

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}
