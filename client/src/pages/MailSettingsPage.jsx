import { useCallback, useEffect, useState } from "react";

import { api } from "../api.js";
import { Badge, Button, ConfirmDelete, ErrorBox, Field, PageHeader, inputClass } from "../components/ui.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { IntegrationModal, SenderModal } from "./MailAccountModals.jsx";

function Card({ title, action, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Usage({ sent, limit, remaining, label }) {
  const pct = Math.min(100, limit ? (sent / limit) * 100 : 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{label ? `${label}: ` : ""}{sent} / {limit} today</span>
        <span>{remaining} left</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className={`h-full transition-all ${remaining ? "bg-brand-500" : "bg-error-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const DOMAIN_TONE = { verified: "success", missing: "error", unknown: "neutral" };

function TestResult({ result }) {
  if (!result) return null;
  if (!result.ok) return <p className="mt-3 text-sm text-error-500">Key refused: {result.error}</p>;
  return (
    <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
      <p>
        Key works.{" "}
        {result.restricted ? "It has sending access only, so the domains cannot be checked." : `Domains: ${result.domains.map((d) => `${d.name} (${d.status})`).join(", ") || "none"}`}
      </p>
      {result.restricted
        ? null
        : result.senders.map((s) => (
            <p key={s.id} className="mt-1 flex items-center gap-2">
              <Badge tone={DOMAIN_TONE[s.status] || "warning"}>{s.status}</Badge> {s.from}
            </p>
          ))}
    </div>
  );
}

// Global limits, the Resend accounts (integrations) and their senders, with today's counts.
export default function MailSettingsPage() {
  const notify = useToast();
  const [mailConfig, setMailConfig] = useState(null);
  const [form, setForm] = useState({ limit: "", pause: "" });
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // { integration } to add/edit an account; { sender, integrationId } to add/edit a sender
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [tests, setTests] = useState({});

  const load = useCallback(async () => {
    setError("");
    try {
      const c = await api("/mail/config");
      setMailConfig(c);
      setForm({ limit: String(c.dailyLimit), pause: String(c.delayMs / 1000) });
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    const dailyLimit = Number(form.limit);
    const delayMs = Math.round(Number(form.pause) * 1000);
    if (!Number.isInteger(dailyLimit) || dailyLimit < 0) return setError("Daily limit must be a whole number, 0 or more");
    if (!Number.isFinite(delayMs) || delayMs < 0 || delayMs > 60000) return setError("Pause must be from 0 to 60 seconds");
    setIsSaving(true);
    try {
      const next = await api("/mail/settings", { method: "PUT", body: { dailyLimit, delayMs } });
      setMailConfig((c) => ({ ...c, ...next }));
      notify(`Daily limit set to ${dailyLimit} per sender`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaved = (what) => () => {
    setEditing(null);
    notify(`${what} saved`);
    void load();
  };

  const handleDelete = async (target) => {
    setIsDeleting(true);
    try {
      await api(target.kind === "integration" ? `/mail/integrations/${target.id}` : `/mail/senders/${target.id}`, { method: "DELETE" });
      notify(`${target.label} deleted`);
      setDeleting(null);
      void load();
    } catch (err) {
      setDeleting(null);
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTest = async (id) => {
    setTests((t) => ({ ...t, [id]: { testing: true } }));
    try {
      const result = await api(`/mail/integrations/${id}/test`, { method: "POST" });
      setTests((t) => ({ ...t, [id]: { result } }));
    } catch (err) {
      setTests((t) => ({ ...t, [id]: { result: { ok: false, error: err.message } } }));
    }
  };

  const integrations = mailConfig?.integrations || [];
  const sendersOf = (id) => (mailConfig?.senders || []).filter((s) => s.integration === id);

  return (
    <div>
      <PageHeader
        title="Mail settings"
        description="The Resend accounts and senders the app sends with, and how many emails each may send per day."
        action={<Button size="sm" onClick={() => setEditing({ integration: null })} disabled={!mailConfig}>Add Resend account</Button>}
      />
      <ErrorBox>{error}</ErrorBox>
      {mailConfig?.dryRun ? (
        <div className="mb-4 rounded-lg bg-warning-50 p-3 text-sm text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
          Dry run is on (MAIL_DRY_RUN=true in server/.env): nothing is really sent.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Limits">
          <form onSubmit={handleSave}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Emails per day" hint="default 100, 0 stops sending" htmlFor="daily-limit">
                <input id="daily-limit" type="number" min="0" step="1" className={inputClass} value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} />
              </Field>
              <Field label="Pause between emails" hint="seconds" htmlFor="mail-pause">
                <input id="mail-pause" type="number" min="0" max="60" step="0.5" className={inputClass} value={form.pause} onChange={(e) => setForm({ ...form, pause: e.target.value })} />
              </Field>
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              The limit applies to each sender, and also to the total of each Resend account, since Resend&apos;s free plan allows 100 a day per account.
              Counted per recipient address and reset at 00:00 UTC. When it is reached, the remaining rows of a send are skipped.
            </p>
            <div className="mt-5 flex justify-end">
              <Button type="submit" size="sm" disabled={isSaving || !mailConfig}>{isSaving ? "Saving..." : "Save"}</Button>
            </div>
          </form>
        </Card>

        {mailConfig && !integrations.length ? (
          <Card title="No Resend account yet">
            <p className="text-sm text-gray-500 dark:text-gray-400">Add a Resend account with its API key, then add the sender addresses of its verified domain.</p>
          </Card>
        ) : null}

        {integrations.map((i) => {
          const test = tests[i.id];
          return (
            <Card
              key={i.id}
              title={
                <span className="flex items-center gap-2">
                  {i.name} {i.enabled ? <Badge tone="success">on</Badge> : <Badge tone="error">off</Badge>}
                </span>
              }
              action={
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="xs" onClick={() => handleTest(i.id)} disabled={test?.testing}>{test?.testing ? "Testing..." : "Test"}</Button>
                  <Button variant="outline" size="xs" onClick={() => setEditing({ integration: i })}>Edit</Button>
                  <Button variant="outline" size="xs" onClick={() => setDeleting({ kind: "integration", id: i.id, label: i.name })}>Delete</Button>
                </div>
              }
            >
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Resend · key {i.apiKeyHint}</p>
              <Usage label="Account" sent={i.sentToday} limit={mailConfig.dailyLimit} remaining={i.remaining} />
              <TestResult result={test?.result} />

              <div className="mt-5 flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Senders</h4>
                <Button size="xs" variant="outline" onClick={() => setEditing({ sender: null, integrationId: i.id })}>Add sender</Button>
              </div>
              <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
                {sendersOf(i.id).map((s) => (
                  <li key={s.id} className="py-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-gray-800 dark:text-white/90">{s.from}</span>
                      {s.enabled ? null : <Badge tone="error">off</Badge>}
                      {s.replyTo ? <span className="text-xs text-gray-500 dark:text-gray-400">reply-to {s.replyTo}</span> : null}
                      <span className="ml-auto flex gap-3 text-xs">
                        <button type="button" className="text-brand-500 hover:underline" onClick={() => setEditing({ sender: s })}>Edit</button>
                        <button type="button" className="text-error-500 hover:underline" onClick={() => setDeleting({ kind: "sender", id: s.id, label: s.from })}>Delete</button>
                      </span>
                    </div>
                    <Usage sent={s.sentToday} limit={mailConfig.dailyLimit} remaining={s.remaining} />
                  </li>
                ))}
                {sendersOf(i.id).length ? null : <li className="py-3 text-sm text-gray-500 dark:text-gray-400">No sender yet.</li>}
              </ul>
            </Card>
          );
        })}
      </div>
      {mailConfig ? <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">Day {mailConfig.day} (UTC) · <button type="button" className="hover:underline" onClick={load}>Refresh</button></p> : null}

      <IntegrationModal
        isOpen={Boolean(editing && "integration" in editing)}
        integration={editing?.integration}
        onClose={() => setEditing(null)}
        onSaved={handleSaved("Resend account")}
      />
      <SenderModal
        isOpen={Boolean(editing && "sender" in editing)}
        sender={editing?.sender}
        integrationId={editing?.integrationId}
        integrations={integrations}
        onClose={() => setEditing(null)}
        onSaved={handleSaved("Sender")}
      />
      <ConfirmDelete
        target={deleting}
        describe={(t) => (t.kind === "integration" ? `Delete the Resend account ${t.label}? Its saved API key is removed.` : `Delete the sender ${t.label}?`)}
        loading={isDeleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
