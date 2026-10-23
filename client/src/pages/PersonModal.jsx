import { useEffect, useState } from "react";

import { api } from "../api.js";
import { Button, ErrorBox, Field, Modal, SelectInput, inputClass, textareaClass } from "../components/ui.jsx";
import { QUALITIES, STATUSES } from "../constants.js";
import { useToast } from "../context/ToastContext.jsx";

const EMPTY = { email: "", phone: "", country: "", countryCode: "", quality: "normal", status: "ready", content: "" };

export default function PersonModal({ isOpen, person, onClose, onSaved }) {
  const notify = useToast();
  const isEdit = Boolean(person);
  const [values, setValues] = useState(EMPTY);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setValues(person ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, person[k] ?? EMPTY[k]])) : EMPTY);
  }, [isOpen, person]);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const pick = (k) => (value) => setValues((v) => ({ ...v, [k]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!values.email.trim()) return setError("Email is required");
    setIsSubmitting(true);
    try {
      const saved = await api(isEdit ? `/people/${person._id}` : "/people", { method: isEdit ? "PUT" : "POST", body: values });
      notify(isEdit ? `${saved.email} updated` : `${saved.email} added`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Person" : "Add Person"} maxWidth="max-w-2xl">
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={<>Email <span className="text-error-500">*</span></>} htmlFor="hm-email" className="sm:col-span-2">
            <input id="hm-email" type="email" className={inputClass} value={values.email} onChange={set("email")} />
          </Field>
          <Field label="Phone" htmlFor="hm-phone">
            <input id="hm-phone" className={inputClass} value={values.phone} onChange={set("phone")} />
          </Field>
          <Field label="Status" htmlFor="hm-status">
            <SelectInput id="hm-status" value={values.status} onChange={pick("status")} options={STATUSES} />
          </Field>
          <Field label="Country" htmlFor="hm-country">
            <input id="hm-country" className={inputClass} value={values.country} onChange={set("country")} />
          </Field>
          <Field label="Country code" hint="ISO or calling code" htmlFor="hm-code">
            <input id="hm-code" className={inputClass} value={values.countryCode} onChange={set("countryCode")} />
          </Field>
          <Field label="Quality" htmlFor="hm-quality">
            <SelectInput id="hm-quality" value={values.quality} onChange={pick("quality")} options={QUALITIES} />
          </Field>
        </div>
        <Field label="Content" hint="message, conversation, anything long" htmlFor="hm-content">
          <textarea id="hm-content" rows={8} className={textareaClass} value={values.content} onChange={set("content")} />
        </Field>
        {isEdit ? <p className="text-xs text-gray-500 dark:text-gray-400">Updated {new Date(person.updatedAt).toLocaleString()}</p> : null}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : isEdit ? "Update" : "Add"}</Button>
        </div>
      </form>
    </Modal>
  );
}
