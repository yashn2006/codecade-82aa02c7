import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { IndianRupee, QrCode, Receipt, CheckCircle2, XCircle, ExternalLink, Save } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  adminListSubscriptions,
  adminListInvoices,
  adminCreateInvoice,
  adminReviewInvoice,
  getBillingDetails,
  setBillingDetails,
} from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/admin/billing")({
  head: () => ({
    meta: [
      { title: "Billing — CoreCade Admin" },
      { name: "description", content: "Charge cafés, share your UPI QR, verify payment proof and resume subscriptions." },
      { property: "og:title", content: "Billing — CoreCade Admin" },
      { property: "og:description", content: "Charge cafés and approve payments to add subscription days." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingPanel,
});

const money = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

const STATUS_TONE: Record<string, string> = {
  pending: "#f59e0b",
  submitted: "#38bdf8",
  approved: "#22c55e",
  rejected: "#f43f5e",
};

function BillingPanel() {
  const qc = useQueryClient();
  const listCafes = useServerFn(adminListSubscriptions);
  const listInvoices = useServerFn(adminListInvoices);
  const createInvoice = useServerFn(adminCreateInvoice);
  const reviewInvoice = useServerFn(adminReviewInvoice);
  const getDetails = useServerFn(getBillingDetails);
  const saveDetails = useServerFn(setBillingDetails);

  const cafes = useQuery({ queryKey: ["admin-subscriptions"], queryFn: () => listCafes() });
  const invoices = useQuery({ queryKey: ["admin-invoices"], queryFn: () => listInvoices(), refetchInterval: 30000 });
  const details = useQuery({ queryKey: ["billing-details"], queryFn: () => getDetails() });

  const [cafeId, setCafeId] = useState("");
  const [amount, setAmount] = useState("999");
  const [days, setDays] = useState("30");
  const [note, setNote] = useState("");

  const [upi, setUpi] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [payNote, setPayNote] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);

  const d = details.data;
  const upiVal = upi ?? d?.upi_id ?? "";
  const qrVal = qr ?? d?.qr_url ?? "";
  const noteVal = payNote ?? d?.note ?? "";
  const priceVal = price ?? String(d?.monthly_price_rupees ?? 999);

  const charge = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      toast.success("Charge sent to the café owner.");
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create the charge"),
  });

  const review = useMutation({
    mutationFn: reviewInvoice,
    onSuccess: (res) => {
      toast.success(res.new_ends_at ? `Approved · active until ${new Date(res.new_ends_at).toDateString()}` : "Marked as rejected");
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
      qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["admin-cafes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  const save = useMutation({
    mutationFn: saveDetails,
    onSuccess: () => {
      toast.success("Payment details saved.");
      qc.invalidateQueries({ queryKey: ["billing-details"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const rows = invoices.data ?? [];
  const awaiting = rows.filter((r) => r.status === "submitted");
  const collected = rows.filter((r) => r.status === "approved").reduce((s, r) => s + r.amount_paise, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Awaiting review", value: String(awaiting.length), icon: Receipt, c: "#38bdf8" },
          { label: "Collected", value: money(collected), icon: IndianRupee, c: "#22c55e" },
          { label: "Total charges", value: String(rows.length), icon: QrCode, c: "#a78bfa" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <s.icon className="h-3.5 w-3.5" style={{ color: s.c }} /> {s.label}
            </div>
            <div className="mt-1 font-display text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Charge a café */}
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
          <h2 className="font-display text-lg font-bold">Charge a café</h2>
          <p className="mt-1 text-xs text-muted-foreground">The owner is notified and can pay, then send you the transaction ID.</p>
          <div className="mt-4 space-y-3">
            <select
              value={cafeId}
              onChange={(e) => setCafeId(e.target.value)}
              className="h-10 w-full rounded-xl border border-border/70 bg-background/60 px-3 text-sm"
            >
              <option value="">Select a café…</option>
              {(cafes.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.days_left}d left
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-[11px] text-muted-foreground">Amount (₹)</div>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
              </div>
              <div>
                <div className="mb-1 text-[11px] text-muted-foreground">Days on payment</div>
                <Input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
              </div>
            </div>
            <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button
              className="w-full"
              disabled={!cafeId || charge.isPending}
              onClick={() =>
                charge.mutate({
                  data: {
                    cafe_id: cafeId,
                    amount_rupees: Number(amount) || 0,
                    days: Number(days) || 30,
                    note: note.trim() || null,
                  },
                })
              }
            >
              {charge.isPending ? "Sending…" : "Send charge"}
            </Button>
          </div>
        </div>

        {/* Your payment details */}
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
          <h2 className="font-display text-lg font-bold">Your payment details</h2>
          <p className="mt-1 text-xs text-muted-foreground">Shown to every café owner when they pay.</p>
          <div className="mt-4 space-y-3">
            <Input placeholder="UPI ID (e.g. corecade@upi)" value={upiVal} onChange={(e) => setUpi(e.target.value)} />
            <Input placeholder="QR image URL" value={qrVal} onChange={(e) => setQr(e.target.value)} />
            <Input placeholder="Monthly price (₹)" value={priceVal} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" />
            <Input placeholder="Note for owners (optional)" value={noteVal} onChange={(e) => setPayNote(e.target.value)} />
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({
                    data: {
                      upi_id: upiVal.trim() || null,
                      qr_url: qrVal.trim() || null,
                      note: noteVal.trim() || null,
                      monthly_price_rupees: Number(priceVal) || 0,
                    },
                  })
                }
              >
                <Save className="mr-1.5 h-4 w-4" /> {save.isPending ? "Saving…" : "Save"}
              </Button>
              {qrVal ? (
                <img src={qrVal} alt="Payment QR code" className="h-16 w-16 rounded-lg border border-border/60 object-cover" />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Charges */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur">
        <div className="border-b border-border/60 px-5 py-4">
          <h2 className="font-display text-lg font-bold">Charges & payment proof</h2>
        </div>
        {invoices.isLoading ? (
          <div className="p-5 text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">No charges yet.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {rows.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="flex flex-wrap items-center gap-3 px-5 py-4"
              >
                <div className="min-w-[180px] flex-1">
                  <div className="text-sm font-semibold">{r.cafe_name ?? "—"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {money(r.amount_paise)} · {r.days} days
                    {r.note ? ` · ${r.note}` : ""}
                  </div>
                </div>

                <div className="min-w-[170px] text-[11px] text-muted-foreground">
                  {r.txn_ref ? (
                    <div>
                      Txn: <span className="font-mono text-foreground">{r.txn_ref}</span>
                    </div>
                  ) : (
                    <div>No transaction ID yet</div>
                  )}
                  {r.proof_url ? (
                    <a
                      href={r.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      View screenshot <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>

                <Badge variant="outline" style={{ color: STATUS_TONE[r.status] ?? undefined, borderColor: `${STATUS_TONE[r.status] ?? "#666"}55` }}>
                  {r.status}
                </Badge>

                {r.status !== "approved" ? (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ data: { id: r.id, action: "approve" } })}>
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ data: { id: r.id, action: "reject", review_note: "Could not verify this payment." } })}
                    >
                      <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    Approved {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : ""}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
