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

export interface AuthTokens {
  token: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
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
    apiClient.post('/auth/refresh', { refreshToken: token }),
  );
}

export function logout(): Promise<ApiResponse<void>> {
  return apiRequest(apiClient.post('/auth/logout'));
}

export function getMe(): Promise<ApiResponse<User>> {
  return apiRequest(apiClient.get('/auth/me'));
}

export function sendOtp(
  phone: string,
): Promise<ApiResponse<OtpResponse>> {
  return apiRequest(apiClient.post('/auth/otp/send', { phone }));
}

export function verifyOtp(
  phone: string,
  otp: string,
): Promise<ApiResponse<AuthResponse>> {
  return apiRequest(apiClient.post('/auth/otp/verify', { phone, otp }));
}
