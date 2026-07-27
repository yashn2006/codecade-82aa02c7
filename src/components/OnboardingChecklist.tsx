import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2, Circle, Cpu, CalendarRange, Users, Receipt, Globe, ChevronDown, Sparkles,
} from "lucide-react";

export type CafeProgress = {
  slug: string;
  devices: number;
  customers: number;
  bookings: number;
  revenue: number;
};

export function OnboardingChecklist({ cafe }: { cafe: CafeProgress }) {
  const [open, setOpen] = useState(false);

  const steps = [
    { done: cafe.devices > 0,   label: "Add your first device",   to: "/cafe/$slug/devices",   icon: Cpu,           hint: "PS5, PC, Xbox — whatever you run" },
    { done: cafe.customers > 0, label: "Register first customer", to: "/cafe/$slug/customers", icon: Users,         hint: "Or let them sign up via your public page" },
    { done: cafe.bookings > 0,  label: "Take your first booking", to: "/cafe/$slug/bookings",  icon: CalendarRange, hint: "Owner-side or public — both count" },
    { done: cafe.revenue > 0,   label: "Run a paid session",      to: "/cafe/$slug/floor",     icon: Receipt,       hint: "Start a session from the live floor" },
    { done: false,              label: "Share your public page",  to: "/cafe/$slug/page",      icon: Globe,         hint: "Your bookable storefront URL" },
  ];
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  if (done === steps.length) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/25 bg-primary/[0.06] backdrop-blur">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <span className="shrink-0 text-sm font-semibold">
          {done}/{steps.length} complete · {pct}%
        </span>
        <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
          <motion.span
            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7 }}
            className="block h-full rounded-full" style={{ background: "var(--gradient-brand-hot)" }}
          />
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <ul className="grid gap-2 border-t border-primary/20 p-3 sm:grid-cols-2">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link
                    to={s.to}
                    params={{ slug: cafe.slug }}
                    className={`group flex items-start gap-3 rounded-xl border p-3 transition ${
                      s.done
                        ? "border-emerald-400/30 bg-emerald-400/5"
                        : "border-white/10 bg-background/40 hover:border-primary/40"
                    }`}
                  >
                    {s.done
                      ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${s.done ? "text-emerald-200 line-through opacity-70" : ""}`}>
                        {s.label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">{s.hint}</span>
                    </span>
                    <s.icon className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
