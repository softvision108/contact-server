import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { MoonIcon, SunIcon } from "../components/icons.jsx";
import { Button, ErrorBox, Label, inputClass } from "../components/ui.jsx";
import { routePaths } from "../constants.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

export default function SignInPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isHydrating, notice } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated && !isHydrating) return <Navigate replace to={routePaths.providers} />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim()) return setError("Username is required");
    if (!password) return setError("Password is required");
    setIsSubmitting(true);
    try {
      await login(username, password);
      navigate(routePaths.providers, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative z-1 bg-white p-6 sm:p-0 dark:bg-gray-900">
      <div className="relative flex h-screen w-full flex-col justify-center sm:p-0 lg:flex-row dark:bg-gray-900">
        <div className="flex w-full flex-1 flex-col lg:w-1/2">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
            <div className="mb-5 sm:mb-8">
              <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">Sign In</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Enter your username and password to sign in!</p>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <ErrorBox>{error || notice}</ErrorBox>
                <div>
                  <Label htmlFor="username">Username <span className="text-error-500">*</span></Label>
                  <input id="username" className={inputClass} placeholder="Enter your username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="password">Password <span className="text-error-500">*</span></Label>
                  <div className="relative">
                    <input
                      id="password"
                      className={`${inputClass} pr-16`}
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <Button className="w-full" size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Button>
              </div>
            </form>
          </div>
        </div>
        <div className="relative hidden h-full w-full items-center bg-brand-950 lg:grid lg:w-1/2 dark:bg-white/5">
          <div className="flex flex-col items-center px-10 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-500 text-2xl font-semibold text-white">C</span>
            <p className="text-2xl font-semibold text-white">Contacts Admin</p>
            <p className="mt-2 max-w-sm text-sm text-gray-400">Providers, people and licensing partners in one place.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          className="fixed right-6 bottom-6 z-50 hidden h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white transition-colors hover:bg-brand-600 sm:flex"
        >
          {theme === "dark" ? <SunIcon className="h-6 w-6" /> : <MoonIcon className="h-6 w-6" />}
        </button>
      </div>
    </div>
  );
}
