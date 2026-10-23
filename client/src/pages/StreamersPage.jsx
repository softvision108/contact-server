import { useEffect, useState } from "react";

import { api } from "../api.js";
import { MailIcon, PlusIcon } from "../components/icons.jsx";
import { Badge, Button, ConfirmDelete, DataTable, Field, FilterPanel, ListPager, MailInfo, PageHeader, RowActions, SelectAllBox, SelectCell, SelectInput, SelectionBar, StatusSelect, StatusSummary, inputClass, rowClass, tdClass } from "../components/ui.jsx";
import { useListPage, useSelection } from "../components/useListPage.js";
import { PLATFORMS, STATUSES, channelUrl } from "../constants.js";
import StreamerModal from "./StreamerModal.jsx";
import SendMailModal from "./SendMailModal.jsx";

const EMPTY_FILTERS = { q: "", status: "", platform: "", category: "", language: "", hasEmail: "", minFollowers: "", sort: "followers" };
const SORTS = [
  { value: "followers", label: "Followers" },
  { value: "viewers", label: "Viewers" },
  { value: "name", label: "Username" },
  { value: "updated", label: "Last updated" },
  { value: "status", label: "Status" },
];
const MIN_FOLLOWERS = [1000, 10000, 50000, 100000, 500000].map((n) => ({ value: String(n), label: `${n.toLocaleString()}+` }));
const HEADERS = [
  { key: "name", label: "Streamer" },
  { key: "category", label: "Category" },
  { key: "followers", label: "Followers" },
  { key: "viewers", label: "Viewers" },
  { key: "language", label: "Language" },
  { key: "emails", label: "Emails" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", className: "text-right" },
];
const PLATFORM_TONE = { kick: "success", twitch: "info" };

const formatCount = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString());

export default function StreamersPage() {
  const list = useListPage("/streamers", EMPTY_FILTERS);
  const [facets, setFacets] = useState({ categories: [], languages: [] });
  const [modal, setModal] = useState(null); // null | { id: null } | { id }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const selection = useSelection();
  const [mailTarget, setMailTarget] = useState(null); // null | { ids, recipient? }
  const pageIds = list.data.items.map((r) => r._id);

  useEffect(() => {
    api("/streamers/facets").then(setFacets).catch(() => {});
  }, [list.data.total]);

  const facetOptions = (rows) => rows.map((r) => ({ value: r.value, label: `${r.value} (${r.count})` }));

  return (
    <div>
      <PageHeader
        title="Streamers"
        description="Casino, slots and poker streamers found live on Kick and Twitch."
        action={<Button size="sm" startIcon={<PlusIcon />} onClick={() => setModal({ id: null })}>Add Streamer</Button>}
      />

      <StatusSummary stats={list.stats} allLabel="All streamers" value={list.filters.status} onChange={(v) => list.applyNow("status", v)} />

      <FilterPanel onSearch={list.search} onClear={list.clear}>
        <Field label="Search" htmlFor="sf-q" className="sm:col-span-2">
          <input id="sf-q" className={inputClass} placeholder="Username, bio, email, links, title, content" value={list.draft.q} onChange={(e) => list.setDraftField("q", e.target.value)} />
        </Field>
        <Field label="Platform" htmlFor="sf-platform">
          <SelectInput id="sf-platform" value={list.draft.platform} onChange={(v) => list.setDraftField("platform", v)} options={PLATFORMS} placeholder="All platforms" />
        </Field>
        <Field label="Category" htmlFor="sf-cat">
          <SelectInput id="sf-cat" value={list.draft.category} onChange={(v) => list.setDraftField("category", v)} options={facetOptions(facets.categories)} placeholder="All categories" />
        </Field>
        <Field label="Language" htmlFor="sf-lang">
          <SelectInput id="sf-lang" value={list.draft.language} onChange={(v) => list.setDraftField("language", v)} options={facetOptions(facets.languages)} placeholder="All languages" />
        </Field>
        <Field label="Followers" htmlFor="sf-followers">
          <SelectInput id="sf-followers" value={list.draft.minFollowers} onChange={(v) => list.setDraftField("minFollowers", v)} options={MIN_FOLLOWERS} placeholder="Any" />
        </Field>
        <Field label="Status" htmlFor="sf-status">
          <SelectInput id="sf-status" value={list.draft.status} onChange={(v) => list.setDraftField("status", v)} options={STATUSES} placeholder="All statuses" />
        </Field>
        <Field label="Email" htmlFor="sf-email">
          <SelectInput id="sf-email" value={list.draft.hasEmail} onChange={(v) => list.setDraftField("hasEmail", v)} options={[{ value: "yes", label: "Has email" }, { value: "no", label: "No email" }]} placeholder="Any" />
        </Field>
        <Field label="Sort by" htmlFor="sf-sort">
          <SelectInput id="sf-sort" value={list.draft.sort} onChange={(v) => list.setDraftField("sort", v)} options={SORTS} />
        </Field>
      </FilterPanel>

      <SelectionBar selection={selection}>
        <Button size="sm" startIcon={<MailIcon className="h-5 w-5" />} onClick={() => setMailTarget({ ids: [...selection.ids] })}>Send email</Button>
      </SelectionBar>

      <DataTable headers={[{ key: "select", label: <SelectAllBox selection={selection} pageIds={pageIds} />, className: "w-10 pr-0" }, ...HEADERS]} isLoading={list.isLoading} isEmpty={list.data.items.length === 0} emptyText="No streamers yet. Click &quot;Add Streamer&quot; or run the sync." error={list.error} onRetry={list.load}>
        {list.data.items.map((s) => (
          <tr key={s._id} className={rowClass} onClick={() => setModal({ id: s._id })}>
            <SelectCell selection={selection} id={s._id} />
            <td className="px-5 py-4">
              <div className="flex items-center gap-2">
                <a href={channelUrl(s)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="font-medium text-gray-800 hover:underline dark:text-white/90">
                  {s.displayName || s.username}
                </a>
                {s.verified ? <span className="text-xs text-brand-500" title="Verified / partner">✔</span> : null}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Badge tone={PLATFORM_TONE[s.platform]} dot={false}>{s.platform}</Badge>
                <span className="max-w-56 truncate text-xs text-gray-500 dark:text-gray-400" title={s.bio}>{s.bio}</span>
              </div>
            </td>
            <td className={`${tdClass} whitespace-nowrap`}>{s.category || "—"}</td>
            <td className={`${tdClass} whitespace-nowrap`}>{formatCount(s.followers)}</td>
            <td className={`${tdClass} whitespace-nowrap`}>{formatCount(s.viewers)}</td>
            <td className={tdClass}>{s.language || "—"}</td>
            <td className={`${tdClass} max-w-52`} title={s.emails.join(", ")}>
              {s.emails.length ? (
                <>
                  <p className="truncate">{s.emails[0]}</p>
                  {s.emails.length > 1 ? <p className="text-xs text-gray-400">+{s.emails.length - 1} more</p> : null}
                </>
              ) : "—"}
            </td>
            <td className="px-5 py-4">
              <StatusSelect value={s.status} disabled={list.isMutating} onChange={(st) => void list.mutate(() => api(`/streamers/${s._id}`, { method: "PUT", body: { status: st } }), `${s.username}: status set to ${st}`)} />
              <MailInfo row={s} />
            </td>
            <td className="px-5 py-4">
              <RowActions disabled={list.isMutating} onEmail={() => setMailTarget({ ids: [s._id], recipient: s.displayName || s.username })} onEdit={() => setModal({ id: s._id })} onDelete={() => setDeleteTarget(s)} />
            </td>
          </tr>
        ))}
      </DataTable>

      <ListPager {...list.pager} />

      <SendMailModal
        isOpen={Boolean(mailTarget)}
        list="streamers"
        ids={mailTarget?.ids ?? []}
        recipient={mailTarget?.recipient}
        fields={["username", "platform", "category", "language"]}
        onClose={() => setMailTarget(null)}
        onFinished={list.load}
      />

      <StreamerModal
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
        describe={(s) => `Do you really want to delete ${s.platform}/${s.username}? This cannot be undone.`}
        loading={list.isMutating}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async (s) => {
          if (await list.mutate(() => api(`/streamers/${s._id}`, { method: "DELETE" }), `${s.username} deleted`)) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
