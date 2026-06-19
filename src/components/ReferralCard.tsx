import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyReferrals } from "@/lib/referrals.functions";
import { Gift, Copy, Check, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function ReferralCard() {
  const fn = useServerFn(getMyReferrals);
  const { data } = useQuery({ queryKey: ["my-referrals"], queryFn: () => fn() });
  const [copied, setCopied] = useState<string | null>(null);

  if (!data?.cafes?.length) return null;
  const primary = data.cafes[0];
  const redeemed = data.referrals.filter((r) => r.status === "redeemed").length;
  const pending = data.referrals.filter((r) => r.status === "pending").length;
  const earned = redeemed * 30;

  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/auth?ref=${primary.referral_code}`
    : `/auth?ref=${primary.referral_code}`;

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 via-violet-500/5 to-cyan-500/10 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-500 shadow-lg shadow-fuchsia-500/30">
            <Gift className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display text-lg font-bold leading-tight">Refer a café, earn 30 days</div>
            <div className="text-xs text-muted-foreground">Both cafés get +30 trial days when they join.</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="border-emerald-400/30 text-emerald-300">+{earned}d earned</Badge>
          <Badge variant="outline" className="border-amber-400/30 text-amber-300">{pending} pending</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Your code</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <code className="font-mono text-xl font-bold text-gradient-hot">{primary.referral_code}</code>
            <Button size="sm" variant="ghost" onClick={() => copy(primary.referral_code ?? "", "code")}>
              {copied === "code" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
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
  );
}
