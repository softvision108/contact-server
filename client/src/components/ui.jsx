import { useEffect } from "react";
import { twMerge } from "tailwind-merge";

import { PER_PAGE_OPTIONS, STATUSES, STATUS_TONE } from "../constants.js";
import { CloseIcon, MailIcon } from "./icons.jsx";

// The lg24 admin-frontend's base pieces (Button, Badge, Input, Label, ListUi, Pagination, modal).

export function Button({ children, size = "md", variant = "primary", startIcon, className = "", disabled = false, type = "button", ...rest }) {
  const sizes = { xs: "px-3 py-2 text-sm", sm: "px-4 py-3 text-sm", md: "px-5 py-3.5 text-sm" };
  const variants = {
    primary: "bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300",
    outline:
      "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300",
    danger: "bg-error-500 text-white shadow-theme-xs hover:bg-error-600 disabled:bg-error-300",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition ${className} ${sizes[size]} ${variants[variant]} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      {...rest}
    >
      {startIcon ? <span className="flex items-center">{startIcon}</span> : null}
      {children}
    </button>
  );
}

const TONE = {
  success: "bg-success-50 text-success-700 ring-success-600/20 dark:bg-success-500/15 dark:text-success-400 dark:ring-success-500/30",
  warning: "bg-warning-50 text-warning-700 ring-warning-600/20 dark:bg-warning-500/15 dark:text-warning-400 dark:ring-warning-500/30",
  error: "bg-error-50 text-error-700 ring-error-600/20 dark:bg-error-500/15 dark:text-error-400 dark:ring-error-500/30",
  info: "bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/30",
  neutral: "bg-gray-100 text-gray-700 ring-gray-500/20 dark:bg-white/10 dark:text-gray-300 dark:ring-white/15",
};
const DOT = { success: "bg-success-500", warning: "bg-warning-500", error: "bg-error-500", info: "bg-brand-500", neutral: "bg-gray-400 dark:bg-gray-500" };

export function Badge({ tone = "neutral", children, dot = true, className }) {
  return (
    <span className={twMerge("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ring-1 ring-inset", TONE[tone], className)}>
      {dot ? <span aria-hidden="true" className={twMerge("h-1.5 w-1.5 shrink-0 rounded-full", DOT[tone])} /> : null}
      {children}
    </span>
  );
}

export const inputClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800";
export const selectClass = `${inputClass} appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%23667085' stroke-width='1.5' viewBox='0 0 20 20'%3E%3Cpath d='M5 8l5 5 5-5'/%3E%3C/svg%3E")] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10`;
export const textareaClass = inputClass.replace("h-11", "min-h-24").replace("py-2.5", "py-3");

export function Label({ htmlFor, children, className }) {
  return (
    <label htmlFor={htmlFor} className={twMerge("mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400", className)}>
      {children}
    </label>
  );
}

export function Field({ label, htmlFor, hint, className, children }) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label} {hint ? <span className="text-xs font-normal text-gray-500">({hint})</span> : null}
      </Label>
      {children}
    </div>
  );
}

export function SelectInput({ value, onChange, options, placeholder, id, className = "" }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${selectClass} ${className}`}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((o) => {
        const item = typeof o === "string" ? { value: o, label: o } : o;
        return <option key={item.value} value={item.value}>{item.label}</option>;
      })}
    </select>
  );
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h3>
        {description ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function FilterPanel({ children, onSearch, onClear }) {
  return (
    <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
      >
        {children}
        <div className="flex items-end gap-2">
          <Button className="flex-1" size="sm" type="submit">Search</Button>
          <Button variant="outline" size="sm" onClick={onClear}>Clear</Button>
        </div>
      </form>
    </div>
  );
}

const STAT_VALUE = {
  ready: "text-gray-800 dark:text-white/90",
  sent: "text-brand-500 dark:text-brand-400",
  replied: "text-success-600 dark:text-success-500",
  blocked: "text-error-600 dark:text-error-500",
};

// Summary cards per status; clicking one filters the list (click again to clear).
export function StatusSummary({ stats, allLabel, value, onChange }) {
  const card = (key, label, count, valueClass) => (
    <button
      key={key}
      type="button"
      onClick={() => onChange(key === "" || value === key ? "" : key)}
      className={`rounded-2xl border bg-white p-4 text-left transition dark:bg-white/[0.03] ${
        value === key ? "border-brand-300 ring-3 ring-brand-500/10 dark:border-brand-800" : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
      }`}
    >
      <p className="text-sm text-gray-500 capitalize dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${valueClass}`}>{count ?? "–"}</p>
    </button>
  );
  return (
    <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {card("", allLabel, stats?.total, "text-gray-800 dark:text-white/90")}
      {STATUSES.map((s) => card(s, s, stats?.byStatus[s], STAT_VALUE[s]))}
    </div>
  );
}

export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONE[status]} className="capitalize">{status}</Badge>;
}

// Inline status picker for a table row.
export function StatusSelect({ value, disabled, onChange }) {
  const color = {
    ready: "text-gray-700 dark:text-gray-300",
    sent: "text-brand-600 dark:text-brand-400",
    replied: "text-success-600 dark:text-success-400",
    blocked: "text-error-600 dark:text-error-400",
  }[value];
  return (
    <select
      value={value}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm font-medium capitalize focus:border-brand-300 focus:outline-none dark:border-gray-700 dark:bg-gray-900 ${color}`}
    >
      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

export const thClass = "px-5 py-4 text-left text-sm font-medium whitespace-nowrap text-gray-500 dark:text-gray-400";
export const tdClass = "px-5 py-4 text-sm text-gray-600 dark:text-gray-300";

export function DataTable({ headers, isLoading, isEmpty, emptyText, error, onRetry, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {error ? (
        <div className="p-8 text-center text-error-500">
          {error}{" "}
          {onRetry ? <button type="button" onClick={onRetry} className="ml-2 text-brand-500 hover:underline">Retry</button> : null}
        </div>
      ) : isLoading && isEmpty ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
      ) : isEmpty ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">{emptyText}</div>
      ) : (
        <div className="custom-scrollbar overflow-x-auto">
          <table className={`w-full ${isLoading ? "opacity-60" : ""}`}>
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                {headers.map((h) => (
                  <th key={h.key} className={`${thClass} ${h.className || ""}`}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const rowClass = "cursor-pointer border-b border-gray-200 transition-colors last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5";

export function RowActions({ onEmail, onEdit, onDelete, disabled }) {
  return (
    <div className="flex items-center justify-end gap-2">
      {onEmail ? (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); onEmail(); }}
          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-brand-400"
          title="Send email"
        >
          <MailIcon />
        </button>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="rounded-lg p-2 text-brand-500 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-brand-400 dark:hover:bg-brand-500/10"
        title="Edit"
      >
        <PencilGlyph />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="rounded-lg p-2 text-error-500 transition-colors hover:bg-error-50 hover:text-error-600 dark:text-error-400 dark:hover:bg-error-500/10"
        title="Delete"
      >
        <TrashGlyph />
      </button>
    </div>
  );
}

function PencilGlyph() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.86 4.49l2.65 2.65M4 20l4.5-1 10.06-10.06a1.87 1.87 0 000-2.65l-.85-.85a1.87 1.87 0 00-2.65 0L5 15.5 4 20z" />
    </svg>
  );
}

function TrashGlyph() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

function pagesToShow(page, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(1, page - 1);
  const end = Math.min(total, page + 1);
  const pages = [];
  if (start > 2) {
    pages.push(1);
    if (start > 3) pages.push(-1);
  }
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) {
    if (end < total - 2) pages.push(-1);
    pages.push(total);
  }
  return pages;
}

const pagerBtn =
  "flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]";

// Rows per page on the left, total and pages on the right (lg24 ListPager).
export function ListPager({ page, totalPages, total, perPage, onPageChange, onPerPageChange }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          Per page
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm text-gray-800 focus:border-brand-300 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          >
            {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <span className="text-sm text-gray-500 dark:text-gray-400">{total} total</span>
      </div>
      {totalPages > 1 ? (
        <div className="flex items-center">
          <button type="button" className={`mr-2.5 ${pagerBtn}`} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
          <div className="flex items-center gap-2">
            {pagesToShow(page, totalPages).map((p, i) =>
              p === -1 ? (
                <span key={`gap-${i}`} className="px-2 text-gray-500">...</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium hover:bg-blue-500/[0.08] hover:text-brand-500 ${
                    page === p ? "bg-brand-500 text-white hover:bg-brand-500 hover:text-white" : "text-gray-700 dark:text-gray-400"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
          </div>
          <button type="button" className={`ml-2.5 ${pagerBtn}`} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
        </div>
      ) : null}
    </div>
  );
}

// Centered modal like the lg24 admin's edit dialogs. It never grows past the window:
// the title stays on top and the body scrolls, so long forms are never cut off.
export function Modal({ isOpen, onClose, title, maxWidth = "max-w-md", children }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-999999 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 dark:bg-black/80" onClick={onClose} />
      <div
        className={`relative z-10 flex max-h-[calc(100dvh-2rem)] w-full ${maxWidth} flex-col rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900`}
        role="dialog"
        aria-label={title}
      >
        <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <CloseIcon />
          </button>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

export function ErrorBox({ children }) {
  return children ? <div className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-500 dark:bg-error-500/10">{children}</div> : null;
}

export function ConfirmDelete({ target, describe, loading, onClose, onConfirm }) {
  return (
    <Modal isOpen={Boolean(target)} onClose={() => !loading && onClose()} title="Are you sure ?">
      <p className="text-sm text-gray-600 dark:text-gray-400">{target ? describe(target) : ""}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="danger" size="sm" onClick={() => onConfirm(target)} disabled={loading}>{loading ? "Please wait…" : "Delete"}</Button>
      </div>
    </Modal>
  );
}

export function SectionTitle({ children }) {
  return <p className="mt-6 mb-3 border-t border-gray-200 pt-5 text-xs tracking-wide text-gray-400 uppercase dark:border-gray-800">{children}</p>;
}

const checkboxClass = "h-4 w-4 cursor-pointer rounded border-gray-300 accent-brand-500 dark:border-gray-700";

// Header checkbox for a selectable table: ticks the whole page.
export function SelectAllBox({ selection, pageIds }) {
  const picked = pageIds.filter((id) => selection.has(id)).length;
  return (
    <input
      type="checkbox"
      aria-label="Select all rows on this page"
      className={checkboxClass}
      checked={pageIds.length > 0 && picked === pageIds.length}
      ref={(el) => el && (el.indeterminate = picked > 0 && picked < pageIds.length)}
      onChange={() => selection.togglePage(pageIds)}
    />
  );
}

export function SelectCell({ selection, id }) {
  return (
    <td className="w-10 py-4 pr-0 pl-5" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" aria-label="Select row" className={checkboxClass} checked={selection.has(id)} onChange={() => selection.toggle(id)} />
    </td>
  );
}

// Shown above the table while rows are ticked.
export function SelectionBar({ selection, children }) {
  if (!selection.size) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-3 dark:border-brand-500/30 dark:bg-brand-500/10">
      <span className="text-sm font-medium text-brand-700 dark:text-brand-300">{selection.size} selected</span>
      {children}
      <button type="button" onClick={selection.clear} className="ml-auto text-sm text-gray-500 hover:text-gray-700 hover:underline dark:text-gray-400 dark:hover:text-gray-200">
        Clear selection
      </button>
    </div>
  );
}

// Last email sent to a row (or why it failed), under its status.
export function MailInfo({ row }) {
  if (row.lastEmailError) {
    return <p className="mt-1 max-w-40 truncate text-xs text-error-500" title={row.lastEmailError}>Email failed</p>;
  }
  if (!row.lastEmailAt) return null;
  const when = new Date(row.lastEmailAt);
  return (
    <p className="mt-1 text-xs whitespace-nowrap text-gray-500 dark:text-gray-400" title={`${row.lastEmailSubject}\n${row.lastEmailFrom ? `from ${row.lastEmailFrom}\n` : ""}${when.toLocaleString()}`}>
      Emailed {when.toLocaleDateString()}{row.emailCount > 1 ? ` (${row.emailCount}×)` : ""}
    </p>
  );
}
