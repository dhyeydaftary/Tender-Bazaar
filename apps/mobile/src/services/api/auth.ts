import apiClient, { apiRequest } from './client';
import type { ApiResponse } from '@/types/api';
import type { User } from '@/types/user';

// ─── Request / Response Types ────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  companyName?: string;
}

// Matches the API: /auth/refresh returns { accessToken, refreshToken }, and
// /auth/login, /auth/register and /auth/otp/verify return them flat beside `user`.
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface OtpResponse {
  message: string;
  expiresIn: number;
}

// ─── API Calls ──────────────────────────────────────────────────────────────

export function login(
  email: string,
  password: string,
): Promise<ApiResponse<AuthResponse>> {
  return apiRequest(apiClient.post('/auth/login', { email, password }));
}

export function register(
  data: RegisterRequest,
): Promise<ApiResponse<AuthResponse>> {
  return apiRequest(apiClient.post('/auth/register', data));
}

export function refreshToken(
  token: string,
): Promise<ApiResponse<AuthTokens>> {
  return apiRequest(
    apiClient.post('/auth/refresh-token', { refreshToken: token }),
  );
}

export function logout(
  refreshToken: string,
  accessToken: string,
): Promise<ApiResponse<void>> {
  // Tokens are passed explicitly: callers clear the auth store right after firing
  // this request, so the request interceptor may no longer find the access token.
  return apiRequest(
    apiClient.delete('/auth/logout', {
      data: { refreshToken },
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export function getMe(): Promise<ApiResponse<User>> {
  return apiRequest(apiClient.get('/auth/me'));
}

export function sendOtp(
  phone: string,
): Promise<ApiResponse<OtpResponse>> {
  return apiRequest(apiClient.post('/auth/send-otp', { phone }));
}

export function verifyOtp(
  phone: string,
  otp: string,
): Promise<ApiResponse<AuthResponse>> {
  return apiRequest(apiClient.post('/auth/verify-otp', { phone, otp }));
}
