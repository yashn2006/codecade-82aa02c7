import { supabaseAdmin } from "@/lib/supabase/client.server";
import { STAFF_PERMS, type StaffPerm } from "@/lib/staff.functions";

export type CafeAccessResult = {
  role: "super_admin" | "owner" | "staff";
  isOwnerOrAdmin: boolean;
  permissions: StaffPerm[];
  mustChangePin: boolean;
  isActive: boolean;
  displayName: string | null;
  username: string | null;
  staffId: string | null;
  isPinStaff: boolean;
};

const VALID_PERMS = new Set<string>(STAFF_PERMS);

export async function resolveCafeAccess(userId: string, cafeId: string): Promise<CafeAccessResult | null> {
  const [
    { data: adminRole, error: adminErr },
    { data: cafe, error: cafeErr },
    { data: staffRow, error: staffErr },
  ] = await Promise.all([
    supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("cafes")
      .select("owner_id")
      .eq("id", cafeId)
      .maybeSingle(),
    supabaseAdmin
      .from("staff_permissions")
      .select("id, permissions, must_change_pin, is_active, display_name, username, login_email")
      .eq("cafe_id", cafeId)
      .eq("staff_user_id", userId)
      .maybeSingle(),
  ]);
  if (adminErr) throw new Error(adminErr.message);
  if (cafeErr) throw new Error(cafeErr.message);
  if (staffErr) throw new Error(staffErr.message);

  if (adminRole) {
    return {
      role: "super_admin",
      isOwnerOrAdmin: true,
      permissions: [...STAFF_PERMS],
      mustChangePin: false,
      isActive: true,
      displayName: null,
      username: null,
      staffId: null,
      isPinStaff: false,
    };
  }

  if (cafe && cafe.owner_id === userId) {
    return {
      role: "owner",
      isOwnerOrAdmin: true,
      permissions: [...STAFF_PERMS],
      mustChangePin: false,
      isActive: true,
      displayName: null,
      username: null,
      staffId: null,
      isPinStaff: false,
    };
  }

  if (staffRow) {
    const rawPerms = Array.isArray(staffRow.permissions) ? staffRow.permissions : [];
    const permissions = rawPerms.filter((p): p is StaffPerm => typeof p === "string" && VALID_PERMS.has(p));
    return {
      role: "staff",
      isOwnerOrAdmin: false,
      permissions,
      mustChangePin: Boolean(staffRow.must_change_pin),
      isActive: staffRow.is_active !== false,
      displayName: (staffRow.display_name as string | null) ?? null,
      username: (staffRow.username as string | null) ?? null,
      staffId: (staffRow.id as string | null) ?? null,
      isPinStaff: Boolean(staffRow.login_email),
    };
  }

  return null;
}

export async function assertCafeAccess(
  userId: string,
  cafeId: string,
  requiredPerm?: StaffPerm | StaffPerm[],
): Promise<CafeAccessResult> {
  const access = await resolveCafeAccess(userId, cafeId);
  if (!access) {
    throw new Error("You don't have permission");
  }
  if (!access.isOwnerOrAdmin) {
    if (!access.isActive) {
      throw new Error("Your staff account has been deactivated.");
    }
    if (requiredPerm) {
      const allowed = Array.isArray(requiredPerm)
        ? requiredPerm.some((p) => access.permissions.includes(p))
        : access.permissions.includes(requiredPerm);
      if (!allowed) {
        throw new Error("You don't have permission");
      }
    }
  }
  return access;
}

export async function assertCafeOwnerOrAdmin(userId: string, cafeId: string): Promise<CafeAccessResult> {
  const access = await resolveCafeAccess(userId, cafeId);
  if (!access || !access.isOwnerOrAdmin) {
    throw new Error("You don't have permission");
  }
  return access;
}

export async function lookupCafeId(
  table: string,
  id: string,
  col = "cafe_id",
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin.from(table as any) as any)
    .select(col)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const cafeId = data?.[col];
  if (typeof cafeId !== "string" || !cafeId) {
    throw new Error("Record not found");
  }
  return cafeId;
}
