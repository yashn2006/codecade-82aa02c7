import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Shield, Users, Building2, FileText, Activity, IndianRupee,
  Cpu, Wifi, ArrowUpRight, Sparkles,
} from "lucide-react";
import { PortalShell } from "./portal";
import { AnimatedNumber } from "@/components/AnimatedNumber";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Super Admin — CoreCade" }] }),
  component: Admin,
});

function Admin() {
  const kpis = [
    { icon: Building2, label: "Cafés onboarded", value: 0, accent: "violet" as const, hint: "Phase 2" },
    { icon: Users, label: "Total users", value: 1, accent: "azure" as const, hint: "+1 today" },
    { icon: Activity, label: "Active sessions", value: 0, accent: "magenta" as const, hint: "Realtime" },
    { icon: FileText, label: "Contact leads", value: 0, accent: "violet" as const, hint: "Inbox" },
  ];

  return (
    <PortalShell title="Super Admin" subtitle="Platform-wide controls. Watch the network breathe." badge="Super Admin">
      {/* KPI grid */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur hover-lift hover:border-primary/40"
          >
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl opacity-50 transition-opacity duration-500 group-hover:opacity-90"
              style={{ background: `oklch(var(--${k.accent}) / 0.5)` }}
            />
            <div className="relative flex items-start justify-between">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/60`}>
                <k.icon className={`h-4.5 w-4.5 text-${k.accent}`} />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{k.hint}</span>
            </div>
            <div className="relative mt-5 font-display text-4xl font-extrabold tracking-tight">
              <AnimatedNumber value={k.value} />
            </div>
            <div className="relative mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{k.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Network pulse + Quick actions */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="border-conic rounded-2xl p-px lg:col-span-2"
        >
          <div className="relative overflow-hidden rounded-2xl bg-card/60 p-6 backdrop-blur">
            <div className="absolute inset-0 grid-arcade opacity-40" />
            <div className="relative flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Network pulse</div>
                <h3 className="mt-1 font-display text-xl font-bold">All systems nominal</h3>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-3 py-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400">Online</span>
              </div>
            </div>

            {/* Sparkline-ish bars */}
            <div className="relative mt-8 flex h-28 items-end gap-1.5">
              {Array.from({ length: 48 }).map((_, i) => {
                const h = 25 + Math.abs(Math.sin(i * 0.55) * 60) + (i % 7) * 4;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${Math.min(h, 100)}%`,
                      background: `linear-gradient(to top, oklch(0.62 0.27 295 / 0.85), oklch(0.65 0.24 255 / 0.55))`,
                      animation: `pulse-soft ${2 + (i % 5) * 0.3}s ease-in-out ${i * 0.04}s infinite`,
                    }}
                  />
                );
              })}
            </div>

            <div className="relative mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Avg latency", value: "42ms", c: "text-violet" },
                { label: "Uptime 30d", value: "99.98%", c: "text-azure" },
                { label: "API calls/min", value: "1.2k", c: "text-magenta" },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border border-border/40 bg-background/40 p-3">
                  <div className={`font-mono text-lg font-bold ${m.c}`}>{m.value}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Quick actions</div>
          </div>
          <h3 className="mt-1 font-display text-xl font-bold">Command deck</h3>
          <div className="mt-5 space-y-2">
            {[
              { icon: Building2, label: "Onboard a café", c: "violet" },
              { icon: Users, label: "Invite a user", c: "azure" },
              { icon: Shield, label: "Grant a role", c: "magenta" },
              { icon: FileText, label: "Review leads", c: "violet" },
            ].map((a) => (
              <button
                key={a.label}
                className="group flex w-full items-center justify-between rounded-xl border border-border/40 bg-background/40 px-4 py-3 text-sm transition hover:border-primary/40 hover:bg-background/70"
              >
                <span className="flex items-center gap-3">
                  <a.icon className={`h-4 w-4 text-${a.c}`} />
                  {a.label}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Phase ribbon */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
        className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-card/30 p-6 backdrop-blur"
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl glow-magenta" style={{ background: "var(--gradient-brand-hot)" }}>
              <Cpu className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Phase 1 · Foundation</div>
              <h3 className="font-display text-lg font-bold">Auth, roles, schema, and design system are live.</h3>
              <p className="mt-1 text-sm text-muted-foreground">Phase 2 ships café CRUD, live sessions, bookings, and the Razorpay flow.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-3 py-1.5">
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">Cloud · OK</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-3 py-1.5">
              <IndianRupee className="h-3.5 w-3.5 text-azure" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">Billing · Setup</span>
            </div>
          </div>
        </div>
      </motion.div>
    </PortalShell>
  );
}
