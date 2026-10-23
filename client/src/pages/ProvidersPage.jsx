import { useState } from "react";

import { api } from "../api.js";
import { MailIcon, PlusIcon } from "../components/icons.jsx";
import { Badge, Button, ConfirmDelete, DataTable, Field, FilterPanel, ListPager, MailInfo, PageHeader, RowActions, SelectAllBox, SelectCell, SelectInput, SelectionBar, StatusSelect, StatusSummary, inputClass, rowClass, tdClass } from "../components/ui.jsx";
import { shortUrl, useListPage, useSelection } from "../components/useListPage.js";
import { CATEGORIES, STATUSES } from "../constants.js";
import ProviderModal from "./ProviderModal.jsx";
import SendMailModal from "./SendMailModal.jsx";

const EMPTY_FILTERS = { q: "", status: "", category: "", hasEmail: "", sort: "order" };
const SORTS = [
  { value: "order", label: "Order (popularity)" },
  { value: "name", label: "Name" },
  { value: "updated", label: "Last updated" },
  { value: "status", label: "Status" },
  { value: "rank", label: "Shortlist rank" },
];
const HEADERS = [
  { key: "order", label: "#" },
  { key: "name", label: "Name" },
  { key: "categories", label: "Categories" },
  { key: "website", label: "Website" },
  { key: "emails", label: "Emails" },
  { key: "hq", label: "Headquarters" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", className: "text-right" },
];

export default function ProvidersPage() {
  const list = useListPage("/providers", EMPTY_FILTERS);
  const [modal, setModal] = useState(null); // null | { id: null } | { id }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const selection = useSelection();
  const [mailTarget, setMailTarget] = useState(null); // null | { ids, recipient? }
  const pageIds = list.data.items.map((r) => r._id);

  return (
    <div>
      <PageHeader
        title="Providers"
        description="Casino game providers, aggregators and platforms. Track who you contacted and what was said."
        action={<Button size="sm" startIcon={<PlusIcon />} onClick={() => setModal({ id: null })}>Add Provider</Button>}
      />

      <StatusSummary stats={list.stats} allLabel="All providers" value={list.filters.status} onChange={(v) => list.applyNow("status", v)} />

      <FilterPanel onSearch={list.search} onClear={list.clear}>
        <Field label="Search" htmlFor="pf-q" className="sm:col-span-2">
          <input id="pf-q" className={inputClass} placeholder="Name, alias, email, website, HQ, content" value={list.draft.q} onChange={(e) => list.setDraftField("q", e.target.value)} />
        </Field>
        <Field label="Status" htmlFor="pf-status">
          <SelectInput id="pf-status" value={list.draft.status} onChange={(v) => list.setDraftField("status", v)} options={STATUSES} placeholder="All statuses" />
        </Field>
        <Field label="Category" htmlFor="pf-cat">
          <SelectInput id="pf-cat" value={list.draft.category} onChange={(v) => list.setDraftField("category", v)} options={CATEGORIES} placeholder="All categories" />
        </Field>
        <Field label="Email" htmlFor="pf-email">
          <SelectInput id="pf-email" value={list.draft.hasEmail} onChange={(v) => list.setDraftField("hasEmail", v)} options={[{ value: "yes", label: "Has email" }, { value: "no", label: "No email" }]} placeholder="Any" />
        </Field>
        <Field label="Sort by" htmlFor="pf-sort">
          <SelectInput id="pf-sort" value={list.draft.sort} onChange={(v) => list.setDraftField("sort", v)} options={SORTS} />
        </Field>
      </FilterPanel>

      <SelectionBar selection={selection}>
        <Button size="sm" startIcon={<MailIcon className="h-5 w-5" />} onClick={() => setMailTarget({ ids: [...selection.ids] })}>Send email</Button>
      </SelectionBar>

      <DataTable headers={[{ key: "select", label: <SelectAllBox selection={selection} pageIds={pageIds} />, className: "w-10 pr-0" }, ...HEADERS]} isLoading={list.isLoading} isEmpty={list.data.items.length === 0} emptyText="No providers match these filters." error={list.error} onRetry={list.load}>
        {list.data.items.map((p) => (
          <tr key={p._id} className={rowClass} onClick={() => setModal({ id: p._id })}>
            <SelectCell selection={selection} id={p._id} />
            <td className={`${tdClass} text-gray-500`}>{p.order ?? "—"}</td>
            <td className="px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800 dark:text-white/90">{p.name}</span>
                {p.shortlistRank != null ? <Badge tone="warning" dot={false}>Shortlist #{p.shortlistRank}</Badge> : null}
              </div>
              {p.aliases.length ? <p className="mt-0.5 max-w-56 truncate text-xs text-gray-500 dark:text-gray-400" title={p.aliases.join(", ")}>{p.aliases.join(", ")}</p> : null}
            </td>
            <td className="px-5 py-4">
              <div className="flex max-w-44 flex-wrap gap-1">
                {p.categories.map((c) => <Badge key={c} dot={false}>{c}</Badge>)}
              </div>
            </td>
            <td className={`${tdClass} max-w-44 truncate`}>
              {p.website ? (
                <a href={p.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-brand-500 hover:underline dark:text-brand-400">{shortUrl(p.website)}</a>
              ) : "—"}
            </td>
            <td className={`${tdClass} max-w-52`} title={p.emails.join(", ")}>
              {p.emails.length ? (
                <>
                  <p className="truncate">{p.emails[0]}</p>
                  {p.emails.length > 1 ? <p className="text-xs text-gray-400">+{p.emails.length - 1} more</p> : null}
                </>
              ) : "—"}
            </td>
            <td className={`${tdClass} max-w-40 truncate`} title={p.headquarters}>{p.headquarters || "—"}</td>
            <td className="px-5 py-4">
              <StatusSelect value={p.status} disabled={list.isMutating} onChange={(s) => void list.mutate(() => api(`/providers/${p._id}`, { method: "PUT", body: { status: s } }), `${p.name}: status set to ${s}`)} />
              <MailInfo row={p} />
            </td>
            <td className="px-5 py-4">
              <RowActions disabled={list.isMutating} onEmail={() => setMailTarget({ ids: [p._id], recipient: p.name })} onEdit={() => setModal({ id: p._id })} onDelete={() => setDeleteTarget(p)} />
            </td>
          </tr>
        ))}
      </DataTable>

      <ListPager {...list.pager} />

      <SendMailModal
        isOpen={Boolean(mailTarget)}
        list="providers"
        ids={mailTarget?.ids ?? []}
        recipient={mailTarget?.recipient}
        fields={["website", "headquarters"]}
        onClose={() => setMailTarget(null)}
        onFinished={list.load}
      />

      <ProviderModal
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
        describe={(p) => `Do you really want to delete "${p.name}"? This cannot be undone.`}
        loading={list.isMutating}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async (p) => {
          if (await list.mutate(() => api(`/providers/${p._id}`, { method: "DELETE" }), `${p.name} deleted`)) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
