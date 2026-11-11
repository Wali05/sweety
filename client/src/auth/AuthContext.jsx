import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as api from '../api/client.js';
import { clearToken, getToken, setToken } from './tokenStorage.js';

const AuthContext = createContext(null);

const ANONYMOUS = { user: null, token: null, status: 'anonymous' };

// With a stored token we start in 'loading' until /auth/me confirms it, so
// the app doesn't briefly treat a returning user as logged out.
function initialState() {
  const token = getToken();
  return token ? { user: null, token, status: 'loading' } : ANONYMOUS;
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialState);
  // Bumped on every login, signup and logout so an older in-flight request
  // (the session restore below) can't overwrite or clear a newer session.
  const sessionRef = useRef(0);

  useEffect(() => {
    const storedToken = getToken();
    if (!storedToken) return undefined;

    const session = sessionRef.current;
    let cancelled = false;
    const isStale = () => cancelled || sessionRef.current !== session;

    api
      .fetchMe(storedToken)
      .then(({ user }) => {
        if (isStale()) return;
        setState({ user, token: storedToken, status: 'authenticated' });
      })
      .catch((err) => {
        if (isStale()) return;
        // 401 means the token is expired or no longer valid. On other errors
        // (server down, network failure) keep it so a reload can try again.
        if (err instanceof api.ApiError && err.status === 401) clearToken();
        setState(ANONYMOUS);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const startSession = useCallback(({ user, token }) => {
    sessionRef.current += 1;
    setToken(token);
    setState({ user, token, status: 'authenticated' });
    return user;
  }, []);

  // Errors propagate as ApiError so forms can show err.message.
  const login = useCallback(
    async (email, password) => startSession(await api.login({ email, password })),
    [startSession]
  );

  const signup = useCallback(
    async (name, email, password) => startSession(await api.signup({ name, email, password })),
    [startSession]
  );

  // Also call this when a request made with the token gets a 401.
  const logout = useCallback(() => {
    sessionRef.current += 1;
    clearToken();
    setState(ANONYMOUS);
  }, []);

  const value = useMemo(
    () => ({ ...state, login, signup, logout }),
    [state, login, signup, logout]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return auth;
}
