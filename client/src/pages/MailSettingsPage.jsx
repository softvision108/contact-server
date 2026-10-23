import { useCallback, useEffect, useState } from "react";

import { api } from "../api.js";
import { Badge, Button, ErrorBox, Field, PageHeader, inputClass } from "../components/ui.jsx";
import { useToast } from "../context/ToastContext.jsx";

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 py-3 text-sm last:border-b-0 dark:border-gray-800">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-right text-gray-800 dark:text-white/90">{children}</span>
    </div>
  );
}

// Daily email limit (counted per recipient address, per UTC day) and how much of it is used today.
export default function MailSettingsPage() {
  const notify = useToast();
  const [mailConfig, setMailConfig] = useState(null);
  const [limit, setLimit] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const c = await api("/mail/config");
      setMailConfig(c);
      setLimit(String(c.dailyLimit));
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
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 0) return setError("Daily limit must be a whole number, 0 or more");
    setIsSaving(true);
    try {
      const u = await api("/mail/settings", { method: "PUT", body: { dailyLimit: n } });
      setMailConfig((c) => ({ ...c, ...u }));
      notify(`Daily email limit set to ${n}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const used = mailConfig ? Math.min(100, mailConfig.dailyLimit ? (mailConfig.sentToday / mailConfig.dailyLimit) * 100 : 100) : 0;

  return (
    <div>
      <PageHeader title="Mail settings" description="How many emails the app may send per day, and the Resend account it sends with." />
      <ErrorBox>{error}</ErrorBox>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Daily limit">
          <form onSubmit={handleSave}>
            <Field label="Emails per day" hint="default 100, 0 stops sending" htmlFor="daily-limit">
              <input id="daily-limit" type="number" min="0" step="1" className={inputClass} value={limit} onChange={(e) => setLimit(e.target.value)} />
            </Field>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Counted per recipient address and reset at 00:00 UTC, like Resend&apos;s own quota (the free plan allows 100 a day). When the limit is reached, the remaining rows of a send are skipped.
            </p>
            <div className="mt-5 flex justify-end">
              <Button type="submit" size="sm" disabled={isSaving || !mailConfig}>{isSaving ? "Saving..." : "Save"}</Button>
            </div>
          </form>
        </Card>

        <Card title="Today">
          {mailConfig ? (
            <>
              <div className="mb-2 flex justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>{mailConfig.sentToday} / {mailConfig.dailyLimit} sent</span>
                <span>{mailConfig.remaining} left</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div className={`h-full transition-all ${mailConfig.remaining ? "bg-brand-500" : "bg-error-500"}`} style={{ width: `${used}%` }} />
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Day {mailConfig.day} (UTC)</p>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          )}
        </Card>

        <Card title="Sender">
          {mailConfig ? (
            <>
              <Row label="Service">Resend</Row>
              <Row label="Status">
                {mailConfig.dryRun ? <Badge tone="warning">dry run</Badge> : mailConfig.configured ? <Badge tone="success">ready</Badge> : <Badge tone="error">no API key</Badge>}
              </Row>
              <Row label="From">{mailConfig.from}</Row>
              <Row label="Reply-to">{mailConfig.replyTo || "—"}</Row>
              <Row label="Pause between emails">{mailConfig.delayMs / 1000}s</Row>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                These come from server/.env (RESEND_API_KEY, RESEND_FROM, MAIL_REPLY_TO, MAIL_DELAY_MS, MAIL_DRY_RUN); change them there and restart the API.
              </p>
            </>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
