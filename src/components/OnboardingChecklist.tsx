import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Cpu, CalendarRange, Users, Receipt, Globe, Sparkles } from "lucide-react";

export type CafeProgress = {
  slug: string;
  devices: number;
  customers: number;
  bookings: number;
  revenue: number;
};

export function OnboardingChecklist({ cafe }: { cafe: CafeProgress }) {
  const steps = [
    { done: cafe.devices > 0,   label: "Add your first device",  to: "/cafe/$slug/devices",  icon: Cpu,           hint: "PS5, PC, Xbox — whatever you run" },
    { done: cafe.customers > 0, label: "Register first customer", to: "/cafe/$slug/customers", icon: Users,         hint: "Or let them sign up via your public page" },
    { done: cafe.bookings > 0,  label: "Take your first booking", to: "/cafe/$slug/bookings", icon: CalendarRange, hint: "Owner-side or public — both count" },
    { done: cafe.revenue > 0,   label: "Run a paid session",      to: "/cafe/$slug/floor",    icon: Receipt,       hint: "Start a session from the live floor" },
    { done: false,              label: "Share your public page",  to: "/cafe/$slug/page",     icon: Globe,         hint: "Your bookable storefront URL" },
  ];
  const done = steps.filter(s => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  if (done === steps.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="mb-6 overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/40 to-violet-500/10 p-5 backdrop-blur"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">
            <Sparkles className="mr-1 inline h-3 w-3" /> Getting started
          </div>
          <h3 className="font-display text-xl font-extrabold tracking-tight">
            {done} of {steps.length} steps complete
          </h3>
        </div>
        <div className="text-2xl font-display font-extrabold text-primary">{pct}%</div>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
          className="h-full rounded-full" style={{ background: "var(--gradient-brand-hot)" }}
        />
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.label}>
            <Link
              to={s.to}
              params={{ slug: cafe.slug }}
              className={`group flex items-start gap-3 rounded-xl border p-3 transition ${
                s.done
                  ? "border-emerald-400/30 bg-emerald-400/5"
                  : "border-border/60 bg-card/40 hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              {s.done
                ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-semibold ${s.done ? "text-emerald-200 line-through" : "text-foreground"}`}>
                  {s.label}
                </div>
                <div className="text-xs text-muted-foreground">{s.hint}</div>
              </div>
              <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
