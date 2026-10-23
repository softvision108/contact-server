import { useEffect, useState } from "react";

import { api } from "../api.js";
import { Button, ErrorBox, Field, Modal, SectionTitle, SelectInput, inputClass, textareaClass } from "../components/ui.jsx";
import { linesToText } from "../components/useListPage.js";
import { CATEGORIES, STATUSES } from "../constants.js";
import { useToast } from "../context/ToastContext.jsx";

const COMMERCIAL = [
  ["setupFee", "Setup fee"], ["monthlyMinimum", "Monthly minimum"], ["revenueShare", "Revenue share"],
  ["gameRoyalties", "Game royalties"], ["prepayment", "Prepayment"], ["sandbox", "Sandbox"],
  ["integration", "Integration"], ["markets", "Markets"], ["licenceEligibility", "Licence eligibility"],
  ["contractExit", "Contract exit"],
];
const TEXT = [
  ["website", "Website"], ["linkedin", "LinkedIn"], ["contactPage", "Contact page"], ["headquarters", "Headquarters"],
  ["gameCount", "Game count"], ["providerCount", "Provider count"], ["liveContent", "Live content"],
  ["isCasinoProvider", "Casino provider?"], ["pricing", "Pricing"], ["contact", "Contact / address"],
];
const LISTS = [["emails", "Emails"], ["phones", "Phones"], ["aliases", "Aliases"], ["urls", "Links"], ["notes", "Notes"]];

const EMPTY = {
  name: "", order: "", status: "ready", content: "", categories: [], shortlistRank: "", description: "",
  ...Object.fromEntries(TEXT.map(([k]) => [k, ""])),
  ...Object.fromEntries(LISTS.map(([k]) => [k, ""])),
  commercial: Object.fromEntries(COMMERCIAL.map(([k]) => [k, ""])),
};

function toValues(p) {
  const v = { ...EMPTY };
  for (const k of Object.keys(EMPTY)) if (typeof EMPTY[k] === "string" && p[k] != null) v[k] = String(p[k]);
  for (const [k] of LISTS) v[k] = linesToText(p[k]);
  v.categories = p.categories || [];
  v.commercial = { ...EMPTY.commercial, ...(p.commercial || {}) };
  return v;
}

export default function ProviderModal({ isOpen, id, onClose, onSaved }) {
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
    api(`/providers/${id}`)
      .then((p) => {
        setValues(toValues(p));
        setMeta(p);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [isOpen, id]);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const setCommercial = (k) => (e) => setValues((v) => ({ ...v, commercial: { ...v.commercial, [k]: e.target.value } }));
  const toggleCategory = (c) =>
    setValues((v) => ({ ...v, categories: v.categories.includes(c) ? v.categories.filter((x) => x !== c) : [...v.categories, c] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!values.name.trim()) return setError("Name is required");
    setIsSubmitting(true);
    try {
      const saved = await api(isEdit ? `/providers/${id}` : "/providers", { method: isEdit ? "PUT" : "POST", body: values });
      notify(isEdit ? `${saved.name} updated` : `${saved.name} added`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit ${meta?.name ?? "Provider"}` : "Add Provider"} maxWidth="max-w-4xl">
      <ErrorBox>{error}</ErrorBox>
      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label={<>Name <span className="text-error-500">*</span></>} htmlFor="pm-name" className="sm:col-span-2">
              <input id="pm-name" className={inputClass} value={values.name} onChange={set("name")} />
            </Field>
            <Field label="Order" hint="1 = most popular" htmlFor="pm-order">
              <input id="pm-order" type="number" min="1" className={inputClass} value={values.order} onChange={set("order")} />
            </Field>
            <Field label="Status" htmlFor="pm-status">
              <SelectInput id="pm-status" value={values.status} onChange={(s) => setValues((v) => ({ ...v, status: s }))} options={STATUSES} />
            </Field>
          </div>

          <Field label="Content" hint="message, conversation, anything long" htmlFor="pm-content" className="mt-4">
            <textarea id="pm-content" rows={7} className={textareaClass} value={values.content} onChange={set("content")} />
          </Field>

          <div className="mt-4">
            <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Categories</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = values.categories.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition ${
                      on ? "bg-brand-50 text-brand-600 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-800" : "text-gray-600 ring-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/5"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <SectionTitle>Details</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TEXT.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`pm-${k}`}>
                <input id={`pm-${k}`} className={inputClass} value={values[k]} onChange={set(k)} />
              </Field>
            ))}
            <Field label="Shortlist rank" htmlFor="pm-rank">
              <input id="pm-rank" type="number" min="1" className={inputClass} value={values.shortlistRank} onChange={set("shortlistRank")} />
            </Field>
          </div>

          <SectionTitle>Lists (one per line)</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {LISTS.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`pm-${k}`} className={k === "notes" ? "sm:col-span-2" : ""}>
                <textarea id={`pm-${k}`} rows={k === "notes" ? 5 : 3} className={textareaClass} value={values[k]} onChange={set(k)} />
              </Field>
            ))}
          </div>

          <SectionTitle>Commercial terms (from quotes)</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {COMMERCIAL.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`pc-${k}`}>
                <input id={`pc-${k}`} className={inputClass} value={values.commercial[k]} onChange={setCommercial(k)} />
              </Field>
            ))}
          </div>

          <SectionTitle>Description</SectionTitle>
          <textarea aria-label="Description" rows={4} className={textareaClass} value={values.description} onChange={set("description")} />

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
