import { createContext, useCallback, useContext, useState } from "react";
import { twMerge } from "tailwind-merge";

const ToastContext = createContext(() => {});

const ACCENT = {
  success: "border-l-success-500 dark:border-l-success-400",
  error: "border-l-error-500 dark:border-l-error-400",
  info: "border-l-brand-500 dark:border-l-brand-400",
};
const CHIP = {
  success: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400",
  error: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
  info: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
};
const ICON = {
  success: "M5 13l4 4L19 7",
  error: "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const notify = useCallback(
    (message, variant = "success") => {
      const id = Date.now() + Math.random();
      setToasts((list) => [...list, { id, message, variant }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="pointer-events-none fixed top-20 right-4 z-999999 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.variant === "error" ? "alert" : "status"}
            className={twMerge(
              "pointer-events-auto flex w-full items-start gap-3 rounded-xl p-4",
              "border border-l-4 border-gray-200 bg-white shadow-theme-lg dark:border-gray-700 dark:bg-gray-800",
              ACCENT[t.variant],
            )}
          >
            <span className={twMerge("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", CHIP[t.variant])}>
              <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICON[t.variant]} />
              </svg>
            </span>
            <p className="flex-1 pt-1.5 text-sm text-gray-700 dark:text-gray-300">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
