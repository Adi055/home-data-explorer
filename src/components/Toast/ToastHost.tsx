import { useEffect } from "react";
import { useAppState, useAppDispatch } from "../../state/store";
import { Toast } from "./Toast";
import "./Toast.css";

const AUTO_DISMISS_MS = 5000;

export function ToastHost() {
  const { toasts } = useAppState();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => dispatch({ type: "DISMISS_TOAST", id: toast.id }), AUTO_DISMISS_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dispatch]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} onDismiss={() => dispatch({ type: "DISMISS_TOAST", id: toast.id })} />
      ))}
    </div>
  );
}
