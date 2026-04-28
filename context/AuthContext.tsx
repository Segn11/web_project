'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { User } from '@/types';

interface BackendUser {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  role?: 'admin' | 'user';
  is_staff?: boolean;
}

interface AuthSessionResponse {
  user: BackendUser;
  access: string;
  refresh: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (email: string, name: string, password?: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (name: string, email: string) => void;
  getAllUsers: () => User[];
  deleteUser: (id: string) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000/api';
const ACCESS_TOKEN_KEY = 'auth-access-token';
const REFRESH_TOKEN_KEY = 'auth-refresh-token';
const AUTH_USER_KEY = 'auth-user';
const MOCK_USERS_KEY = 'users';

const createAvatarUrl = (seed: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;

const toFrontendUser = (backendUser: BackendUser): User => {
  const name = backendUser.name?.trim()
    || [backendUser.first_name, backendUser.last_name].filter(Boolean).join(' ').trim()
    || backendUser.username;

  return {
    id: String(backendUser.id),
    username: backendUser.username,
    email: backendUser.email,
    name,
    role: backendUser.role ?? (backendUser.is_staff ? 'admin' : 'user'),
    avatar: createAvatarUrl(backendUser.username || name),
  };
};

const normalizeStoredUser = (value: string | null): User | null => {
  if (!value) return null;

  try {
    return JSON.parse(value) as User;
  } catch {
    return null;
  }
};

const readMockUsers = (): User[] => {
  if (typeof window === 'undefined') return [];

  try {
    return JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]') as User[];
  } catch {
    return [];
  }
};

const writeMockUsers = (users: User[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
};

const upsertMockUser = (user: User) => {
  const users = readMockUsers();
  const existingIndex = users.findIndex((item) => item.id === user.id);
  if (existingIndex >= 0) {
    users[existingIndex] = user;
  } else {
    users.push(user);
  }
  writeMockUsers(users);
};

const removeAuthStorage = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
};

const saveAuthStorage = (session: AuthSessionResponse) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, session.access);
  localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(toFrontendUser(session.user)));
};

const readStoredSession = () => {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null, user: null as User | null };
  }

  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
    user: normalizeStoredUser(localStorage.getItem(AUTH_USER_KEY)),
  };
};

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = typeof payload === 'string'
      ? payload
      : payload?.detail
        || payload?.message
        || Object.values(payload || {})
          .flat()
          .filter(Boolean)
          .join(' ')
        || 'Request failed';
    throw new Error(message);
  }

  return payload as T;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedUsers = localStorage.getItem(MOCK_USERS_KEY);
    if (!storedUsers) {
      writeMockUsers([
        {
          id: 'admin-1',
          email: 'admin@lumiere.com',
          name: 'Admin',
          password: 'AdminPassword123!',
          role: 'admin',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
        },
      ]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const bootstrapAuth = async () => {
      const storedSession = readStoredSession();
      setAccessToken(storedSession.accessToken);
      setRefreshToken(storedSession.refreshToken);

      if (storedSession.user) {
        setUser(storedSession.user);
        upsertMockUser(storedSession.user);
      }

      if (!storedSession.accessToken || !storedSession.refreshToken) {
        setIsLoading(false);
        return;
      }

      try {
        const me = await requestJson<BackendUser>('/auth/me/', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${storedSession.accessToken}`,
          },
        });
        const frontendUser = toFrontendUser(me);
        setUser(frontendUser);
        upsertMockUser(frontendUser);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(frontendUser));
      } catch {
        try {
          const refreshed = await requestJson<{ access: string }>('/auth/refresh/', {
            method: 'POST',
            body: JSON.stringify({ refresh: storedSession.refreshToken }),
          });
          setAccessToken(refreshed.access);
          localStorage.setItem(ACCESS_TOKEN_KEY, refreshed.access);

          const me = await requestJson<BackendUser>('/auth/me/', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${refreshed.access}`,
            },
          });
          const frontendUser = toFrontendUser(me);
          setUser(frontendUser);
          upsertMockUser(frontendUser);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(frontendUser));
        } catch {
          removeAuthStorage();
          setAccessToken(null);
          setRefreshToken(null);
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrapAuth();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSessionExpired = () => {
      removeAuthStorage();
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
      toast.error('Your session expired. Please sign in again.');
    };

    window.addEventListener('auth:session-expired', handleSessionExpired as EventListener);
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired as EventListener);
    };
  }, []);

  const login = async (email: string, password?: string) => {
    try {
      const session = await requestJson<AuthSessionResponse>('/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const frontendUser = toFrontendUser(session.user);
      setUser(frontendUser);
      setAccessToken(session.access);
      setRefreshToken(session.refresh);
      saveAuthStorage(session);
      upsertMockUser(frontendUser);
      toast.success('Successfully logged in!');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid email or password');
      return false;
    }
  };

  const signup = async (email: string, name: string, password?: string) => {
    try {
      const session = await requestJson<AuthSessionResponse>('/auth/signup/', {
        method: 'POST',
        body: JSON.stringify({ email, name, password }),
      });

      const frontendUser = toFrontendUser(session.user);
      setUser(frontendUser);
      setAccessToken(session.access);
      setRefreshToken(session.refresh);
      saveAuthStorage(session);
      upsertMockUser(frontendUser);
      toast.success('Account created successfully!');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create account');
      return false;
    }
  };

  const updateProfile = (name: string, email: string) => {
    if (!user) return;

    const updatedUser = { ...user, name, email };
    setUser(updatedUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser));
      upsertMockUser(updatedUser);
    }
    toast.success('Profile updated successfully!');
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    removeAuthStorage();
    toast.success('Logged out');
  };

  const getAllUsers = () => readMockUsers();

  const deleteUser = (id: string) => {
    const users = readMockUsers().filter((item) => item.id !== id);
    writeMockUsers(users);
    toast.success('User deleted');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        login,
        signup,
        logout,
        updateProfile,
        getAllUsers,
        deleteUser,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
