import { useEffect, useState } from "react";

import { api } from "../api.js";
import { Badge, Button, ErrorBox, Field, Modal, inputClass, textareaClass } from "../components/ui.jsx";

const DRAFT_KEY = "contact-server-mail-draft";
const STATE_TONE = { sent: "success", failed: "error", skipped: "warning", sending: "info" };

function loadDraft() {
  try {
    return { subject: "", body: "", ...JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") };
  } catch {
    return { subject: "", body: "" };
  }
}

function saveDraft(draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // private window: the draft is just not remembered
  }
}

// Compose one message, send it to every selected row (one email per row), and follow the progress.
// `list` is the API list name (providers, people, licenses, streamers); `fields` lists extra {{placeholders}}.
// `recipient` names the row when the window was opened from one row's email button.
export default function SendMailModal({ isOpen, list, ids, recipient, fields = [], onClose, onFinished }) {
  const [draft, setDraft] = useState(loadDraft);
  const [allEmails, setAllEmails] = useState(false);
  const [mailConfig, setMailConfig] = useState(null);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setJob(null);
    setError("");
    api("/mail/config").then(setMailConfig).catch((err) => setError(err.message));
  }, [isOpen]);

  // Poll the running job; tell the page once it is done so it reloads the rows.
  useEffect(() => {
    if (!job || job.finished) return undefined;
    const timer = setTimeout(() => {
      api(`/mail/jobs/${job.id}`)
        .then((next) => {
          setJob(next);
          if (next.finished) onFinished();
        })
        .catch((err) => setError(err.message));
    }, 1500);
    return () => clearTimeout(timer);
  }, [job, onFinished]);

  const set = (k) => (e) => {
    const next = { ...draft, [k]: e.target.value };
    setDraft(next);
    saveDraft(next);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError("");
    if (!draft.subject.trim() || !draft.body.trim()) return setError("Subject and message are required");
    setIsStarting(true);
    try {
      setJob(await api("/mail/send", { method: "POST", body: { list, ids, subject: draft.subject, body: draft.body, allEmails } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsStarting(false);
    }
  };

  const isRunning = Boolean(job && !job.finished);
  const placeholders = ["name", "email", ...fields].map((f) => `{{${f}}}`).join("  ");

  return (
    <Modal isOpen={isOpen} onClose={() => !isRunning && onClose()} title={recipient ? `Send email to ${recipient}` : `Send email to ${ids.length} selected`} maxWidth="max-w-3xl">
      <ErrorBox>{error}</ErrorBox>
      {mailConfig && !mailConfig.configured ? (
        <ErrorBox>Email is not set up yet: fill RESEND_API_KEY and RESEND_FROM in server/.env, then restart the API.</ErrorBox>
      ) : null}
      {mailConfig?.dryRun ? (
        <div className="mb-4 rounded-lg bg-warning-50 p-3 text-sm text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
          Dry run is on (MAIL_DRY_RUN=true): nothing is really sent, but rows are still marked as emailed.
        </div>
      ) : null}

      {job ? (
        <div>
          <div className="mb-2 flex justify-between text-sm text-gray-600 dark:text-gray-300">
            <span>{job.finished ? "Finished" : "Sending..."} {job.done} / {job.total}</span>
            <span>
              <span className="text-success-600">{job.sent} sent</span> · <span className="text-error-500">{job.failed} failed</span> · <span className="text-warning-600">{job.skipped} skipped</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${(job.done / job.total) * 100}%` }} />
          </div>
          {!job.finished ? <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Keep this window open; emails go out one by one with a short pause between them.</p> : null}
          <ul className="mt-4 divide-y divide-gray-200 text-sm dark:divide-gray-800">
            {job.results.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <Badge tone={STATE_TONE[r.state]} dot={false} className="capitalize">{r.state}</Badge>
                <span className="truncate text-gray-800 dark:text-white/90">{r.name || r.id}</span>
                <span className="ml-auto max-w-72 truncate text-xs text-gray-500 dark:text-gray-400" title={r.error || r.to}>{r.error || r.to}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-end">
            <Button onClick={onClose} disabled={isRunning}>{isRunning ? "Sending..." : "Close"}</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSend}>
          {mailConfig ? (
            <div className="mb-4 flex flex-wrap justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>From: {mailConfig.from}</span>
              <span className={mailConfig.remaining < ids.length ? "text-warning-600" : ""}>
                Today: {mailConfig.sentToday} / {mailConfig.dailyLimit} sent, {mailConfig.remaining} left
              </span>
            </div>
          ) : null}
          {mailConfig && mailConfig.remaining === 0 ? <ErrorBox>The daily email limit is reached. Raise it in Settings &gt; Mail or wait until tomorrow (UTC).</ErrorBox> : null}
          <Field label="Subject" htmlFor="mail-subject">
            <input id="mail-subject" className={inputClass} value={draft.subject} onChange={set("subject")} />
          </Field>
          <Field label="Message" hint={`placeholders: ${placeholders}`} htmlFor="mail-body" className="mt-4">
            <textarea id="mail-body" rows={12} className={textareaClass} value={draft.body} onChange={set("body")} placeholder={"Hi {{name}},\n\n..."} />
          </Field>
          <label className="mt-4 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={allEmails} onChange={(e) => setAllEmails(e.target.checked)} />
            Send to every address of a row (otherwise only its first email)
          </label>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            One email per row. Rows without an email or with status &quot;blocked&quot; are skipped, and so are rows past the daily limit. A row that was &quot;ready&quot; becomes &quot;sent&quot;.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isStarting || !mailConfig?.configured || !mailConfig?.remaining}>{isStarting ? "Starting..." : recipient ? "Send email" : `Send ${ids.length} emails`}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
