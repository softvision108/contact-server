import { useCallback, useEffect, useState } from "react";

import { api, queryString } from "../api.js";
import { DEFAULT_PER_PAGE } from "../constants.js";
import { useToast } from "../context/ToastContext.jsx";

// State for a filtered, paged list page: filters typed in the panel stay in `draft` until Search,
// the status cards apply at once. `mutate` runs a change, shows a toast and reloads.
export function useListPage(endpoint, emptyFilters) {
  const notify = useToast();
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [data, setData] = useState({ items: [], total: 0 });
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [list, s] = await Promise.all([
        api(`${endpoint}?${queryString({ ...filters, page, limit: perPage })}`),
        api(`${endpoint}/stats`),
      ]);
      setData(list);
      setStats(s);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, filters, page, perPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = async (fn, message) => {
    setIsMutating(true);
    try {
      await fn();
      notify(message);
      await load();
      return true;
    } catch (err) {
      notify(err.message, "error");
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  return {
    draft,
    filters,
    setDraftField: (key, value) => setDraft((d) => ({ ...d, [key]: value })),
    search: () => {
      setPage(1);
      setFilters(draft);
    },
    clear: () => {
      setPage(1);
      setDraft(emptyFilters);
      setFilters(emptyFilters);
    },
    applyNow: (key, value) => {
      setPage(1);
      setDraft((d) => ({ ...d, [key]: value }));
      setFilters((f) => ({ ...f, [key]: value }));
    },
    data,
    stats,
    isLoading,
    isMutating,
    error,
    load,
    mutate,
    pager: {
      page,
      perPage,
      total: data.total,
      totalPages: Math.max(1, Math.ceil(data.total / perPage)),
      onPageChange: setPage,
      onPerPageChange: (n) => {
        setPage(1);
        setPerPage(n);
      },
    },
  };
}

export const linesToText = (list) => (list || []).join("\n");
export const shortUrl = (url) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

// Rows ticked for a bulk action, by id. Survives paging, so rows can be picked across pages.
export function useSelection() {
  const [ids, setIds] = useState(() => new Set());
  return {
    ids,
    size: ids.size,
    has: (id) => ids.has(id),
    toggle: (id) =>
      setIds((s) => {
        const next = new Set(s);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    // Ticks every row on the page, or unticks them all when they already are.
    togglePage: (pageIds) =>
      setIds((s) => {
        const next = new Set(s);
        const all = pageIds.length > 0 && pageIds.every((id) => next.has(id));
        for (const id of pageIds) (all ? next.delete(id) : next.add(id));
        return next;
      }),
    clear: () => setIds(new Set()),
  };
}
