import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Activity,
  Building2,
  Users,
  ScrollText,
  Settings,
  TrendingUp,
  Shield,
  BarChart3,
  Megaphone,
  FileText,
  Home,
  Compass,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { getCachedRoles, getCachedUser, getSupabaseUserReady, getUserRoles } from "@/lib/auth-routing";

type Cafe = { id: string; name: string; slug: string };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [roles, setRoles] = useState<Set<string>>(() => {
    const u = getCachedUser();
    return (u ? getCachedRoles(u.id) : null) ?? new Set<string>();
  });
  const [loaded, setLoaded] = useState(false);
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
    if (!open || loaded) return;
    let active = true;
    void (async () => {
      const user = await getSupabaseUserReady(1200);
      if (!user || !active) return;
      const r = await getUserRoles(user.id);
      if (!active) return;
      setRoles(r);

      if (r.has("super_admin")) {
        const { data } = await supabase.from("cafes").select("id, name, slug").limit(50);
        if (active && data) setCafes(data as Cafe[]);
      } else if (r.has("cafe_owner")) {
        const { data } = await supabase
          .from("cafes")
          .select("id, name, slug")
          .eq("owner_id", user.id)
          .limit(50);
        if (active && data) setCafes(data as Cafe[]);
      } else if (r.has("cafe_staff")) {
        const { data } = await supabase
          .from("staff_permissions")
          .select("cafes!inner(id, name, slug)")
          .eq("staff_user_id", user.id)
          .eq("is_active", true)
          .limit(20);
        if (active && data) {
          const list = data
            .flatMap((row) => {
              const joined = (row as unknown as { cafes?: Cafe | Cafe[] | null }).cafes;
              return Array.isArray(joined) ? joined : joined ? [joined] : [];
            })
            .filter((c): c is Cafe => Boolean(c?.id && c?.slug));
          setCafes(list);
        }
      }
      if (active) setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [open, loaded]);

  const isSuperAdmin = roles.has("super_admin");
  const isOwner = roles.has("cafe_owner");
  const isStaffOnly = roles.has("cafe_staff") && !isOwner && !isSuperAdmin;

  const go = (to: string, params?: Record<string, string>) => {
    setOpen(false);
    (navigate as unknown as (o: { to: string; params?: Record<string, string> }) => void)({
      to,
      params,
    });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search cafés, pages, actions… (⌘K)" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {cafes.length > 0 && (
          <CommandGroup heading="Cafés">
            {cafes.map((c) => (
              <CommandItem
                key={c.id}
                value={`cafe ${c.name} ${c.slug}`}
                onSelect={() => go("/cafe/$slug", { slug: c.slug })}
              >
                <Building2 className="mr-2 h-4 w-4" />
                <span>{c.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">/{c.slug}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {isSuperAdmin && (
          <CommandGroup heading="Admin">
            <Item icon={Shield} label="Admin overview" onSelect={() => go("/admin")} />
            <Item icon={BarChart3} label="Network reports" onSelect={() => go("/admin/reports")} />
            <Item icon={TrendingUp} label="Revenue" onSelect={() => go("/admin/revenue")} />
            <Item icon={Activity} label="Health" onSelect={() => go("/admin/health")} />
            <Item icon={Building2} label="Cafés" onSelect={() => go("/admin/cafes")} />
            <Item icon={Users} label="Users & roles" onSelect={() => go("/admin/users")} />
            <Item icon={ScrollText} label="Audit log" onSelect={() => go("/admin/audit")} />
            <Item
              icon={Megaphone}
              label="Announcements"
              onSelect={() => go("/admin/announcements")}
            />
            <Item icon={FileText} label="Leads" onSelect={() => go("/admin/leads")} />
            <Item icon={Settings} label="Settings" onSelect={() => go("/admin/settings")} />
          </CommandGroup>
        )}

        <CommandGroup heading="Quick">
          {(isOwner || isSuperAdmin) && (
            <Item icon={Home} label="Owner hub" onSelect={() => go("/owner")} />
          )}
          {!isStaffOnly && (
            <Item icon={Home} label="Customer portal" onSelect={() => go("/portal")} />
          )}
          <Item icon={Compass} label="Discover arenas" onSelect={() => go("/discover")} />
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function Item({ icon: Icon, label, onSelect }: { icon: typeof Home; label: string; onSelect: () => void }) {
  return (
    <CommandItem onSelect={onSelect} value={label}>
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </CommandItem>
  );
}
