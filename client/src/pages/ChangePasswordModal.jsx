import { useEffect, useState } from "react";

import { api, setToken } from "../api.js";
import { Button, ErrorBox, Field, Modal, inputClass } from "../components/ui.jsx";
import { useToast } from "../context/ToastContext.jsx";

const EMPTY = { currentPassword: "", newPassword: "", confirm: "" };

export default function ChangePasswordModal({ isOpen, onClose }) {
  const notify = useToast();
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValues(EMPTY);
      setError("");
    }
  }, [isOpen]);

  const set = (k) => (e) => setValues({ ...values, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (values.newPassword.length < 8) return setError("New password must be at least 8 characters");
    if (values.newPassword !== values.confirm) return setError("The new passwords do not match");
    setIsSubmitting(true);
    try {
      const d = await api("/auth/change-password", {
        method: "POST",
        body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      });
      setToken(d.token);
      notify("Password changed. Other signed-in browsers are signed out.");
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Password">
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Current password" htmlFor="cp-current">
          <input id="cp-current" type="password" className={inputClass} autoComplete="current-password" value={values.currentPassword} onChange={set("currentPassword")} />
        </Field>
        <Field label="New password" hint="at least 8 characters" htmlFor="cp-new">
          <input id="cp-new" type="password" className={inputClass} autoComplete="new-password" value={values.newPassword} onChange={set("newPassword")} />
        </Field>
        <Field label="Repeat new password" htmlFor="cp-confirm">
          <input id="cp-confirm" type="password" className={inputClass} autoComplete="new-password" value={values.confirm} onChange={set("confirm")} />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Update"}</Button>
        </div>
      </form>
    </Modal>
  );
}
