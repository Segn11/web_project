function resolveApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configured) return configured;

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000/api`;
  }

  return 'http://127.0.0.1:8000/api';
}

const API_BASE_URL = resolveApiBaseUrl();
const CHAT_CLIENT_ID_KEY = 'chat-client-id';
const ACCESS_TOKEN_KEY = 'auth-access-token';
const REFRESH_TOKEN_KEY = 'auth-refresh-token';
const AUTH_USER_KEY = 'auth-user';

let refreshAccessTokenPromise: Promise<string | null> | null = null;

function emitSessionExpiredEvent() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('auth:session-expired'));
}

export interface ChatSession {
  id: string;
  title: string;
  status: 'active' | 'archived';
  message_count: number;
  last_message_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: string;
  role: 'user' | 'model' | 'system' | 'tool';
  content: string;
  content_type: string;
  model_name: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  latency_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function getOrCreateChatClientId(): string {
  if (typeof window === 'undefined') return 'server-client';

  const existing = localStorage.getItem(CHAT_CLIENT_ID_KEY);
  if (existing) return existing;

  const generated = `guest-${crypto.randomUUID()}`;
  localStorage.setItem(CHAT_CLIENT_ID_KEY, generated);
  return generated;
}

function authHeaders(accessToken?: string | null): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

function guestHeaders(clientId: string): HeadersInit {
  return { 'X-Client-Id': clientId };
}

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  if (!refreshAccessTokenPromise) {
    refreshAccessTokenPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        emitSessionExpiredEvent();
        return null;
      }

      const payload = (await response.json()) as { access?: string };
      if (!payload?.access) {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        emitSessionExpiredEvent();
        return null;
      }

      localStorage.setItem(ACCESS_TOKEN_KEY, payload.access);
      return payload.access;
    })().finally(() => {
      refreshAccessTokenPromise = null;
    });
  }

  return refreshAccessTokenPromise;
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrls = [API_BASE_URL];
  if (API_BASE_URL.includes('127.0.0.1')) {
    baseUrls.push(API_BASE_URL.replace('127.0.0.1', 'localhost'));
  } else if (API_BASE_URL.includes('localhost')) {
    baseUrls.push(API_BASE_URL.replace('localhost', '127.0.0.1'));
  }

  let lastNetworkError: unknown = null;

  const mergedHeaders = new Headers(options?.headers || {});
  const hasBody = options?.body !== undefined && options?.body !== null;
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  if (hasBody && !isFormData && !mergedHeaders.has('Content-Type')) {
    mergedHeaders.set('Content-Type', 'application/json');
  }

  const sendWithBaseFallback = async (headers: Headers): Promise<{ response: Response; payload: unknown }> => {
    let response: Response | null = null;

    for (const baseUrl of baseUrls) {
      try {
        const requestOptions: RequestInit = {
          ...options,
          headers,
        };

        response = await fetch(`${baseUrl}${path}`, {
          ...requestOptions,
        });
        break;
      } catch (error) {
        lastNetworkError = error;
      }
    }

    if (!response) {
      const reason = lastNetworkError instanceof Error ? lastNetworkError.message : 'Network request failed';
      throw new Error(`Cannot reach chat history API. Tried ${baseUrls.join(', ')}. ${reason}`);
    }

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        const contentType = response.headers.get('content-type') || 'unknown';
        const snippet = text.slice(0, 120).replace(/\s+/g, ' ').trim();
        throw new Error(
          `Invalid chat API response from ${path}: expected JSON but received ${contentType}. Response starts with: ${snippet}`
        );
      }
    }

    return { response, payload };
  };

  let { response, payload } = await sendWithBaseFallback(mergedHeaders);

  const tokenInvalid = response.status === 401
    && mergedHeaders.has('Authorization')
    && typeof payload === 'object'
    && payload !== null
    && (
      (payload as { code?: string }).code === 'token_not_valid'
      || String((payload as { detail?: string }).detail || '').toLowerCase().includes('token')
    );

  if (tokenInvalid) {
    const refreshedAccessToken = await refreshAccessToken();
    if (refreshedAccessToken) {
      const retryHeaders = new Headers(mergedHeaders);
      retryHeaders.set('Authorization', `Bearer ${refreshedAccessToken}`);
      ({ response, payload } = await sendWithBaseFallback(retryHeaders));
    }
  }

  if (!response.ok) {
    const message = (payload as { detail?: string; message?: string } | null)?.detail
      || (payload as { detail?: string; message?: string } | null)?.message
      || 'Chat history request failed';
    throw new Error(message);
  }

  return payload as T;
}

function normalizeList<T>(payload: T[] | { results: T[] }): T[] {
  return Array.isArray(payload) ? payload : payload.results;
}

export async function listChatSessions(params: { accessToken?: string | null; clientId: string }): Promise<ChatSession[]> {
  const headers = {
    ...authHeaders(params.accessToken),
    ...guestHeaders(params.clientId),
  };
  const payload = await requestJson<ChatSession[] | { results: ChatSession[] }>('/chat/sessions/', { headers });
  return normalizeList(payload);
}

export async function createChatSession(params: {
  accessToken?: string | null;
  clientId: string;
  title?: string;
  metadata?: Record<string, unknown>;
}): Promise<ChatSession> {
  const headers = {
    ...authHeaders(params.accessToken),
    ...guestHeaders(params.clientId),
  };

  return requestJson<ChatSession>('/chat/sessions/', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: params.title || 'Gebiya assistant chat',
      metadata: params.metadata || {},
    }),
  });
}

export async function getChatMessages(params: {
  sessionId: string;
  accessToken?: string | null;
  clientId: string;
}): Promise<ChatMessage[]> {
  const headers = {
    ...authHeaders(params.accessToken),
    ...guestHeaders(params.clientId),
  };

  return requestJson<ChatMessage[]>(`/chat/sessions/${params.sessionId}/messages/`, {
    headers,
  });
}

export async function appendChatExchange(params: {
  sessionId: string;
  accessToken?: string | null;
  clientId: string;
  userMessage: string;
  assistantMessage: string;
  modelName?: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}) {
  const headers = {
    ...authHeaders(params.accessToken),
    ...guestHeaders(params.clientId),
  };

  return requestJson<{ session_id: string; message_id: number }>(`/chat/sessions/${params.sessionId}/append-exchange/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_message: params.userMessage,
      assistant_message: params.assistantMessage,
      model_name: params.modelName || 'gemini-3-flash-preview',
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      latency_ms: params.latencyMs,
      metadata: params.metadata || {},
    }),
  });
}
