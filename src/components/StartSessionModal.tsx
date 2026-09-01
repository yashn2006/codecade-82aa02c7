import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Play, UserPlus, Loader2, IndianRupee } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type StartDevice = {
  id: string; name: string; type: string; hourly_rate: number; status: string;
};
export type StartCustomer = {
  id: string; full_name?: string | null; phone?: string | null; wallet_balance?: number | null;
};

export type StartPayload = {
  customer_id?: string | null;
  new_customer?: { full_name: string; phone: string | null } | null;
  planned_minutes: number | null;
  package_name: string | null;
  amount_paid: number;
  payment_method: "cash" | "upi" | "card" | "wallet" | "counter";
};

const SHELL: React.CSSProperties = {
  background: "rgba(6,0,18,0.97)",
  backdropFilter: "blur(40px) saturate(180%)",
  border: "1px solid rgba(255,100,200,0.2)",
  borderRadius: 26,
  boxShadow: "0 50px 100px rgba(0,0,0,0.9), 0 0 80px rgba(120,0,255,0.15)",
};

const PACKAGES: { label: string; minutes: number | null }[] = [
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hour", minutes: 120 },
  { label: "3 hour", minutes: 180 },
  { label: "Open play", minutes: null },
];

const METHODS: StartPayload["payment_method"][] = ["counter", "cash", "upi", "card", "wallet"];

function initials(t: string) {
  return t.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

export function StartSessionModal({
  device, customers, busy, onClose, onStart,
}: {
  device: StartDevice;
  customers: StartCustomer[];
  busy?: boolean;
  onClose: () => void;
  onStart: (p: StartPayload) => void;
}) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<StartCustomer | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [pkg, setPkg] = useState(PACKAGES[1]!);
  const [method, setMethod] = useState<StartPayload["payment_method"]>("counter");

  const price = pkg.minutes ? Math.ceil((device.hourly_rate * pkg.minutes) / 60) : 0;
  const [paid, setPaid] = useState<string>("");

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers.slice(0, 6);
    return customers
      .filter((c) => (c.full_name ?? "").toLowerCase().includes(q) || (c.phone ?? "").includes(q))
      .slice(0, 6);
  }, [customers, search]);

  const submit = () => {
    onStart({
      customer_id: picked?.id ?? null,
      new_customer: !picked && creating && newName.trim()
        ? { full_name: newName.trim(), phone: newPhone.trim() || null }
        : null,
      planned_minutes: pkg.minutes,
      package_name: pkg.minutes ? pkg.label : null,
      amount_paid: paid === "" ? (method === "counter" ? 0 : price) : Math.max(0, Number(paid) || 0),
      payment_method: method,
    });
  };

  const body = (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/70 p-3 backdrop-blur-md sm:p-6"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          style={SHELL}
          className="my-auto w-full max-w-[560px] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <div className="flex items-start justify-between gap-3 border-b border-white/8 p-5">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Start session
              </div>
              <div className="mt-1 text-[20px] font-black leading-none">{device.name}</div>
              <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                {device.type.toUpperCase()} · ₹{device.hourly_rate}/hr
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 p-2 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
            {/* customer */}
            <section className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Customer
              </Label>
              {picked ? (
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-[12px] font-black text-primary-foreground">
                    {initials(picked.full_name ?? "?")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-bold">{picked.full_name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{picked.phone ?? "no phone"}</div>
                  </div>
                  <button
                    onClick={() => setPicked(null)}
                    className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Change
                  </button>
                </div>
              ) : creating ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input placeholder="Full name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
                  <Input placeholder="+91 phone" inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                  <button
                    onClick={() => setCreating(false)}
                    className="text-left font-mono text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                  >
                    ← pick existing customer
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search name or phone…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    {results.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setPicked(c)}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/10"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-[11px] font-bold">
                          {initials(c.full_name ?? "?")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold">{c.full_name}</span>
                          <span className="block font-mono text-[10px] text-muted-foreground">{c.phone ?? "—"}</span>
                        </span>
                      </button>
                    ))}
                    <button
                      onClick={() => setCreating(true)}
                      className="flex w-full items-center gap-2 rounded-xl border border-dashed border-white/15 px-3 py-2 text-[12px] font-semibold text-foreground/80 transition hover:bg-white/5"
                    >
                      <UserPlus className="h-4 w-4" /> New customer
                    </button>
                    <button
                      onClick={() => { setPicked(null); setCreating(false); setSearch(""); }}
                      className="w-full rounded-xl px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                    >
                      or continue as walk-in
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* package */}
            <section className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Package
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PACKAGES.map((p) => {
                  const on = p.label === pkg.label;
                  const cost = p.minutes ? Math.ceil((device.hourly_rate * p.minutes) / 60) : null;
                  return (
                    <button
                      key={p.label}
                      onClick={() => setPkg(p)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${
                        on ? "border-primary/60 bg-primary/12" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                      }`}
                    >
                      <div className="text-[13px] font-bold">{p.label}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {cost === null ? "pay per minute" : `₹${cost}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* payment */}
            <section className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Payment
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition ${
                      method === m ? "border-primary/60 bg-primary/15 text-primary" : "border-white/10 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m === "counter" ? "pay at counter" : m}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                <Input
                  inputMode="numeric"
                  placeholder={String(method === "counter" ? 0 : price)}
                  value={paid}
                  onChange={(e) => setPaid(e.target.value.replace(/[^\d]/g, ""))}
                />
                <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">amount paid</span>
              </div>
            </section>
          </div>

          {/* footer */}
          <div className="border-t border-white/8 p-4">
            <button
              onClick={submit}
              disabled={busy}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
              style={{ background: "var(--gradient-brand-hot)" }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {busy ? "Starting…" : `Start ${pkg.label.toLowerCase()} session`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}
