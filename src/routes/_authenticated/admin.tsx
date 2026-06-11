import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shield, Users, Building2, FileText } from "lucide-react";
import { PortalShell } from "./portal";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Giganexa" }] }),
  component: Admin,
});

function Admin() {
  const cards = [
    { icon: Building2, label: "Cafés", value: "—" },
    { icon: Users, label: "Users", value: "—" },
    { icon: Shield, label: "Active Sessions", value: "—" },
    { icon: FileText, label: "Contact Leads", value: "—" },
  ];
  return (
    <PortalShell title="Super Admin" subtitle="Platform-wide controls. Phase 2 brings the full dashboard." badge="Super Admin">
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-6"
          >
            <c.icon className="h-7 w-7 text-primary" />
            <div className="mt-4 font-mono text-3xl font-bold text-gradient">{c.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{c.label}</div>
          </motion.div>
        ))}
      </div>
      <div className="mt-12 glass rounded-2xl p-10 text-center">
        <Shield className="mx-auto h-12 w-12 text-magenta" />
        <h2 className="mt-4 font-display text-2xl font-bold">Foundation complete</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Auth, roles, schema, and design system are live. CRUD modules ship in Phase 2.
        </p>
      </div>
    </PortalShell>
  );
}
