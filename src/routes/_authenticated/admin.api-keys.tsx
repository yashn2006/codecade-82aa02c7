import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { KeyRound, Copy, ExternalLink, ShieldAlert, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/api-keys")({
  component: ApiKeysPage,
});

type KeyRow = {
  name: string;
  desc: string;
  scope: "public" | "secret";
  value?: string;
  manageUrl?: string;
};

function ApiKeysPage() {
  const publishable = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY
    ?? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ?? "";
  const supaUrl = (import.meta as any).env?.VITE_SUPABASE_URL ?? "";

  const keys: KeyRow[] = [
    {
      name: "SUPABASE_URL",
      desc: "Project URL — used by every Supabase client.",
      scope: "public",
      value: supaUrl,
    },
    {
      name: "SUPABASE_PUBLISHABLE_KEY",
      desc: "Browser-safe key. RLS enforced — safe to ship in the app bundle.",
      scope: "public",
      value: publishable ? publishable.slice(0, 24) + "…" : "",
    },
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      desc: "Server-only. Bypasses RLS. Never expose in client code or commit to git.",
      scope: "secret",
    },
    {
      name: "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET",
      desc: "Used by /api/public/razorpay/* to create orders and verify webhook signatures.",
      scope: "secret",
    },
    {
      name: "LOVABLE_API_KEY",
      desc: "Lovable AI gateway key for any AI-powered feature.",
      scope: "secret",
    },
  ];

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied"),
      () => toast.error("Copy failed"),
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-card/60 to-violet-500/10 p-5 backdrop-blur"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-fuchsia-300" />
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300">API keys</div>
            </div>
            <h2 className="mt-1 font-display text-2xl font-bold">Credentials & integrations</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Every secret used by CoreCade is managed centrally through Lovable Cloud / Supabase secrets.
              Rotating a secret here updates every server function automatically — no redeploy needed.
            </p>
          </div>
          <a
            href="https://supabase.com/dashboard/project/_/settings/api"
            target="_blank" rel="noreferrer"
          >
            <Button className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
              <ExternalLink className="h-4 w-4" />
              Manage in Supabase
            </Button>
          </a>
        </div>
      </motion.div>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        <div className="flex items-center gap-2 text-amber-200">
          <ShieldAlert className="h-4 w-4" />
          <span className="font-medium">Security best-practices</span>
        </div>
        <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
          <li>Never paste a secret key into chat, git, or front-end code.</li>
          <li>Rotate immediately if a teammate leaves or a key is accidentally logged.</li>
          <li>Use the Razorpay test keys during development; switch to live keys only when going public.</li>
        </ul>
      </div>

      <div className="grid gap-3">
        {keys.map((k, i) => (
          <motion.div
            key={k.name}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {k.scope === "secret" ? (
                    <Lock className="h-4 w-4 text-rose-300" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-emerald-300" />
                  )}
                  <code className="font-mono text-sm font-semibold">{k.name}</code>
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${
                    k.scope === "secret"
                      ? "bg-rose-500/15 text-rose-200"
                      : "bg-emerald-500/15 text-emerald-200"
                  }`}>
                    {k.scope}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{k.desc}</p>
                {k.value && (
                  <div className="mt-2 flex items-center gap-2">
                    <code className="truncate rounded bg-background/60 px-2 py-1 font-mono text-xs">{k.value}</code>
                    <Button size="sm" variant="ghost" onClick={() => copy(k.value!)} className="h-7 gap-1.5 px-2">
                      <Copy className="h-3 w-3" /> Copy
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
