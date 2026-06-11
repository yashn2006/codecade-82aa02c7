import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Settings, Save, IndianRupee, Percent, Mail, Phone, ShieldCheck, UserPlus, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { getPlatformConfig, savePlatformConfig } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/config")({
  head: () => ({
    meta: [
      { title: "Platform config — CoreCade admin" },
      { name: "description", content: "Network-wide configuration: fees, taxes, currency, branding and signup controls." },
    ],
  }),
  component: ConfigPanel,
});

type Cfg = {
  platform_fee_pct: number; default_tax_pct: number; currency: string;
  support_email: string | null; support_phone: string | null;
  brand_name: string | null; brand_tagline: string | null;
  signup_enabled: boolean; new_cafes_require_approval: boolean;
};

function ConfigPanel() {
  const getFn = useServerFn(getPlatformConfig);
  const saveFn = useServerFn(savePlatformConfig);
  const q = useQuery({ queryKey: ["platform-config"], queryFn: () => getFn() });
  const [c, setC] = useState<Cfg | null>(null);

  useEffect(() => {
    if (q.data) {
      const d = q.data as Partial<Cfg>;
      setC({
        platform_fee_pct: Number(d.platform_fee_pct ?? 0),
        default_tax_pct: Number(d.default_tax_pct ?? 0),
        currency: d.currency ?? "INR",
        support_email: d.support_email ?? null,
        support_phone: d.support_phone ?? null,
        brand_name: d.brand_name ?? null,
        brand_tagline: d.brand_tagline ?? null,
        signup_enabled: d.signup_enabled ?? true,
        new_cafes_require_approval: d.new_cafes_require_approval ?? false,
      });
    }
  }, [q.data]);

  const m = useMutation({
    mutationFn: saveFn,
    onSuccess: () => toast.success("Config saved"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!c) return <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/30" />;

  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setC((p) => p ? { ...p, [k]: v } : p);

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Network-wide settings</div>
        <h2 className="font-display text-3xl font-extrabold">Platform config</h2>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); m.mutate({ data: c }); }}
        className="space-y-5"
      >
        <Section icon={Percent} title="Fees & taxes" desc="Defaults used across all cafés.">
          <div className="grid gap-3 sm:grid-cols-3">
            <NumField label="Platform fee %" icon={Percent} value={c.platform_fee_pct} onChange={(v) => set("platform_fee_pct", v)} step={0.1} />
            <NumField label="Default tax %" icon={Percent} value={c.default_tax_pct} onChange={(v) => set("default_tax_pct", v)} step={0.1} />
            <TextField label="Currency code" icon={IndianRupee} value={c.currency} onChange={(v) => set("currency", v.toUpperCase())} maxLength={8} />
          </div>
        </Section>

        <Section icon={Building2} title="Branding" desc="Shown in emails, public pages and the marketing site.">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Brand name" value={c.brand_name ?? ""} onChange={(v) => set("brand_name", v || null)} maxLength={80} />
            <TextField label="Support email" icon={Mail} value={c.support_email ?? ""} onChange={(v) => set("support_email", v || null)} maxLength={200} type="email" />
            <TextField label="Support phone" icon={Phone} value={c.support_phone ?? ""} onChange={(v) => set("support_phone", v || null)} maxLength={40} />
          </div>
          <div className="mt-3 space-y-1.5">
            <Label>Tagline</Label>
            <Textarea value={c.brand_tagline ?? ""} onChange={(e) => set("brand_tagline", e.target.value || null)} rows={2} maxLength={160} />
          </div>
        </Section>

        <Section icon={ShieldCheck} title="Access & signup" desc="Throttle who can join the network.">
          <ToggleRow
            icon={UserPlus} label="Allow new user signups"
            desc="Disable to temporarily freeze account creation."
            checked={c.signup_enabled} onChange={(v) => set("signup_enabled", v)}
          />
          <ToggleRow
            icon={Building2} label="New cafés require manual approval"
            desc="When on, super-admin must activate a café before it goes live."
            checked={c.new_cafes_require_approval} onChange={(v) => set("new_cafes_require_approval", v)}
          />
        </Section>

        <div className="flex justify-end">
          <Button type="submit" disabled={m.isPending} className="gap-2" style={{ background: "var(--gradient-brand-hot)" }}>
            <Save className="h-4 w-4" /> {m.isPending ? "Saving…" : "Save config"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ icon: Icon, title, desc, children }: { icon: typeof Settings; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <div className="font-display text-lg font-bold">{title}</div>
      </div>
      {desc && <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>}
      <div className="mt-4">{children}</div>
    </motion.div>
  );
}

function NumField({ label, value, onChange, step = 1, icon: Icon }: { label: string; value: number; onChange: (v: number) => void; step?: number; icon?: typeof Settings }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">{Icon && <Icon className="h-3 w-3" />} {label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
function TextField({ label, value, onChange, maxLength, type, icon: Icon }: { label: string; value: string; onChange: (v: string) => void; maxLength?: number; type?: string; icon?: typeof Settings }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">{Icon && <Icon className="h-3 w-3" />} {label}</Label>
      <Input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} />
    </div>
  );
}
function ToggleRow({ icon: Icon, label, desc, checked, onChange }: { icon: typeof Settings; label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/40 bg-background/40 px-3 py-3">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 text-primary" />
        <div>
          <div className="text-sm font-medium">{label}</div>
          {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
