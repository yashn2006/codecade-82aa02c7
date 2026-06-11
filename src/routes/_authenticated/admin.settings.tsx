import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shield, Globe, Mail, Database, KeyRound, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPanel,
});

function SettingsPanel() {
  const sections = [
    { icon: Shield, title: "Security", desc: "Roles, super-admin grants, audit log.", to: "/admin/users", cta: "Manage roles" },
    { icon: Globe, title: "Public landing", desc: "Hero stats, testimonials and the marketing page.", to: "/", cta: "View landing" },
    { icon: Mail, title: "Lead inbox", desc: "Inbound contacts from the marketing site.", to: "/admin/leads", cta: "Open inbox" },
    { icon: Database, title: "Data & backups", desc: "Database snapshots and exports — coming soon.", cta: "Coming soon" },
    { icon: KeyRound, title: "API keys", desc: "Issue and rotate API tokens — coming soon.", cta: "Coming soon" },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sections.map((s, i) => (
        <motion.div
          key={s.title}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur hover-lift"
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet/20 blur-2xl" />
          <s.icon className="relative h-5 w-5 text-primary" />
          <h3 className="relative mt-3 font-display text-lg font-bold">{s.title}</h3>
          <p className="relative mt-1 text-sm text-muted-foreground">{s.desc}</p>
          <div className="relative mt-4">
            {s.to ? (
              <Link to={s.to} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                {s.cta} <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{s.cta}</span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
