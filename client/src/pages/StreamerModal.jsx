import { useEffect, useState } from "react";

import { api } from "../api.js";
import { Button, ErrorBox, Field, Modal, SectionTitle, SelectInput, inputClass, textareaClass } from "../components/ui.jsx";
import { linesToText } from "../components/useListPage.js";
import { PLATFORMS, STATUSES, channelUrl } from "../constants.js";
import { useToast } from "../context/ToastContext.jsx";

const TEXT = [["displayName", "Display name"], ["category", "Category"], ["language", "Language"], ["country", "Country"]];
const NUMBERS = [["followers", "Followers"], ["viewers", "Viewers (last seen live)"]];
const LISTS = [["emails", "Emails"], ["socials", "Links (Instagram, X, Discord, Telegram...)"], ["notes", "Notes"]];
const EMPTY = {
  platform: "kick", username: "", status: "ready", verified: false, bio: "", lastTitle: "", content: "",
  ...Object.fromEntries([...TEXT, ...NUMBERS, ...LISTS].map(([k]) => [k, ""])),
};

function toValues(s) {
  const v = { ...EMPTY };
  for (const k of ["platform", "username", "status", "bio", "lastTitle", "content", ...TEXT.map(([k]) => k)]) v[k] = s[k] ?? "";
  for (const [k] of NUMBERS) v[k] = s[k] ?? "";
  for (const [k] of LISTS) v[k] = linesToText(s[k]);
  v.verified = Boolean(s.verified);
  return v;
}

export default function StreamerModal({ isOpen, id, onClose, onSaved }) {
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
    api(`/streamers/${id}`)
      .then((s) => {
        setValues(toValues(s));
        setMeta(s);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [isOpen, id]);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const pick = (k) => (value) => setValues((v) => ({ ...v, [k]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!values.username.trim()) return setError("Username is required");
    setIsSubmitting(true);
    try {
      const saved = await api(isEdit ? `/streamers/${id}` : "/streamers", { method: isEdit ? "PUT" : "POST", body: values });
      notify(isEdit ? `${saved.username} updated` : `${saved.username} added`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit ${meta?.displayName || meta?.username || "Streamer"}` : "Add Streamer"} maxWidth="max-w-4xl">
      <ErrorBox>{error}</ErrorBox>
      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label="Platform" htmlFor="sm-platform">
              <SelectInput id="sm-platform" value={values.platform} onChange={pick("platform")} options={PLATFORMS} />
            </Field>
            <Field label={<>Username <span className="text-error-500">*</span></>} htmlFor="sm-username" className="sm:col-span-2">
              <input id="sm-username" className={inputClass} value={values.username} onChange={set("username")} placeholder="as in the channel URL" />
            </Field>
            <Field label="Status" htmlFor="sm-status">
              <SelectInput id="sm-status" value={values.status} onChange={pick("status")} options={STATUSES} />
            </Field>
          </div>
          {values.username.trim() ? (
            <a href={channelUrl({ platform: values.platform, username: values.username.trim() })} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-brand-500 hover:underline dark:text-brand-400">
              Open channel ↗
            </a>
          ) : null}

          <Field label="Content" hint="message, conversation, anything long" htmlFor="sm-content" className="mt-4">
            <textarea id="sm-content" rows={7} className={textareaClass} value={values.content} onChange={set("content")} />
          </Field>

          <SectionTitle>Details</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TEXT.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`sm-${k}`}>
                <input id={`sm-${k}`} className={inputClass} value={values[k]} onChange={set(k)} />
              </Field>
            ))}
            {NUMBERS.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`sm-${k}`}>
                <input id={`sm-${k}`} type="number" min="0" className={inputClass} value={values[k]} onChange={set(k)} />
              </Field>
            ))}
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={values.verified} onChange={(e) => setValues((v) => ({ ...v, verified: e.target.checked }))} />
              Verified / partner
            </label>
          </div>
          <Field label="Bio" htmlFor="sm-bio" className="mt-4">
            <textarea id="sm-bio" rows={3} className={textareaClass} value={values.bio} onChange={set("bio")} />
          </Field>
          <Field label="Last stream title" htmlFor="sm-title" className="mt-4">
            <input id="sm-title" className={inputClass} value={values.lastTitle} onChange={set("lastTitle")} />
          </Field>

          <SectionTitle>Lists (one per line)</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {LISTS.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`sm-${k}`} className={k === "notes" ? "sm:col-span-2" : ""}>
                <textarea id={`sm-${k}`} rows={k === "notes" ? 5 : 3} className={textareaClass} value={values[k]} onChange={set(k)} />
              </Field>
            ))}
          </div>

          {meta ? (
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Sources: {(meta.sources || []).join(", ") || "—"}
              {meta.lastLiveAt ? ` · Last seen live ${new Date(meta.lastLiveAt).toLocaleString()}` : ""} · Updated {new Date(meta.updatedAt).toLocaleString()}
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
