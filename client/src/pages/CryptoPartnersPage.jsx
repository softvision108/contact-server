import { useEffect, useState } from "react";

import { api } from "../api.js";
import { MailIcon, PlusIcon } from "../components/icons.jsx";
import { Badge, Button, ConfirmDelete, DataTable, Field, FilterPanel, ListPager, MailInfo, PageHeader, RowActions, SelectAllBox, SelectCell, SelectInput, SelectionBar, StatusSelect, StatusSummary, inputClass, rowClass, tdClass } from "../components/ui.jsx";
import { shortUrl, useListPage, useSelection } from "../components/useListPage.js";
import { CRYPTO_CATEGORIES, STATUSES } from "../constants.js";
import CryptoPartnerModal from "./CryptoPartnerModal.jsx";
import SendMailModal from "./SendMailModal.jsx";

const EMPTY_FILTERS = { q: "", status: "", category: "", coin: "", hasEmail: "", sort: "order" };
const SORTS = [
  { value: "order", label: "Order" },
  { value: "name", label: "Name" },
  { value: "updated", label: "Last updated" },
  { value: "status", label: "Status" },
];
const HEADERS = [
  { key: "order", label: "#" },
  { key: "name", label: "Company" },
  { key: "coins", label: "Coins" },
  { key: "website", label: "Website" },
  { key: "socials", label: "Socials" },
  { key: "emails", label: "Emails" },
  { key: "fees", label: "Fees" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", className: "text-right" },
];
const CATEGORY_TONE = { "payment-gateway": "success", exchange: "info", "on-ramp": "warning" };

export default function CryptoPartnersPage() {
  const list = useListPage("/crypto-partners", EMPTY_FILTERS);
  const [coins, setCoins] = useState([]);
  const [modal, setModal] = useState(null); // null | { id: null } | { id }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const selection = useSelection();
  const [mailTarget, setMailTarget] = useState(null); // null | { ids, recipient? }
  const pageIds = list.data.items.map((r) => r._id);

  useEffect(() => {
    api("/crypto-partners/coins").then(setCoins).catch(() => {});
  }, [list.data.total]);

  return (
    <div>
      <PageHeader
        title="Crypto Partner"
        description="Crypto payment gateways, exchanges, on-ramps and wallets to partner with."
        action={<Button size="sm" startIcon={<PlusIcon />} onClick={() => setModal({ id: null })}>Add Partner</Button>}
      />

      <StatusSummary stats={list.stats} allLabel="All partners" value={list.filters.status} onChange={(v) => list.applyNow("status", v)} />

      <FilterPanel onSearch={list.search} onClear={list.clear}>
        <Field label="Search" htmlFor="lf-q" className="sm:col-span-2">
          <input id="lf-q" className={inputClass} placeholder="Name, email, website, HQ, coins, chains, content" value={list.draft.q} onChange={(e) => list.setDraftField("q", e.target.value)} />
        </Field>
        <Field label="Coin" htmlFor="lf-coin">
          <SelectInput id="lf-coin" value={list.draft.coin} onChange={(v) => list.setDraftField("coin", v)} options={coins.map((c) => ({ value: c.coin, label: `${c.coin} (${c.count})` }))} placeholder="All coins" />
        </Field>
        <Field label="Type" htmlFor="lf-cat">
          <SelectInput id="lf-cat" value={list.draft.category} onChange={(v) => list.setDraftField("category", v)} options={CRYPTO_CATEGORIES} placeholder="All types" />
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

      <DataTable headers={[{ key: "select", label: <SelectAllBox selection={selection} pageIds={pageIds} />, className: "w-10 pr-0" }, ...HEADERS]} isLoading={list.isLoading} isEmpty={list.data.items.length === 0} emptyText="No crypto partners yet. Click &quot;Add Partner&quot; to add one." error={list.error} onRetry={list.load}>
        {list.data.items.map((l) => (
          <tr key={l._id} className={rowClass} onClick={() => setModal({ id: l._id })}>
            <SelectCell selection={selection} id={l._id} />
            <td className={`${tdClass} text-gray-500`}>{l.order ?? "—"}</td>
            <td className="px-5 py-4">
              <div className="flex items-center gap-3">
                {l.logo ? <img src={l.logo} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded-full" /> : null}
                <div>
                  <p className="font-medium text-gray-800 dark:text-white/90">{l.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {l.category ? <Badge tone={CATEGORY_TONE[l.category] || "neutral"} dot={false}>{l.category}</Badge> : null}
                    {l.headquarters ? <span className="max-w-48 truncate text-xs text-gray-500 dark:text-gray-400" title={l.headquarters}>{l.headquarters}</span> : null}
                  </div>
                </div>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="flex max-w-56 flex-wrap gap-1" title={l.coins.join(", ")}>
                {l.coins.slice(0, 4).map((c) => <Badge key={c} dot={false}>{c}</Badge>)}
                {l.coins.length > 4 ? <span className="text-xs text-gray-400">+{l.coins.length - 4}</span> : null}
              </div>
            </td>
            <td className={`${tdClass} max-w-44 truncate`}>
              {l.website ? (
                <a href={l.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-brand-500 hover:underline dark:text-brand-400">{shortUrl(l.website)}</a>
              ) : "—"}
            </td>
            <td className={`${tdClass} max-w-52`}>
              {l.socials?.length ? (
                <div className="flex flex-col gap-0.5">
                  {l.socials.slice(0, 3).map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="truncate text-brand-500 hover:underline dark:text-brand-400" title={u}>{shortUrl(u)}</a>
                  ))}
                  {l.socials.length > 3 ? <span className="text-xs text-gray-400">+{l.socials.length - 3} more</span> : null}
                </div>
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
            <td className={`${tdClass} max-w-48 truncate`} title={l.fees}>{l.fees || "—"}</td>
            <td className="px-5 py-4">
              <StatusSelect value={l.status} disabled={list.isMutating} onChange={(s) => void list.mutate(() => api(`/crypto-partners/${l._id}`, { method: "PUT", body: { status: s } }), `${l.name}: status set to ${s}`)} />
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
        list="cryptoPartners"
        ids={mailTarget?.ids ?? []}
        recipient={mailTarget?.recipient}
        fields={["website", "headquarters"]}
        onClose={() => setMailTarget(null)}
        onFinished={list.load}
      />

      <CryptoPartnerModal
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
          if (await list.mutate(() => api(`/crypto-partners/${l._id}`, { method: "DELETE" }), `${l.name} deleted`)) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
