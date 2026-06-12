import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Activity, Building2, Users, Receipt, ScrollText, Settings, TrendingUp, Cpu, CalendarRange, UtensilsCrossed, Crown, Trophy, LayoutGrid, Shield, Wallet, LineChart, BarChart3, Megaphone, FileText, Home } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Cafe = { id: string; name: string; slug: string };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || cafes.length) return;
    supabase.from("cafes").select("id, name, slug").limit(50).then(({ data }) => {
      if (data) setCafes(data as Cafe[]);
    });
  }, [open, cafes.length]);

  const go = (to: string, params?: Record<string, string>) => {
    setOpen(false);
    (navigate as unknown as (o: { to: string; params?: Record<string, string> }) => void)({ to, params });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search cafés, pages, actions… (⌘K)" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {cafes.length > 0 && (
          <CommandGroup heading="Cafés">
            {cafes.map((c) => (
              <CommandItem key={c.id} value={`cafe ${c.name} ${c.slug}`} onSelect={() => go("/cafe/$slug", { slug: c.slug })}>
                <Building2 className="mr-2 h-4 w-4" />
                <span>{c.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">/{c.slug}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Admin">
          <Item icon={Shield} label="Admin overview" onSelect={() => go("/admin")} />
          <Item icon={BarChart3} label="Network reports" onSelect={() => go("/admin/reports")} />
          <Item icon={TrendingUp} label="Revenue" onSelect={() => go("/admin/revenue")} />
          <Item icon={Activity} label="Health" onSelect={() => go("/admin/health")} />
          <Item icon={Building2} label="Cafés" onSelect={() => go("/admin/cafes")} />
          <Item icon={Users} label="Users & roles" onSelect={() => go("/admin/users")} />
          <Item icon={ScrollText} label="Audit log" onSelect={() => go("/admin/audit")} />
          <Item icon={Megaphone} label="Announcements" onSelect={() => go("/admin/announcements")} />
          <Item icon={FileText} label="Leads" onSelect={() => go("/admin/leads")} />
        </CommandGroup>

        <CommandGroup heading="Quick">
          <Item icon={Home} label="Owner hub" onSelect={() => go("/owner")} />
          <Item icon={Home} label="Customer portal" onSelect={() => go("/portal")} />
          <Item icon={Settings} label="Settings" onSelect={() => go("/admin/settings")} />
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function Item({ icon: Icon, label, onSelect }: { icon: any; label: string; onSelect: () => void }) {
  return (
    <CommandItem onSelect={onSelect} value={label}>
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </CommandItem>
  );
}
