import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { getMyCafeAccess, type StaffPerm } from "@/lib/staff.functions";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/ui/button";

export function useCafeAccess(cafeId?: string) {
  const fn = useServerFn(getMyCafeAccess);
  const query = useQuery({
    queryKey: ["cafe-access", cafeId],
    queryFn: () => fn({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
    staleTime: 60_000,
  });

  const data = query.data;
  const isOwnerOrAdmin = Boolean(data?.isOwnerOrAdmin);
  const isStaff = data?.role === "staff";
  const isMember = Boolean(data?.isMember);
  const isActive = Boolean(data?.isActive);
  const permissions = data?.permissions ?? [];

  const can = (perm: StaffPerm) => {
    if (!isMember || !isActive) return false;
    if (isOwnerOrAdmin) return true;
    return permissions.includes(perm);
  };

  const canAny = (...perms: StaffPerm[]) => perms.some((p) => can(p));

  return {
    access: data,
    isLoading: Boolean(cafeId) && (query.isPending || query.isLoading),
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    role: data?.role ?? null,
    isOwnerOrAdmin,
    isStaff,
    isMember,
    isActive,
    mustChangePin: Boolean(data?.mustChangePin),
    displayName: data?.displayName ?? null,
    username: data?.username ?? null,
    isPinStaff: Boolean(data?.isPinStaff),
    permissions,
    can,
    canAny,
  };
}

export function CafeAccessGuard({
  cafeId,
  slug,
  requireOwner = false,
  requirePerm,
  children,
}: {
  cafeId?: string;
  slug: string;
  requireOwner?: boolean;
  requirePerm?: StaffPerm;
  children: ReactNode;
}) {
  const { isLoading, isError, refetch, isMember, isActive, isOwnerOrAdmin, can } = useCafeAccess(cafeId);

  if (!cafeId || isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-2xl border border-border/40 bg-card/30" />
        <div className="h-64 animate-pulse rounded-2xl border border-border/40 bg-card/20" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't verify permissions"
        description="Please retry to check your access for this section."
        onRetry={() => void refetch()}
      />
    );
  }

  const allowed =
    isMember &&
    isActive &&
    (!requireOwner || isOwnerOrAdmin) &&
    (!requirePerm || can(requirePerm));

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <div className="rounded-3xl border border-destructive/30 bg-card/60 p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-destructive/15 text-destructive">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Access restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You don't have permission to open this page. Ask your café owner if you need access.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/cafe/$slug" params={{ slug }}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Live Floor
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
