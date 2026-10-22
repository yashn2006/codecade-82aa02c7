import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus, X, Check } from "lucide-react";
import { initials, maskPhone } from "@/lib/live-floor";

export type FloorCustomer = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  wallet_balance?: number | null;
};

export type CustomerDraft =
  | { kind: "existing"; customer: FloorCustomer }
  | { kind: "new"; full_name: string; phone: string }
  | null;

/** Digits-only, last 10 — so "+91 98765 43210" and "9876543210" match. */
export function phoneKey(p: string | null | undefined): string {
  return (p ?? "").replace(/\D/g, "").slice(-10);
}

/** If a "new" draft matches an existing customer by phone, return that customer instead. */
export function findExistingMatch(draft: CustomerDraft, customers: FloorCustomer[]): FloorCustomer | null {
  if (!draft || draft.kind !== "new") return null;
  const key = phoneKey(draft.phone);
  if (key.length >= 10) return customers.find((c) => phoneKey(c.phone) === key) ?? null;
  return null;
}

export function CustomerSelector({
  customers, value, onChange, invalid = false, autoFocus = false,
}: {
  customers: FloorCustomer[];
  value: CustomerDraft;
  onChange: (v: CustomerDraft) => void;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const [raw, setRaw] = useState("");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(value?.kind === "new");

  // Debounce search so typing stays smooth with large customer lists.
  useEffect(() => {
    const t = setTimeout(() => setQ(raw.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [raw]);

  const results = useMemo(() => {
    if (!q) return customers.slice(0, 6);
    const digits = q.replace(/\D/g, "");
    return customers
      .filter((c) =>
        (c.full_name ?? "").toLowerCase().includes(q) ||
        (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits)),
      )
      .slice(0, 6);
  }, [customers, q]);

  const dup = findExistingMatch(value, customers);

  if (value?.kind === "existing") {
    const c = value.customer;
    return (
      <div className="flex items-center gap-3 rounded-xl border border-lf-violet/40 bg-lf-violet/10 p-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lf-violet/25 font-mono text-[11px] font-bold">
          {initials(c.full_name ?? "?")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{c.full_name ?? "Customer"}</div>
          <div className="font-mono text-[10.5px] text-lf-dim">
            {maskPhone(c.phone)} · wallet ₹{Number(c.wallet_balance ?? 0).toLocaleString("en-IN")}
          </div>
        </div>
        <button type="button" onClick={() => onChange(null)} className="lf-btn h-7 px-2" aria-label="Change customer">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (creating) {
    const name = value?.kind === "new" ? value.full_name : "";
    const phone = value?.kind === "new" ? value.phone : "";
    return (
      <div className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="lf-input"
            placeholder="Full name *"
            value={name}
            maxLength={120}
            autoFocus
            aria-invalid={invalid && !name.trim()}
            onChange={(e) => onChange({ kind: "new", full_name: e.target.value, phone })}
          />
          <input
            className="lf-input"
            placeholder="Phone (optional)"
            inputMode="tel"
            value={phone}
            maxLength={20}
            onChange={(e) => onChange({ kind: "new", full_name: name, phone: e.target.value })}
          />
        </div>
        {dup && (
          <button
            type="button"
            onClick={() => { setCreating(false); onChange({ kind: "existing", customer: dup }); }}
            className="flex w-full items-center gap-2 rounded-lg border border-lf-booked/40 bg-lf-booked/10 px-2.5 py-1.5 text-left text-[12px]"
          >
            <Check className="h-3.5 w-3.5 text-lf-booked" />
            <span className="min-w-0 truncate">
              This phone belongs to <b>{dup.full_name}</b> — use the existing customer
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => { setCreating(false); onChange(null); }}
          className="font-mono text-[10.5px] text-lf-dim underline-offset-2 hover:text-lf-text hover:underline"
        >
          ← search existing customers
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-lf-dim" />
        <input
          className="lf-input pl-8"
          placeholder="Search name or phone…"
          value={raw}
          autoFocus={autoFocus}
          aria-invalid={invalid}
          onChange={(e) => setRaw(e.target.value)}
        />
      </div>
      <div className="lf-scroll max-h-[212px] space-y-1 overflow-y-auto">
        {results.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange({ kind: "existing", customer: c })}
            className="flex w-full items-center gap-2.5 rounded-lg border border-lf-line bg-lf-bg/60 px-2.5 py-1.5 text-left transition-colors hover:border-lf-violet/40"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-lf-elevated font-mono text-[10px] font-bold">
              {initials(c.full_name ?? "?")}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{c.full_name ?? "Customer"}</span>
            <span className="shrink-0 font-mono text-[10px] text-lf-dim">{maskPhone(c.phone)}</span>
          </button>
        ))}
        {results.length === 0 && (
          <div className="rounded-lg border border-dashed border-lf-line px-3 py-2 text-[12px] text-lf-dim">
            No customer matches “{raw}”.
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          setCreating(true);
          const looksLikePhone = /^\+?[\d\s-]{6,}$/.test(raw.trim());
          onChange({ kind: "new", full_name: looksLikePhone ? "" : raw.trim(), phone: looksLikePhone ? raw.trim() : "" });
        }}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-lf-line px-2.5 py-1.5 text-[12px] font-semibold text-lf-dim transition-colors hover:border-lf-violet/40 hover:text-lf-text"
      >
        <UserPlus className="h-3.5 w-3.5" /> New customer
      </button>
    </div>
  );
}
