import { useEffect, useState } from "react";

import { api } from "../api.js";
import { MailIcon, PlusIcon } from "../components/icons.jsx";
import { Badge, Button, ConfirmDelete, DataTable, Field, FilterPanel, ListPager, MailInfo, PageHeader, RowActions, SelectAllBox, SelectCell, SelectInput, SelectionBar, StatusSelect, StatusSummary, inputClass, rowClass, tdClass } from "../components/ui.jsx";
import { useListPage, useSelection } from "../components/useListPage.js";
import { QUALITIES, STATUSES } from "../constants.js";
import PersonModal from "./PersonModal.jsx";
import SendMailModal from "./SendMailModal.jsx";

const EMPTY_FILTERS = { q: "", status: "", country: "", quality: "", sort: "email" };
const SORTS = [
  { value: "email", label: "Email" },
  { value: "country", label: "Country" },
  { value: "updated", label: "Last updated" },
  { value: "status", label: "Status" },
];
const HEADERS = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "country", label: "Country" },
  { key: "quality", label: "Quality" },
  { key: "content", label: "Content" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", className: "text-right" },
];
const codeLabel = (code) => (/^\d+$/.test(code) ? `+${code}` : code);

export default function PeoplePage() {
  const list = useListPage("/people", EMPTY_FILTERS);
  const [countries, setCountries] = useState([]);
  const [modal, setModal] = useState(null); // null | { person: null } | { person }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const selection = useSelection();
  const [mailTarget, setMailTarget] = useState(null); // null | { ids, recipient? }
  const pageIds = list.data.items.map((r) => r._id);

  useEffect(() => {
    api("/people/countries").then(setCountries).catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader
        title="People"
        description="Individual contacts from the user export, one row per email."
        action={<Button size="sm" startIcon={<PlusIcon />} onClick={() => setModal({ person: null })}>Add Person</Button>}
      />

      <StatusSummary stats={list.stats} allLabel="All people" value={list.filters.status} onChange={(v) => list.applyNow("status", v)} />

      <FilterPanel onSearch={list.search} onClear={list.clear}>
        <Field label="Search" htmlFor="hf-q" className="sm:col-span-2">
          <input id="hf-q" className={inputClass} placeholder="Email, phone, content" value={list.draft.q} onChange={(e) => list.setDraftField("q", e.target.value)} />
        </Field>
        <Field label="Status" htmlFor="hf-status">
          <SelectInput id="hf-status" value={list.draft.status} onChange={(v) => list.setDraftField("status", v)} options={STATUSES} placeholder="All statuses" />
        </Field>
        <Field label="Country" htmlFor="hf-country">
          <SelectInput id="hf-country" value={list.draft.country} onChange={(v) => list.setDraftField("country", v)} options={countries.map((c) => ({ value: c.country, label: `${c.country} (${c.count})` }))} placeholder="All countries" />
        </Field>
        <Field label="Quality" htmlFor="hf-quality">
          <SelectInput id="hf-quality" value={list.draft.quality} onChange={(v) => list.setDraftField("quality", v)} options={QUALITIES} placeholder="Any" />
        </Field>
        <Field label="Sort by" htmlFor="hf-sort">
          <SelectInput id="hf-sort" value={list.draft.sort} onChange={(v) => list.setDraftField("sort", v)} options={SORTS} />
        </Field>
      </FilterPanel>

      <SelectionBar selection={selection}>
        <Button size="sm" startIcon={<MailIcon className="h-5 w-5" />} onClick={() => setMailTarget({ ids: [...selection.ids] })}>Send email</Button>
      </SelectionBar>

      <DataTable headers={[{ key: "select", label: <SelectAllBox selection={selection} pageIds={pageIds} />, className: "w-10 pr-0" }, ...HEADERS]} isLoading={list.isLoading} isEmpty={list.data.items.length === 0} emptyText="No people match these filters." error={list.error} onRetry={list.load}>
        {list.data.items.map((p) => (
          <tr key={p._id} className={rowClass} onClick={() => setModal({ person: p })}>
            <SelectCell selection={selection} id={p._id} />
            <td className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">{p.email}</td>
            <td className={tdClass}>{p.phone || "—"}</td>
            <td className={`${tdClass} whitespace-nowrap`}>
              {p.country || "—"}
              {p.countryCode ? <span className="text-gray-400"> ({codeLabel(p.countryCode)})</span> : null}
            </td>
            <td className="px-5 py-4">
              <Badge tone={p.quality === "perfect" ? "success" : "neutral"}>{p.quality}</Badge>
            </td>
            <td className={`${tdClass} max-w-64 truncate`} title={p.content}>{p.content || "—"}</td>
            <td className="px-5 py-4">
              <StatusSelect value={p.status} disabled={list.isMutating} onChange={(s) => void list.mutate(() => api(`/people/${p._id}`, { method: "PUT", body: { status: s } }), `${p.email}: status set to ${s}`)} />
              <MailInfo row={p} />
            </td>
            <td className="px-5 py-4">
              <RowActions disabled={list.isMutating} onEmail={() => setMailTarget({ ids: [p._id], recipient: p.email })} onEdit={() => setModal({ person: p })} onDelete={() => setDeleteTarget(p)} />
            </td>
          </tr>
        ))}
      </DataTable>

      <ListPager {...list.pager} />

      <SendMailModal
        isOpen={Boolean(mailTarget)}
        list="people"
        ids={mailTarget?.ids ?? []}
        recipient={mailTarget?.recipient}
        fields={["country", "phone"]}
        onClose={() => setMailTarget(null)}
        onFinished={list.load}
      />

      <PersonModal
        isOpen={Boolean(modal)}
        person={modal?.person ?? null}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          void list.load();
        }}
      />
      <ConfirmDelete
        target={deleteTarget}
        describe={(p) => `Do you really want to delete ${p.email}? This cannot be undone.`}
        loading={list.isMutating}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async (p) => {
          if (await list.mutate(() => api(`/people/${p._id}`, { method: "DELETE" }), `${p.email} deleted`)) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
