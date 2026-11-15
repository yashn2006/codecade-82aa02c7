import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Zap,
  CheckCircle2,
  Copy,
  QrCode,
  ShieldCheck,
  Sparkles,
  LifeBuoy,
  LayoutDashboard,
  Check,
  Building2,
  Clock,
  Receipt,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { ConsoleShell } from "@/components/ConsoleShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ImageUploader } from "@/components/ImageUploader";
import { myBilling, ownerCreateUpgradePayment } from "@/lib/billing.functions";
import { guardRoute } from "@/lib/auth-routing";

export const Route = createFileRoute("/_authenticated/owner_/upgrade")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Upgrade Plan — CoreCade Owner" },
      { name: "description", content: "Choose a CoreCade subscription plan, unlock unlimited gaming stations and keep your café console active." },
    ],
  }),
  beforeLoad: () =>
    guardRoute((_user, roles) => (roles.has("cafe_owner") || roles.has("super_admin") ? null : "/portal")),
  component: OwnerUpgradePage,
});

type PlanTier = {
  id: string;
  name: string;
  days: number;
  price: number;
  pricePerMonth: string;
  badge?: string;
  savings?: string;
  featured?: boolean;
  features: string[];
};

const PLANS: PlanTier[] = [
  {
    id: "monthly",
    name: "Monthly Pro",
    days: 30,
    price: 999,
    pricePerMonth: "₹999 / mo",
    features: [
      "Full live floor & station tracking",
      "Unlimited bookings & reservations",
      "POS billing & instant receipts",
      "Loyalty wallet & points engine",
      "Real-time revenue reports",
      "Standard WhatsApp support",
    ],
  },
  {
    id: "quarterly",
    name: "Quarterly Pro",
    days: 90,
    price: 2499,
    pricePerMonth: "₹833 / mo",
    badge: "MOST POPULAR",
    savings: "Save 17%",
    featured: true,
    features: [
      "Everything in Monthly Pro",
      "Priority WhatsApp & ticketing support",
      "Multi-staff role management",
      "Custom tournament builder",
      "Quarterly performance audit",
      "Locked launch rate for renewals",
    ],
  },
  {
    id: "annual",
    name: "Annual Founders",
    days: 365,
    price: 8999,
    pricePerMonth: "₹750 / mo",
    badge: "BEST VALUE",
    savings: "Save 25%",
    features: [
      "Everything in Quarterly Pro",
      "Dedicated account manager",
      "Early access to automated device agents",
      "Featured placement on CoreCade Discover",
      "Custom branding & tournament sponsorship",
      "Zero downtime SLA guarantee",
    ],
  },
];

function OwnerUpgradePage() {
  const qc = useQueryClient();
  const loadBilling = useServerFn(myBilling);
  const submitUpgrade = useServerFn(ownerCreateUpgradePayment);

  const { data, isLoading } = useQuery({
    queryKey: ["my-billing"],
    queryFn: () => loadBilling(),
  });

  const cafes = data?.cafes ?? [];
  const [selectedCafeId, setSelectedCafeId] = useState<string>("");
  const activeCafe = cafes.find((c) => c.id === (selectedCafeId || cafes[0]?.id)) ?? cafes[0];

  const [selectedPlanId, setSelectedPlanId] = useState<string>("quarterly");
  const selectedPlan = PLANS.find((p) => p.id === selectedPlanId) ?? PLANS[1];

  const [txnRef, setTxnRef] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const upgradeMutation = useMutation({
    mutationFn: submitUpgrade,
    onSuccess: () => {
      toast.success("🚀 Upgrade payment submitted! Our team will verify and activate your plan.");
      setTxnRef("");
      setProofUrl(null);
      qc.invalidateQueries({ queryKey: ["my-billing"] });
      qc.invalidateQueries({ queryKey: ["owner-dashboard"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to submit upgrade proof.");
    },
  });

  const upiId = data?.payTo.upi_id?.trim() || "";
  const upiQrString = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent("CoreCade Pro")}&am=${selectedPlan.price}&cu=INR&tn=${encodeURIComponent(`Upgrade ${selectedPlan.name}`)}`
    : "";
  const qrUrl = data?.payTo.qr_url?.trim() || (upiQrString ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiQrString)}` : "");
  const hasPayTarget = Boolean(upiId || qrUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCafe) {
      toast.error("Please create or select a café first.");
      return;
    }
    if (!txnRef.trim() || txnRef.trim().length < 4) {
      toast.error("Please enter a valid 12-digit UPI UTR or Transaction reference number.");
      return;
    }

    upgradeMutation.mutate({
      data: {
        cafe_id: activeCafe.id,
        plan_name: selectedPlan.name,
        duration_days: selectedPlan.days,
        amount_rupees: selectedPlan.price,
        txn_ref: txnRef.trim(),
        proof_url: proofUrl,
      },
    });
  };

  return (
    <ConsoleShell
      badge="Subscription"
      title="Upgrade Plan"
      subtitle="Select a plan, complete payment, and keep your gaming café running seamlessly."
      nav={[
        { label: "Owner Hub", icon: LayoutDashboard, to: "/owner", exact: true, group: "Workspace" },
        { label: "Upgrade Plan", icon: Zap, to: "/owner/upgrade", exact: true, group: "Workspace" },
        { label: "Help Center", icon: LifeBuoy, to: "/owner/help", exact: true, group: "Support" },
      ]}
    >
      <div className="hub-atmos max-w-6xl mx-auto space-y-8">
        {/* HERO SECTION */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="hub-card relative overflow-hidden rounded-3xl p-6 sm:p-8"
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-[90px]"
            style={{ background: "radial-gradient(circle, oklch(0.7 0.26 335 / 0.55), transparent 70%)" }}
          />
          <Zap
            className="pointer-events-none absolute -right-6 bottom-[-20px] h-56 w-56 text-primary/10"
            aria-hidden
          />
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
              <Sparkles className="h-3 w-3" /> Zero Commission · 100% Retained Revenue
            </div>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              Power Up Your <span className="text-gradient-hot">Arcade</span>.
            </h1>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Unlock unlimited live floors, POS billing, automated tournament leaderboards, and real-time player bookings.
              Select your plan below and verify via instant UPI.
            </p>
          </div>
        </motion.section>

        {/* STEP 1: SELECT CAFÉ */}
        {cafes.length > 0 && (
          <div className="hub-card rounded-2xl p-5 border border-white/10 bg-white/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Step 1</div>
                <div className="font-display text-lg font-bold">Select Café to Upgrade</div>
              </div>

              {cafes.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {cafes.map((c) => {
                    const active = (activeCafe?.id === c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCafeId(c.id)}
                        className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                          active
                            ? "border-primary bg-primary/15 text-foreground shadow-[0_0_16px_-4px_oklch(0.7_0.26_335/0.8)]"
                            : "border-white/10 bg-white/[0.04] text-muted-foreground hover:border-white/20 hover:text-foreground"
                        }`}
                      >
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        <span>{c.name}</span>
                        <Badge variant="outline" className="text-[10px] py-0">
                          {c.days_left}d left
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{activeCafe?.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {activeCafe?.days_left ?? 0} days remaining
                  </Badge>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: SELECT PLAN */}
        <div>
          <div className="mb-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Step 2</div>
            <h2 className="text-2xl font-display font-extrabold tracking-tight">Choose Your Subscription Tier</h2>
            <p className="text-xs text-muted-foreground mt-1">
              All plans include complete access to every module. Save more with longer billing cycles.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => {
              const isSelected = selectedPlan.id === plan.id;
              return (
                <motion.div
                  key={plan.id}
                  whileHover={{ y: -4 }}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`relative cursor-pointer rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between ${
                    isSelected
                      ? "border-2 border-primary bg-card/80 shadow-[0_0_32px_-6px_oklch(0.7_0.26_335/0.7)]"
                      : "border border-white/10 bg-card/40 hover:border-white/25 hover:bg-card/60"
                  }`}
                >
                  {plan.badge && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-md shadow-primary/40"
                      style={{ background: "var(--gradient-brand-hot)" }}
                    >
                      {plan.badge}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-display text-xl font-bold">{plan.name}</span>
                      {isSelected ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </span>
                      ) : (
                        <span className="h-5 w-5 rounded-full border border-white/20" />
                      )}
                    </div>

                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className="font-display text-4xl font-extrabold tracking-tight tabular-nums">
                        ₹{plan.price.toLocaleString("en-IN")}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono tabular-nums">
                        / {plan.days} days
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{plan.pricePerMonth}</span>
                      {plan.savings && (
                        <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                          {plan.savings}
                        </span>
                      )}
                    </div>

                    <div className="my-5 h-px bg-white/10" />

                    <ul className="space-y-2.5 text-xs">
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2 text-foreground/85">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/5">
                    <Button
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className="w-full text-xs font-semibold"
                      style={isSelected ? { background: "var(--gradient-brand-hot)" } : {}}
                    >
                      {isSelected ? "Selected" : "Select Plan"}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* STEP 3: PAYMENT & SUBMISSION */}
        <div className="hub-card rounded-3xl p-6 sm:p-8 border border-primary/25 bg-primary/[0.04] backdrop-blur-xl">
          <div className="mb-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Step 3</div>
            <h2 className="text-2xl font-display font-extrabold tracking-tight">
              Pay ₹{selectedPlan.price.toLocaleString("en-IN")} via UPI & Submit UTR
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Scan the QR code with any UPI app (GPay, PhonePe, Paytm, BHIM, Cred) or transfer to the UPI ID.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] items-start">
            {/* QR Card */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/15 bg-black/40 p-5 text-center shadow-lg">
              {qrUrl ? (
                <div className="relative overflow-hidden rounded-xl bg-white p-2">
                  <img
                    src={qrUrl}
                    alt={`Scan to pay ₹${selectedPlan.price} CoreCade`}
                    className="h-48 w-48 object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-48 w-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-4 text-xs text-muted-foreground">
                  <QrCode className="h-8 w-8 text-primary/70" />
                  <span>Billing UPI QR is being configured. Contact support if urgent.</span>
                </div>
              )}

              {upiId ? (
                <div className="mt-4 w-full">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">UPI ID</div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(upiId);
                      toast.success("UPI ID copied to clipboard!");
                    }}
                    className="mt-1 flex min-h-[40px] items-center justify-center gap-1.5 w-full rounded-lg border border-white/10 bg-white/5 py-1.5 px-2.5 text-xs font-mono font-semibold hover:bg-white/10 transition"
                  >
                    <span className="truncate">{upiId}</span>
                    <Copy className="h-3.5 w-3.5 shrink-0 text-primary" />
                  </button>
                </div>
              ) : (
                <div className="mt-4 w-full rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
                  Admin has not saved a platform UPI ID yet.
                </div>
              )}

              <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Manual verification in minutes</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs space-y-2">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Target Café:</span>
                  <span className="font-semibold text-foreground">{activeCafe?.name ?? "No café"}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Selected Plan:</span>
                  <span className="font-semibold text-foreground">{selectedPlan.name} ({selectedPlan.days} days)</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground pt-1 border-t border-white/10">
                  <span className="font-semibold text-foreground">Total Payable:</span>
                  <span className="font-display text-lg font-bold text-gradient-hot">
                    ₹{selectedPlan.price.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="txnRef" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  UPI Reference / UTR Number *
                </Label>
                <Input
                  id="txnRef"
                  required
                  placeholder="e.g. 418293847291 or UPI Ref ID"
                  value={txnRef}
                  onChange={(e) => setTxnRef(e.target.value)}
                  className="h-12 font-mono text-base bg-background/60"
                />
                <p className="text-[11px] text-muted-foreground">
                  You can find this 12-digit number in the payment receipt of Google Pay, PhonePe, or Paytm.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Payment Screenshot (Optional but recommended)
                </Label>
                <div className="flex items-center gap-3">
                  <ImageUploader
                    cafeId={activeCafe?.id}
                    folder="payment-proof"
                    label={proofUrl ? "Screenshot attached ✓" : "Upload Payment Screenshot"}
                    onUploaded={(url) => {
                      setProofUrl(url);
                      toast.success("Screenshot attached!");
                    }}
                  />
                  {proofUrl && (
                    <span className="text-xs text-emerald-400 font-medium">
                      Screenshot uploaded successfully
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={!hasPayTarget || upgradeMutation.isPending || txnRef.trim().length < 4}
                  className="w-full h-12 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 tabular-nums"
                  style={{ background: "var(--gradient-brand-hot)" }}
                >
                  {upgradeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Submitting payment verification…
                    </>
                  ) : !hasPayTarget ? (
                    <>Billing UPI setup pending — check Help Center</>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Submit Upgrade Payment (₹{selectedPlan.price.toLocaleString("en-IN")})
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* RECENT INVOICES / BILLING HISTORY */}
        {data?.invoices && data.invoices.length > 0 && (
          <div className="hub-card rounded-3xl p-6 border border-white/10 bg-card/30">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="h-4 w-4 text-primary" />
              <h3 className="font-display text-lg font-bold">Your Invoices & Upgrade Requests</h3>
            </div>

            <div className="space-y-2.5">
              {data.invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs"
                >
                  <div>
                    <div className="font-semibold text-sm">
                      ₹{Math.round(inv.amount_paise / 100).toLocaleString("en-IN")} · {inv.days} days
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {inv.note || "Subscription Plan"} · {new Date(inv.created_at).toLocaleDateString()}
                    </div>
                    {inv.txn_ref && (
                      <div className="font-mono text-[11px] text-primary mt-1">
                        UTR: {inv.txn_ref}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        inv.status === "approved"
                          ? "default"
                          : inv.status === "submitted"
                          ? "secondary"
                          : "outline"
                      }
                      className={inv.status === "approved" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : ""}
                    >
                      {inv.status === "submitted"
                        ? "Under review"
                        : inv.status === "approved"
                        ? "Active / Approved"
                        : "Pending"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ConsoleShell>
  );
}
