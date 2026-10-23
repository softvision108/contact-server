import { useEffect, useState } from "react";

import { api } from "../api.js";
import { Button, ErrorBox, Field, Modal, SectionTitle, SelectInput, inputClass, textareaClass } from "../components/ui.jsx";
import { linesToText } from "../components/useListPage.js";
import { LICENSE_CATEGORIES, STATUSES } from "../constants.js";
import { useToast } from "../context/ToastContext.jsx";

const TEXT = [
  ["website", "Website"], ["linkedin", "LinkedIn"], ["contactPage", "Contact page"], ["headquarters", "Headquarters"],
  ["pricing", "Pricing"], ["timeline", "Timeline"],
];
const LISTS = [
  ["jurisdictions", "Jurisdictions"], ["services", "Services"], ["emails", "Emails"], ["phones", "Phones"],
  ["aliases", "Aliases"], ["urls", "Links"], ["notes", "Notes"],
];
const EMPTY = {
  name: "", order: "", status: "ready", category: "", content: "",
  ...Object.fromEntries(TEXT.map(([k]) => [k, ""])),
  ...Object.fromEntries(LISTS.map(([k]) => [k, ""])),
};

function toValues(l) {
  const v = { ...EMPTY };
  for (const k of ["name", "status", "category", "content", ...TEXT.map(([k]) => k)]) v[k] = l[k] ?? "";
  v.order = l.order ?? "";
  for (const [k] of LISTS) v[k] = linesToText(l[k]);
  return v;
}

export default function LicenseModal({ isOpen, id, onClose, onSaved }) {
  const notify = useToast();
  const isEdit = Boolean(id);
  const [values, setValues] = useState(EMPTY);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setMeta(null);
    if (!id) {
      setValues(EMPTY);
      return;
    }
    setIsLoading(true);
    api(`/licenses/${id}`)
      .then((l) => {
        setValues(toValues(l));
        setMeta(l);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [isOpen, id]);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const pick = (k) => (value) => setValues((v) => ({ ...v, [k]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!values.name.trim()) return setError("Name is required");
    setIsSubmitting(true);
    try {
      const saved = await api(isEdit ? `/licenses/${id}` : "/licenses", { method: isEdit ? "PUT" : "POST", body: values });
      notify(isEdit ? `${saved.name} updated` : `${saved.name} added`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit ${meta?.name ?? "Company"}` : "Add Company"} maxWidth="max-w-4xl">
      <ErrorBox>{error}</ErrorBox>
      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label={<>Name <span className="text-error-500">*</span></>} htmlFor="lm-name" className="sm:col-span-2">
              <input id="lm-name" className={inputClass} value={values.name} onChange={set("name")} />
            </Field>
            <Field label="Type" htmlFor="lm-cat">
              <SelectInput id="lm-cat" value={values.category} onChange={pick("category")} options={LICENSE_CATEGORIES} placeholder="—" />
            </Field>
            <Field label="Status" htmlFor="lm-status">
              <SelectInput id="lm-status" value={values.status} onChange={pick("status")} options={STATUSES} />
            </Field>
            <Field label="Order" htmlFor="lm-order">
              <input id="lm-order" type="number" min="1" className={inputClass} value={values.order} onChange={set("order")} />
            </Field>
          </div>

          <Field label="Content" hint="message, conversation, anything long" htmlFor="lm-content" className="mt-4">
            <textarea id="lm-content" rows={7} className={textareaClass} value={values.content} onChange={set("content")} />
          </Field>

          <SectionTitle>Details</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TEXT.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`lm-${k}`}>
                <input id={`lm-${k}`} className={inputClass} value={values[k]} onChange={set(k)} />
              </Field>
            ))}
          </div>

          <SectionTitle>Lists (one per line)</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {LISTS.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`lm-${k}`} className={k === "notes" ? "sm:col-span-2" : ""}>
                <textarea id={`lm-${k}`} rows={k === "notes" ? 5 : 3} className={textareaClass} value={values[k]} onChange={set(k)} />
              </Field>
            ))}
          </div>

          {meta ? (
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Sources: {(meta.sources || []).join(", ") || "—"} · Updated {new Date(meta.updatedAt).toLocaleString()}
            </p>
          ) : null}
          <div className="sticky -bottom-6 -mx-6 -mb-6 mt-6 flex justify-end gap-3 rounded-b-2xl border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : isEdit ? "Update" : "Add"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
