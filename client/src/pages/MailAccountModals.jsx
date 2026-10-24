import { useEffect, useState } from "react";

import { api } from "../api.js";
import { Button, ErrorBox, Field, Modal, SelectInput, inputClass } from "../components/ui.jsx";

function Toggle({ checked, onChange, children }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

// Shared shape of both modals: fill `values`, send them, report the saved record.
function useForm(isOpen, initial, save, onSaved) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // reset only when the window opens, not on every render's fresh `initial`
  useEffect(() => {
    if (isOpen) {
      setValues(initial);
      setError("");
    }
  }, [isOpen]);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e?.target ? e.target.value : e }));
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      onSaved(await save(values));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };
  return { values, set, error, isSaving, handleSubmit };
}

// Add or edit one Resend account. The saved key is never shown again; leave it empty to keep it.
export function IntegrationModal({ isOpen, integration, onClose, onSaved }) {
  const initial = { name: integration?.name || "", apiKey: "", enabled: integration?.enabled ?? true };
  const save = (v) =>
    integration ? api(`/mail/integrations/${integration.id}`, { method: "PUT", body: v }) : api("/mail/integrations", { method: "POST", body: v });
  const { values, set, error, isSaving, handleSubmit } = useForm(isOpen, initial, save, onSaved);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={integration ? `Edit ${integration.name}` : "Add Resend account"}>
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name" hint="only shown in this app" htmlFor="int-name">
          <input id="int-name" className={inputClass} value={values.name} onChange={set("name")} placeholder="Resend 2" />
        </Field>
        <Field label="API key" hint={integration ? `saved: ${integration.apiKeyHint}, leave empty to keep it` : "re_..."} htmlFor="int-key">
          <input id="int-key" type="password" autoComplete="off" className={inputClass} value={values.apiKey} onChange={set("apiKey")} />
        </Field>
        {integration ? <Toggle checked={values.enabled} onChange={set("enabled")}>Account is on (off: none of its senders can send)</Toggle> : null}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          The key is stored encrypted. A key with &quot;Full access&quot; also lets the Test button check the account&apos;s domains; &quot;Sending access&quot; is enough to send.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// Add or edit one From address. `integrationId` picks the account when adding from its card.
export function SenderModal({ isOpen, sender, integrationId, integrations, onClose, onSaved }) {
  const initial = {
    integration: sender?.integration || integrationId || integrations[0]?.id || "",
    name: sender?.name || "",
    email: sender?.email || "",
    replyTo: sender?.replyTo || "",
    enabled: sender?.enabled ?? true,
  };
  const save = (v) => (sender ? api(`/mail/senders/${sender.id}`, { method: "PUT", body: v }) : api("/mail/senders", { method: "POST", body: v }));
  const { values, set, error, isSaving, handleSubmit } = useForm(isOpen, initial, save, onSaved);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={sender ? `Edit ${sender.from}` : "Add sender"}>
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Resend account" htmlFor="snd-int">
          <SelectInput id="snd-int" value={values.integration} onChange={set("integration")} options={integrations.map((i) => ({ value: i.id, label: i.name }))} />
        </Field>
        <Field label="Sender name" hint="shown to the recipient" htmlFor="snd-name">
          <input id="snd-name" className={inputClass} value={values.name} onChange={set("name")} placeholder="Lin Chung" />
        </Field>
        <Field label="From address" hint="on a domain verified in that Resend account" htmlFor="snd-email">
          <input id="snd-email" type="email" className={inputClass} value={values.email} onChange={set("email")} placeholder="support@itstaff.io" />
        </Field>
        <Field label="Reply-to" hint="optional" htmlFor="snd-reply">
          <input id="snd-reply" type="email" className={inputClass} value={values.replyTo} onChange={set("replyTo")} />
        </Field>
        {sender ? <Toggle checked={values.enabled} onChange={set("enabled")}>Sender is on</Toggle> : null}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}
