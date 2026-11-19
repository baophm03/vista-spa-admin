// Giống meu: helper phân quyền — BE vista trả permissions dạng [{module, action}]
// (giống /auth/me của meu), được normalize rồi map thành CASL rules.
import type { RawRuleOf } from "@casl/ability";
import { ability } from "@/configs/casl/ability";
import type {
  Actions,
  AppAbility,
  Permission,
  PermissionKey,
} from "@/lib/types/permissions";

export type {
  Permission,
  PermissionCheck,
  PermissionKey,
} from "@/lib/types/permissions";

// Key nội bộ để so sánh trong Set — không phải format trao đổi với BE
export const permKey = (module: string, action: string): PermissionKey =>
  `${module}:${action}`;

export function buildPermissionSet(
  permissions: Array<{ module?: string; action?: string }> | undefined,
): Set<PermissionKey> {
  return new Set(
    (permissions ?? [])
      .filter((p) => p.module && p.action)
      .map((p) => permKey(p.module!, p.action!)),
  );
}

export function hasPermissionInSet(
  set: Set<PermissionKey>,
  module: string,
  action: string,
): boolean {
  return set.has(permKey(module, action));
}

export function togglePermissionInSet(
  set: Set<PermissionKey>,
  module: string,
  action: string,
): Set<PermissionKey> {
  const next = new Set(set);
  const key = permKey(module, action);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

// Convert Set -> [{module, action}] để submit lên BE
export function permissionSetToArray(set: Set<PermissionKey>): Permission[] {
  return [...set].map((key) => {
    const [module, action] = key.split(":");
    return { module: module!, action: action! };
  });
}

// Helper: check if a permission exists in the list
export function hasPermission(
  permissions: Permission[] | undefined,
  module: string,
  action: string,
): boolean {
  return !!permissions?.some((p) => p.module === module && p.action === action);
}

// Helper: toggle a permission in the list (returns a new array)
export function togglePermission(
  permissions: Permission[],
  module: string,
  action: string,
): Permission[] {
  return hasPermission(permissions, module, action)
    ? permissions.filter((p) => !(p.module === module && p.action === action))
    : [...permissions, { module, action }];
}

export function normalizePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [];

  const result: Permission[] = [];

  for (const item of input) {
    // BE mới có thể trả key dạng string 'MODULE:ACTION' (realhub style) hoặc
    // legacy 'module.action' — hoặc object {module, action}. Chấp nhận cả 3.
    if (typeof item === "string") {
      const key = item.trim();
      if (!key) continue;
      const sepIdx = key.includes(":") ? key.indexOf(":") : key.indexOf(".");
      if (sepIdx === -1) {
        result.push({ module: key.toUpperCase(), action: "ALL" });
      } else {
        result.push({
          module: key.slice(0, sepIdx).trim().toUpperCase(),
          action: key.slice(sepIdx + 1).trim().toUpperCase(),
        });
      }
      continue;
    }
    if (!item || typeof item !== "object") continue;

    const { module, action } = item as { module?: unknown; action?: unknown };
    if (
      typeof module === "string" &&
      module.trim() &&
      typeof action === "string" &&
      action.trim()
    ) {
      result.push({
        module: module.trim().toUpperCase(),
        action: action.trim().toUpperCase(),
      });
    }
  }

  return result;
}

// Convert permission key BE ('customer.read', 'report.revenue.read')
// thành cặp {module, action} — module là đoạn đầu, action là phần còn lại.
export function parsePermissionKey(key: string): Permission {
  const idx = key.indexOf(".");
  if (idx === -1) return { module: key, action: "all" };
  return { module: key.slice(0, idx), action: key.slice(idx + 1) };
}

// Alias subject: key mới của BE (realhub) đôi khi khác tên module mà FE pages
// đang check (legacy). Emit thêm rule với alias để cả 2 phía đều pass.
const SUBJECT_ALIASES: Record<string, string[]> = {
  CUSTOMER_PROFILE: ["CUSTOMER"],
  ACADEMY_COURSE: ["ACADEMY"],
  ACADEMY_REGISTRATION: ["ACADEMY"],
  TREATMENT_SESSION: ["SESSION"],
  NOTIFICATION_TEMPLATE: ["NOTIFICATION"],
};

export const updateCaslAbility = (user: {
  permissions?: Permission[]
  is_admin?: boolean
  is_super_admin?: boolean
} | null) => {
  const isGlobalAdmin = Boolean(user?.is_admin || user?.is_super_admin)
  const rules: RawRuleOf<AppAbility>[] = []

  if (isGlobalAdmin) {
    rules.push({ action: "manage", subject: "all" })
  } else {
    for (const p of normalizePermissions(user?.permissions)) {
      // Wildcard realhub: '*:*' → toàn quyền; 'MODULE:*' → mọi action của module.
      const subject = p.module === "*" ? "all" : p.module
      const action = p.action === "*" ? "manage" : p.action
      rules.push({ action: action as Actions, subject })

      // Realhub scopes map to the base actions that existing pages check.
      if (action.endsWith("_ALL") || action.endsWith("_OWN")) {
        const base = action.replace(/_(ALL|OWN)$/, "")
        rules.push({ action: base as Actions, subject })
        for (const alias of SUBJECT_ALIASES[subject] ?? []) {
          rules.push({ action: base as Actions, subject: alias })
        }
      }

      for (const alias of SUBJECT_ALIASES[subject] ?? []) {
        rules.push({ action: action as Actions, subject: alias })
      }
    }
  }

  ability.update(rules);
};
