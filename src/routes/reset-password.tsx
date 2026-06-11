import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Giganexa" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/portal" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md glass rounded-2xl p-8 space-y-4">
        <h1 className="font-display text-3xl font-bold">Set new password</h1>
        <p className="text-sm text-muted-foreground">Pick something strong. Minimum 8 characters.</p>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" minLength={8} required className="h-12" />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-to-r from-cyan to-magenta text-primary-foreground glow-cyan font-semibold">
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
