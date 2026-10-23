import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, getToken, setToken, setUnauthorizedHandler } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isHydrating, setIsHydrating] = useState(Boolean(getToken()));
  const [notice, setNotice] = useState("");

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      setNotice("Your session has expired. Please sign in again.");
    });
    if (!getToken()) return;
    api("/auth/me")
      .then((d) => setUser(d.user))
      .catch(logout)
      .finally(() => setIsHydrating(false));
  }, [logout]);

  const login = useCallback(async (username, password) => {
    const d = await api("/auth/login", { method: "POST", body: { username, password } });
    setToken(d.token);
    setNotice("");
    setUser(d.user);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user), isHydrating, notice, login, logout }),
    [user, isHydrating, notice, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
