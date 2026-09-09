import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, QrCode, Copy, Receipt, CheckCircle2, History } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageUploader } from "@/components/ImageUploader";
import { myBilling, submitInvoiceProof } from "@/lib/billing.functions";

const money = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

function tone(days: number, status: string | null) {
  if (status === "expired" || days === 0) return "#f43f5e";
  if (days <= 5) return "#f43f5e";
  if (days <= 10) return "#f59e0b";
  return "#22c55e";
}

/** Subscription days left, extension history, and pay-then-submit-proof. */
export function OwnerBilling() {
  const qc = useQueryClient();
  const load = useServerFn(myBilling);
  const submit = useServerFn(submitInvoiceProof);
  const { data, isLoading } = useQuery({ queryKey: ["my-billing"], queryFn: () => load(), refetchInterval: 60000 });

  const [txn, setTxn] = useState<Record<string, string>>({});
  const [proof, setProof] = useState<Record<string, string>>({});

  const send = useMutation({
    mutationFn: submit,
    onSuccess: () => {
      toast.success("Sent for review. We'll resume your subscription once verified.");
      qc.invalidateQueries({ queryKey: ["my-billing"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not submit"),
  });

  if (isLoading || !data) {
    return <div className="h-40 animate-pulse rounded-3xl border border-border/40 bg-card/30" />;
  }

  const open = (data.invoices ?? []).filter((i) => i.status === "pending" || i.status === "submitted");
  const events = (data.events ?? []).slice(0, 6);

  return (
    <div className="hub-card relative overflow-hidden rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Subscription</div>
          <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight">Days left & payments</h2>
        </div>
        <span className="text-xs text-muted-foreground">₹{data.payTo.monthly_price_rupees.toLocaleString("en-IN")}/month</span>
      </div>

      {/* Days left per café */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {data.cafes.map((c) => {
          const col = tone(c.days_left, c.subscription_status);
          return (
            <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-sm font-semibold">{c.name}</div>
                <Badge variant="outline" style={{ color: col, borderColor: `${col}55` }}>
                  {c.subscription_status ?? "trialing"}
                </Badge>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-3xl font-extrabold" style={{ color: col }}>{c.days_left}</span>
                <span className="text-xs text-muted-foreground">days left</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                {c.trial_ends_at ? `Active until ${new Date(c.trial_ends_at).toDateString()}` : "No end date set"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Extension history */}
      {events.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Recent extensions
          </div>
          <div className="space-y-1.5">
            {events.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs">
                <span className="text-emerald-300">+{e.added_days} days</span>
                <span className="truncate px-3 text-muted-foreground">{e.reason ?? e.source}</span>
                <span className="text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open charges */}
      {open.length > 0 && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" /> Payments due
          </div>

          <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-4">
            <div className="flex flex-wrap items-center gap-4">
              {data.payTo.qr_url ? (
                <img src={data.payTo.qr_url} alt="Scan to pay CoreCade" className="h-28 w-28 rounded-xl border border-border/60 object-cover" />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-border/60 text-muted-foreground">
                  <QrCode className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 text-sm">
                <div className="text-muted-foreground">Pay to</div>
                <button
                  type="button"
                  onClick={() => {
                    if (!data.payTo.upi_id) return;
                    navigator.clipboard.writeText(data.payTo.upi_id);
                    toast.success("UPI ID copied");
                  }}
                  className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-base font-semibold hover:text-primary"
                >
                  {data.payTo.upi_id ?? "UPI ID not set"} <Copy className="h-3.5 w-3.5" />
                </button>
                {data.payTo.note ? <p className="mt-1 text-xs text-muted-foreground">{data.payTo.note}</p> : null}
              </div>
            </div>
          </div>

          {open.map((inv) => (
            <div key={inv.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">
                  {money(inv.amount_paise)} · {inv.days} days
                </div>
                <Badge variant="outline">{inv.status === "submitted" ? "Under review" : "Awaiting payment"}</Badge>
              </div>
              {inv.note ? <p className="mt-1 text-xs text-muted-foreground">{inv.note}</p> : null}

              {inv.status === "submitted" ? (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-sky-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Transaction {inv.txn_ref} sent — we're verifying it.
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Transaction / UTR ID"
                    value={txn[inv.id] ?? ""}
                    onChange={(e) => setTxn((t) => ({ ...t, [inv.id]: e.target.value }))}
                    className="h-9 max-w-[240px]"
                  />
                  <ImageUploader
                    cafeId={inv.cafe_id}
                    folder="payment-proof"
                    label={proof[inv.id] ? "Screenshot added" : "Upload screenshot"}
                    onUploaded={(url) => setProof((p) => ({ ...p, [inv.id]: url }))}
                  />
                  <Button
                    size="sm"
                    disabled={(txn[inv.id] ?? "").trim().length < 3 || send.isPending}
                    onClick={() =>
                      send.mutate({
                        data: {
                          invoice_id: inv.id,
                          txn_ref: (txn[inv.id] ?? "").trim(),
                          proof_url: proof[inv.id] ?? null,
                        },
                      })
                    }
                  >
                    Submit payment
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
