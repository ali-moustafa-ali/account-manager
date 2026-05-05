"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { type RosterEntry } from "@/lib/db/queries";
import { type PaymentStatus } from "@/lib/domain/status";
import { cn } from "@/lib/utils/cn";
import { ClientRow } from "./ClientRow";

const STATUS_PRIORITY: Record<PaymentStatus, number> = {
  overdue: 0,
  pending: 1,
  partial: 2,
  cleared: 3,
};

const STATUSES: PaymentStatus[] = ["overdue", "pending", "partial", "cleared"];
const STATUS_LABELS: Record<PaymentStatus, string> = {
  overdue: "Overdue",
  pending: "Pending",
  partial: "Partial",
  cleared: "Cleared",
};

type SortField = "name" | "package" | "target" | "paid" | "totalAds" | "remaining" | "status";
type SortDir = "asc" | "desc";

const COLUMNS: Array<{ id: SortField; label: string; align?: "left" | "right" }> = [
  { id: "name", label: "Client", align: "left" },
  { id: "package", label: "Package", align: "right" },
  { id: "target", label: "Target", align: "right" },
  { id: "paid", label: "Paid", align: "right" },
  { id: "totalAds", label: "Total Ads", align: "right" },
  { id: "remaining", label: "Remaining", align: "right" },
  { id: "status", label: "Status", align: "left" },
];

export function ClientTable({ entries }: { entries: RosterEntry[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // URL → state
  const statusFilter = useMemo<PaymentStatus[]>(() => {
    const raw = searchParams.get("status");
    if (!raw) return [];
    return raw.split(",").filter((s): s is PaymentStatus =>
      (STATUSES as string[]).includes(s),
    );
  }, [searchParams]);

  const sortField = (searchParams.get("sort") as SortField) || "status";
  const sortDir = (searchParams.get("dir") as SortDir) || "asc";

  // Search has local state for instant feedback + debounced URL sync
  const urlSearch = searchParams.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(urlSearch);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchInput) params.set("q", searchInput);
      else params.delete("q");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Reflect URL changes back to local input (e.g. browser back/forward)
  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  const setUrlParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const toggleStatus = (status: PaymentStatus) => {
    const next = statusFilter.includes(status)
      ? statusFilter.filter((s) => s !== status)
      : [...statusFilter, status];
    setUrlParam("status", next.length ? next.join(",") : null);
  };

  const setSort = (field: SortField) => {
    if (sortField === field) {
      setUrlParam("dir", sortDir === "asc" ? "desc" : "asc");
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sort", field);
      params.set("dir", "asc");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }
  };

  const filtered = useMemo(() => {
    let result = entries;

    if (statusFilter.length > 0) {
      result = result.filter((e) => statusFilter.includes(e.period.status));
    }

    if (searchInput.trim()) {
      const q = searchInput.trim().toLowerCase();
      result = result.filter((e) => e.client.name.toLowerCase().includes(q));
    }

    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.client.name.localeCompare(b.client.name);
          break;
        case "package":
          cmp = a.client.packageCost - b.client.packageCost;
          break;
        case "target":
          cmp = a.period.effectiveTarget - b.period.effectiveTarget;
          break;
        case "paid":
          cmp = a.period.paidThisPeriod - b.period.paidThisPeriod;
          break;
        case "totalAds":
          cmp = a.client.totalAdsAmount - b.client.totalAdsAmount;
          break;
        case "remaining":
          cmp = a.period.remaining - b.period.remaining;
          break;
        case "status":
          cmp = STATUS_PRIORITY[a.period.status] - STATUS_PRIORITY[b.period.status];
          break;
      }
      // Stable secondary sort by name
      if (cmp === 0 && sortField !== "name") {
        cmp = a.client.name.localeCompare(b.client.name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [entries, statusFilter, searchInput, sortField, sortDir]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {STATUSES.map((s) => {
            const active = statusFilter.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={cn(
                  "transition-opacity",
                  active ? "opacity-100" : "opacity-40 hover:opacity-70",
                )}
                aria-pressed={active}
              >
                <Pill variant={s}>{STATUS_LABELS[s]}</Pill>
              </button>
            );
          })}
          {statusFilter.length > 0 ? (
            <button
              type="button"
              onClick={() => setUrlParam("status", null)}
              className="text-xs text-ink-3 hover:text-ink-1 transition-colors px-2"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="relative">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search clients…"
            className="rounded-pill border border-line bg-white px-4 py-2 pl-9 text-sm text-ink-1 outline-none focus:ring-2 focus:ring-ink-1/30 w-56"
            aria-label="Search clients by name"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          {entries.length === 0 ? (
            <>
              <h3 className="font-display text-2xl font-medium tracking-tight mb-2">
                No clients yet
              </h3>
              <p className="text-ink-2">
                Add your first client to start tracking payments.
              </p>
            </>
          ) : (
            <>
              <h3 className="font-display text-xl font-medium tracking-tight mb-2">
                No matches
              </h3>
              <p className="text-ink-2">Try changing the filter or search.</p>
            </>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-2/50">
                <tr className="border-b border-line">
                  {COLUMNS.map((col) => {
                    const active = sortField === col.id;
                    return (
                      <th
                        key={col.id}
                        scope="col"
                        className={cn(
                          "py-3 px-4 text-xs font-medium uppercase tracking-wider text-ink-3",
                          col.align === "right" ? "text-right" : "text-left",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSort(col.id)}
                          className={cn(
                            "inline-flex items-center gap-1 transition-colors hover:text-ink-1",
                            active && "text-ink-1",
                          )}
                          aria-sort={
                            active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                          }
                        >
                          {col.label}
                          {active ? (
                            <span aria-hidden="true" className="text-[10px]">
                              {sortDir === "asc" ? "▲" : "▼"}
                            </span>
                          ) : null}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <ClientRow key={entry.client.id} client={entry.client} period={entry.period} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
