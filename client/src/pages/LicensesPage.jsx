import { useEffect, useState } from "react";

import { api } from "../api.js";
import { MailIcon, PlusIcon } from "../components/icons.jsx";
import { Badge, Button, ConfirmDelete, DataTable, Field, FilterPanel, ListPager, MailInfo, PageHeader, RowActions, SelectAllBox, SelectCell, SelectInput, SelectionBar, StatusSelect, StatusSummary, inputClass, rowClass, tdClass } from "../components/ui.jsx";
import { shortUrl, useListPage, useSelection } from "../components/useListPage.js";
import { LICENSE_CATEGORIES, STATUSES } from "../constants.js";
import LicenseModal from "./LicenseModal.jsx";
import SendMailModal from "./SendMailModal.jsx";

const EMPTY_FILTERS = { q: "", status: "", category: "", jurisdiction: "", hasEmail: "", sort: "order" };
const SORTS = [
  { value: "order", label: "Order" },
  { value: "name", label: "Name" },
  { value: "updated", label: "Last updated" },
  { value: "status", label: "Status" },
];
const HEADERS = [
  { key: "order", label: "#" },
  { key: "name", label: "Company" },
  { key: "jurisdictions", label: "Jurisdictions" },
  { key: "website", label: "Website" },
  { key: "emails", label: "Emails" },
  { key: "pricing", label: "Pricing" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", className: "text-right" },
];
const CATEGORY_TONE = { regulator: "warning", "law-firm": "info", "licensing-agent": "success" };

export default function LicensesPage() {
  const list = useListPage("/licenses", EMPTY_FILTERS);
  const [jurisdictions, setJurisdictions] = useState([]);
  const [modal, setModal] = useState(null); // null | { id: null } | { id }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const selection = useSelection();
  const [mailTarget, setMailTarget] = useState(null); // null | { ids, recipient? }
  const pageIds = list.data.items.map((r) => r._id);

  useEffect(() => {
    api("/licenses/jurisdictions").then(setJurisdictions).catch(() => {});
  }, [list.data.total]);

  return (
    <div>
      <PageHeader
        title="License"
        description="Companies that help get a gambling licence (Anjouan, Curaçao, Malta and more), and the regulators."
        action={<Button size="sm" startIcon={<PlusIcon />} onClick={() => setModal({ id: null })}>Add Company</Button>}
      />

      <StatusSummary stats={list.stats} allLabel="All companies" value={list.filters.status} onChange={(v) => list.applyNow("status", v)} />

      <FilterPanel onSearch={list.search} onClear={list.clear}>
        <Field label="Search" htmlFor="lf-q" className="sm:col-span-2">
          <input id="lf-q" className={inputClass} placeholder="Name, email, website, HQ, services, content" value={list.draft.q} onChange={(e) => list.setDraftField("q", e.target.value)} />
        </Field>
        <Field label="Jurisdiction" htmlFor="lf-jur">
          <SelectInput id="lf-jur" value={list.draft.jurisdiction} onChange={(v) => list.setDraftField("jurisdiction", v)} options={jurisdictions.map((j) => ({ value: j.jurisdiction, label: `${j.jurisdiction} (${j.count})` }))} placeholder="All jurisdictions" />
        </Field>
        <Field label="Type" htmlFor="lf-cat">
          <SelectInput id="lf-cat" value={list.draft.category} onChange={(v) => list.setDraftField("category", v)} options={LICENSE_CATEGORIES} placeholder="All types" />
        </Field>
        <Field label="Status" htmlFor="lf-status">
          <SelectInput id="lf-status" value={list.draft.status} onChange={(v) => list.setDraftField("status", v)} options={STATUSES} placeholder="All statuses" />
        </Field>
        <Field label="Email" htmlFor="lf-email">
          <SelectInput id="lf-email" value={list.draft.hasEmail} onChange={(v) => list.setDraftField("hasEmail", v)} options={[{ value: "yes", label: "Has email" }, { value: "no", label: "No email" }]} placeholder="Any" />
        </Field>
        <Field label="Sort by" htmlFor="lf-sort">
          <SelectInput id="lf-sort" value={list.draft.sort} onChange={(v) => list.setDraftField("sort", v)} options={SORTS} />
        </Field>
      </FilterPanel>

      <SelectionBar selection={selection}>
        <Button size="sm" startIcon={<MailIcon className="h-5 w-5" />} onClick={() => setMailTarget({ ids: [...selection.ids] })}>Send email</Button>
      </SelectionBar>

      <DataTable headers={[{ key: "select", label: <SelectAllBox selection={selection} pageIds={pageIds} />, className: "w-10 pr-0" }, ...HEADERS]} isLoading={list.isLoading} isEmpty={list.data.items.length === 0} emptyText="No licence companies yet. Click &quot;Add Company&quot; or run the sync." error={list.error} onRetry={list.load}>
        {list.data.items.map((l) => (
          <tr key={l._id} className={rowClass} onClick={() => setModal({ id: l._id })}>
            <SelectCell selection={selection} id={l._id} />
            <td className={`${tdClass} text-gray-500`}>{l.order ?? "—"}</td>
            <td className="px-5 py-4">
              <p className="font-medium text-gray-800 dark:text-white/90">{l.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {l.category ? <Badge tone={CATEGORY_TONE[l.category] || "neutral"} dot={false}>{l.category}</Badge> : null}
                {l.headquarters ? <span className="max-w-48 truncate text-xs text-gray-500 dark:text-gray-400" title={l.headquarters}>{l.headquarters}</span> : null}
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="flex max-w-56 flex-wrap gap-1" title={l.jurisdictions.join(", ")}>
                {l.jurisdictions.slice(0, 4).map((j) => <Badge key={j} dot={false}>{j}</Badge>)}
                {l.jurisdictions.length > 4 ? <span className="text-xs text-gray-400">+{l.jurisdictions.length - 4}</span> : null}
              </div>
            </td>
            <td className={`${tdClass} max-w-44 truncate`}>
              {l.website ? (
                <a href={l.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-brand-500 hover:underline dark:text-brand-400">{shortUrl(l.website)}</a>
              ) : "—"}
            </td>
            <td className={`${tdClass} max-w-52`} title={l.emails.join(", ")}>
              {l.emails.length ? (
                <>
                  <p className="truncate">{l.emails[0]}</p>
                  {l.emails.length > 1 ? <p className="text-xs text-gray-400">+{l.emails.length - 1} more</p> : null}
                </>
              ) : "—"}
            </td>
            <td className={`${tdClass} max-w-48 truncate`} title={l.pricing}>{l.pricing || "—"}</td>
            <td className="px-5 py-4">
              <StatusSelect value={l.status} disabled={list.isMutating} onChange={(s) => void list.mutate(() => api(`/licenses/${l._id}`, { method: "PUT", body: { status: s } }), `${l.name}: status set to ${s}`)} />
              <MailInfo row={l} />
            </td>
            <td className="px-5 py-4">
              <RowActions disabled={list.isMutating} onEmail={() => setMailTarget({ ids: [l._id], recipient: l.name })} onEdit={() => setModal({ id: l._id })} onDelete={() => setDeleteTarget(l)} />
            </td>
          </tr>
        ))}
      </DataTable>

      <ListPager {...list.pager} />

      <SendMailModal
        isOpen={Boolean(mailTarget)}
        list="licenses"
        ids={mailTarget?.ids ?? []}
        recipient={mailTarget?.recipient}
        fields={["website", "headquarters"]}
        onClose={() => setMailTarget(null)}
        onFinished={list.load}
      />

      <LicenseModal
        isOpen={Boolean(modal)}
        id={modal?.id}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          void list.load();
        }}
      />
      <ConfirmDelete
        target={deleteTarget}
        describe={(l) => `Do you really want to delete "${l.name}"? This cannot be undone.`}
        loading={list.isMutating}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async (l) => {
          if (await list.mutate(() => api(`/licenses/${l._id}`, { method: "DELETE" }), `${l.name} deleted`)) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
