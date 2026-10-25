import { useEffect, useState } from "react";

import { api } from "../api.js";
import { Button, ErrorBox, Field, Modal, SectionTitle, SelectInput, inputClass, textareaClass } from "../components/ui.jsx";
import { linesToText } from "../components/useListPage.js";
import { CRYPTO_CATEGORIES, STATUSES } from "../constants.js";
import { useToast } from "../context/ToastContext.jsx";

const TEXT = [
  ["logo", "Logo URL"], ["website", "Website"], ["linkedin", "LinkedIn"], ["contactPage", "Contact page"], ["headquarters", "Headquarters"],
  ["fees", "Fees"], ["settlement", "Settlement"],
];
const LISTS = [
  ["coins", "Coins"], ["chains", "Chains"], ["services", "Services"], ["emails", "Emails"], ["phones", "Phones"], ["socials", "Socials"],
  ["aliases", "Aliases"], ["urls", "Links"], ["notes", "Notes"],
];
const EMPTY = {
  name: "", order: "", status: "ready", category: "", content: "",
  ...Object.fromEntries(TEXT.map(([k]) => [k, ""])),
  ...Object.fromEntries(LISTS.map(([k]) => [k, ""])),
};

// Search box over CoinMarketCap's coin list; picking a coin adds its symbol to the Coins list.
function CoinPicker({ onPick }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!q.trim()) return setItems([]);
    const t = setTimeout(() => {
      api(`/crypto-partners/coin-list?q=${encodeURIComponent(q.trim())}&limit=8`).then((r) => setItems(r.items)).catch(() => setItems([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative mt-2">
      <input className={inputClass} placeholder="Search CoinMarketCap: BTC, Tether..." value={q} onChange={(e) => setQ(e.target.value)} />
      {items.length ? (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
          {items.map((c) => (
            <li key={c.slug}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                onClick={() => {
                  onPick(c.symbol);
                  setQ("");
                }}
              >
                <span className="font-medium">{c.symbol}</span>
                <span className="truncate text-gray-500 dark:text-gray-400">{c.name}{c.platform ? ` · ${c.platform}` : ""}</span>
                <span className="ml-auto text-xs text-gray-400">#{c.rank ?? "—"}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function toValues(l) {
  const v = { ...EMPTY };
  for (const k of ["name", "status", "category", "content", ...TEXT.map(([k]) => k)]) v[k] = l[k] ?? "";
  v.order = l.order ?? "";
  for (const [k] of LISTS) v[k] = linesToText(l[k]);
  return v;
}

export default function CryptoPartnerModal({ isOpen, id, onClose, onSaved }) {
  const notify = useToast();
  const isEdit = Boolean(id);
  const [values, setValues] = useState(EMPTY);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setMeta(null);
    if (!id) {
      setValues(EMPTY);
      return;
    }
    setIsLoading(true);
    api(`/crypto-partners/${id}`)
      .then((l) => {
        setValues(toValues(l));
        setMeta(l);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [isOpen, id]);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const pick = (k) => (value) => setValues((v) => ({ ...v, [k]: value }));
  const addCoin = (symbol) =>
    setValues((v) => {
      const coins = v.coins.split(/\r?\n|,/).map((c) => c.trim()).filter(Boolean);
      return coins.includes(symbol) ? v : { ...v, coins: [...coins, symbol].join("\n") };
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!values.name.trim()) return setError("Name is required");
    setIsSubmitting(true);
    try {
      const saved = await api(isEdit ? `/crypto-partners/${id}` : "/crypto-partners", { method: isEdit ? "PUT" : "POST", body: values });
      notify(isEdit ? `${saved.name} updated` : `${saved.name} added`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit ${meta?.name ?? "Partner"}` : "Add Partner"} maxWidth="max-w-4xl">
      <ErrorBox>{error}</ErrorBox>
      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label={<>Name <span className="text-error-500">*</span></>} htmlFor="cm-name" className="sm:col-span-2">
              <div className="flex items-center gap-3">
                {values.logo ? <img src={values.logo} alt="" className="h-10 w-10 shrink-0 rounded-full" /> : null}
                <input id="cm-name" className={inputClass} value={values.name} onChange={set("name")} />
              </div>
            </Field>
            <Field label="Type" htmlFor="cm-cat">
              <SelectInput id="cm-cat" value={values.category} onChange={pick("category")} options={CRYPTO_CATEGORIES} placeholder="—" />
            </Field>
            <Field label="Status" htmlFor="cm-status">
              <SelectInput id="cm-status" value={values.status} onChange={pick("status")} options={STATUSES} />
            </Field>
            <Field label="Order" htmlFor="cm-order">
              <input id="cm-order" type="number" min="1" className={inputClass} value={values.order} onChange={set("order")} />
            </Field>
          </div>

          <Field label="Content" hint="message, conversation, anything long" htmlFor="cm-content" className="mt-4">
            <textarea id="cm-content" rows={7} className={textareaClass} value={values.content} onChange={set("content")} />
          </Field>

          <SectionTitle>Details</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TEXT.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`cm-${k}`}>
                <input id={`cm-${k}`} className={inputClass} value={values[k]} onChange={set(k)} />
              </Field>
            ))}
          </div>

          <SectionTitle>Lists (one per line)</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {LISTS.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`cm-${k}`} className={k === "notes" ? "sm:col-span-2" : ""}>
                <textarea id={`cm-${k}`} rows={k === "notes" ? 5 : 3} className={textareaClass} value={values[k]} onChange={set(k)} />
                {k === "coins" ? <CoinPicker onPick={addCoin} /> : null}
              </Field>
            ))}
          </div>

          {meta ? (
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Sources: {(meta.sources || []).join(", ") || "—"} · Updated {new Date(meta.updatedAt).toLocaleString()}
            </p>
          ) : null}
          <div className="sticky -bottom-6 -mx-6 -mb-6 mt-6 flex justify-end gap-3 rounded-b-2xl border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : isEdit ? "Update" : "Add"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
