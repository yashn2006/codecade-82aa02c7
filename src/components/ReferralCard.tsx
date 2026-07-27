import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyReferrals } from "@/lib/referrals.functions";
import { Gift, Copy, Check, Share2, ChevronDown } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function ReferralCard() {
  const fn = useServerFn(getMyReferrals);
  const { data } = useQuery({ queryKey: ["my-referrals"], queryFn: () => fn() });
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!data?.cafes?.length) return null;
  const primary = data.cafes[0];
  const redeemed = data.referrals.filter((r) => r.status === "redeemed").length;
  const pending = data.referrals.filter((r) => r.status === "pending").length;
  const earned = redeemed * 30;
  const code = primary.referral_code ?? "";

  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/auth?ref=${code}`
    : `/auth?ref=${code}`;

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur">
      {/* Collapsed single line */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Gift className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          Refer a café, earn 30 days
        </span>
        <button
          onClick={() => copy(code, "code")}
          className="hidden shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[11px] font-bold text-primary transition hover:bg-primary/20 sm:inline-flex"
        >
          {code}
          {copied === "code" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle referral details"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:text-foreground"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Both cafés get +30 trial days when they join.</p>
                <div className="flex gap-2">
                  <Badge variant="outline" className="border-emerald-400/30 text-emerald-300">+{earned}d earned</Badge>
                  <Badge variant="outline" className="border-amber-400/30 text-amber-300">{pending} pending</Badge>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Your code</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <code className="font-mono text-xl font-bold text-gradient-hot">{code}</code>
                    <Button size="sm" variant="ghost" onClick={() => copy(code, "code2")}>
                      {copied === "code2" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Invite link</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">{inviteUrl}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => copy(inviteUrl, "url")}>
                        {copied === "url" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (navigator.share) navigator.share({ title: "Join CoreCade", url: inviteUrl }).catch(() => {});
                        else copy(inviteUrl, "url");
                      }}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
