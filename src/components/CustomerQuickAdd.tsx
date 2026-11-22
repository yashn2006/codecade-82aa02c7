import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { createCustomer } from "@/lib/customers.functions";
import { initials, maskPhone } from "@/lib/live-floor";

export type FloorCustomer = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  wallet_balance?: number | null;
};

/** Digits-only, last 10 — so "+91 98765 43210" and "9876543210" match. */
export function phoneKey(p: string | null | undefined): string {
  const digits = (p ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function findCustomerByPhone(phone: string, customers: FloorCustomer[]): FloorCustomer | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const key = phoneKey(trimmed);
  return (
    customers.find((c) => {
      if ((c.phone ?? "").trim() === trimmed) return true;
      return key.length >= 6 && phoneKey(c.phone) === key;
    }) ?? null
  );
}

/** Single canonical add-customer form shared across Live Floor, Bookings, and Customers. */
export function CustomerQuickAddForm({
  cafeId,
  customers = [],
  initialName = "",
  initialPhone = "",
  showEmail = false,
  submitLabel = "Save customer",
  onSuccess,
  onCancel,
}: {
  cafeId: string;
  customers?: FloorCustomer[];
  initialName?: string;
  initialPhone?: string;
  showEmail?: boolean;
  submitLabel?: string;
  onSuccess: (customer: FloorCustomer, opts: { matchedExisting: boolean }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const qc = useQueryClient();
  const createFn = useServerFn(createCustomer);

  const m = useMutation({
    mutationFn: createFn,
    onSuccess: (row) => {
      const cust = row as unknown as FloorCustomer;
      const matchedExisting = customers.some((c) => c.id === cust.id);
      qc.setQueryData<FloorCustomer[]>(["customers", cafeId], (prev) => {
        if (!prev) return [cust];
        return prev.some((c) => c.id === cust.id) ? prev : [cust, ...prev];
      });
      void qc.invalidateQueries({ queryKey: ["customers", cafeId] });
      toast.success(matchedExisting ? "Existing customer selected" : "Customer added");
      onSuccess(cust, { matchedExisting });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Could not add customer";
      setError(msg);
      toast.error(msg);
    },
  });

  const dup = useMemo(() => findCustomerByPhone(phone, customers), [phone, customers]);

  const submit = () => {
    if (m.isPending) return;
    if (!name.trim()) {
      setError("Enter the customer's name.");
      return;
    }
    setError(null);
    m.mutate({
      data: {
        cafe_id: cafeId,
        full_name: name.trim(),
        phone: phone.trim() || null,
        email: showEmail ? email.trim() || null : null,
      },
    });
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      submit();
    }
  };

  return (
    <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Name *
          </label>
          <input
            type="text"
            className="lf-input h-10 w-full"
            placeholder="Full name"
            value={name}
            maxLength={120}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={onEnter}
          />
        </div>
        <div className="space-y-1">
          <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Phone (optional)
          </label>
          <input
            type="tel"
            inputMode="tel"
            className="lf-input h-10 w-full"
            placeholder="Phone number"
            value={phone}
            maxLength={20}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={onEnter}
          />
        </div>
      </div>

      {showEmail && (
        <div className="space-y-1">
          <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Email (optional)
          </label>
          <input
            type="email"
            className="lf-input h-10 w-full"
            placeholder="player@example.com"
            value={email}
            maxLength={200}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={onEnter}
          />
        </div>
      )}

      {dup && (
        <button
          type="button"
          onClick={() => onSuccess(dup, { matchedExisting: true })}
          className="flex w-full items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5 text-left text-xs text-foreground"
        >
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span className="min-w-0 truncate">
            Phone belongs to <b>{dup.full_name}</b> — click to select
          </span>
        </button>
      )}

      {error && (
        <div role="alert" className="text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-0.5">
        {onCancel && (
          <button
            type="button"
            disabled={m.isPending}
            onClick={onCancel}
            className="lf-btn h-9 px-3 text-xs"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={m.isPending}
          onClick={submit}
          className="lf-btn lf-btn-primary h-9 px-3.5 text-xs"
        >
          {m.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
          {m.isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

export function CustomerQuickAdd({
  cafeId,
  customers,
  value,
  onChange,
  playingOn,
  invalid = false,
  autoFocus = false,
  canCreateCustomer = true,
  listClassName = "max-h-[212px]",
}: {
  cafeId: string;
  customers: FloorCustomer[];
  value: FloorCustomer | null;
  onChange: (v: FloorCustomer | null) => void;
  playingOn?: Map<string, string>;
  invalid?: boolean;
  autoFocus?: boolean;
  canCreateCustomer?: boolean;
  listClassName?: string;
}) {
  const [raw, setRaw] = useState("");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(raw.trim().toLowerCase()), 120);
    return () => clearTimeout(t);
  }, [raw]);

  const results = useMemo(() => {
    if (!q) return customers.slice(0, 20);
    const digits = q.replace(/\D/g, "");
    return customers
      .filter(
        (c) =>
          (c.full_name ?? "").toLowerCase().includes(q) ||
          (digits.length >= 2 && (c.phone ?? "").replace(/\D/g, "").includes(digits)),
      )
      .slice(0, 20);
  }, [customers, q]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-lf-violet/40 bg-lf-violet/10 p-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lf-violet/25 font-mono text-[11px] font-bold">
          {initials(value.full_name ?? "?")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{value.full_name ?? "Customer"}</div>
          <div className="font-mono text-[10.5px] text-lf-dim">
            {maskPhone(value.phone)} · wallet ₹{Number(value.wallet_balance ?? 0).toLocaleString("en-IN")}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="lf-btn h-7 px-2"
          aria-label="Clear customer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (creating) {
    const trimmed = raw.trim();
    const looksLikePhone = /^\+?[\d\s-]{6,}$/.test(trimmed);
    return (
      <CustomerQuickAddForm
        cafeId={cafeId}
        customers={customers}
        initialName={looksLikePhone ? "" : trimmed}
        initialPhone={looksLikePhone ? trimmed : ""}
        onSuccess={(cust) => {
          setCreating(false);
          setRaw("");
          onChange(cust);
        }}
        onCancel={() => setCreating(false)}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-lf-dim" />
        <input
          className="lf-input h-9 pl-8"
          placeholder="Search name or phone…"
          value={raw}
          autoFocus={autoFocus}
          aria-invalid={invalid}
          aria-label="Search customers"
          onChange={(e) => setRaw(e.target.value)}
        />
      </div>
      <div className={`lf-scroll ${listClassName} space-y-1 overflow-y-auto pr-0.5`}>
        {results.map((c) => {
          const at = playingOn?.get(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c)}
              className="flex w-full items-center gap-2.5 rounded-lg border border-lf-line bg-lf-bg/60 px-2.5 py-1.5 text-left transition-colors hover:border-lf-violet/40"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-lf-elevated font-mono text-[10px] font-bold">
                {initials(c.full_name ?? "?")}
              </span>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-lf-text">
                  {c.full_name ?? "Customer"}
                </span>
                {playingOn ? (
                  <span
                    className="block truncate text-[10.5px]"
                    style={{ color: at ? "var(--lf-maint)" : "var(--lf-run)" }}
                  >
                    {at ? `In game · ${at}` : `Wallet ₹${Number(c.wallet_balance ?? 0).toLocaleString("en-IN")}`}
                  </span>
                ) : null}
              </div>
              <span className="shrink-0 font-mono text-[10px] text-lf-dim">{maskPhone(c.phone)}</span>
            </button>
          );
        })}
        {results.length === 0 && (
          <div className="rounded-lg border border-dashed border-lf-line px-3 py-2 text-[12px] text-lf-dim">
            {raw.trim() ? `No customer matches “${raw.trim()}”.` : "No customers yet."}
          </div>
        )}
      </div>
      {canCreateCustomer && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-lf-violet/45 bg-lf-violet/[0.06] px-2.5 py-2 text-[12px] font-semibold text-lf-text transition-colors hover:border-lf-violet/70 hover:bg-lf-violet/15"
        >
          <UserPlus className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">
            {results.length === 0 && raw.trim()
              ? `Add “${raw.trim()}” as new customer`
              : "+ New customer"}
          </span>
        </button>
      )}
    </div>
  );
}
