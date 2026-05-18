import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
    setUser(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * Bounces unauthenticated visitors to /sign-in. The current path is preserved
 * in the `next` query param so the magic link lands them back where they were.
 * Returns true once we know the user is signed in; false while loading or
 * during the redirect.
 */
export function useRequireAuth(): boolean {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading && !user) {
      const next = window.location.pathname + window.location.search;
      window.location.replace(`/sign-in?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user]);
  return !loading && !!user;
}
