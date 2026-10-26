// Giống meu: types CASL dùng chung cho toàn bộ phân quyền FE.
// Vista dùng module chữ thường ('customer', 'appointment'...) — trùng với
// permission key của BE ('customer.read' → { module: 'customer', action: 'read' }).
import type { MongoAbility } from "@casl/ability";

export type Actions =
  | "CREATE"
  | "VIEW"
  | "READ"
  | "READ_OWN"
  | "READ_ALL"
  | "UPDATE"
  | "UPDATE_OWN"
  | "UPDATE_ALL"
  | "DELETE"
  | "DELETE_OWN"
  | "DELETE_ALL"
  | "EXPORT"
  | "ASSIGN"
  | "APPROVE"
  | "APPROVE_VIEW"
  // Action riêng của vista (đa đoạn, vd 'report.revenue.read' → action 'REVENUE.READ')
  | "MANAGE"
  | "ALL"
  | "START"
  | "RECALCULATE"
  | "RANK_OVERRIDE"
  | "POINTS_ADJUST"
  | "REDEEM_ADMIN"
  | "SPIN_ADMIN"
  | `${string}`;

export type Subjects = string;

export type AppAbility = MongoAbility<[Actions, Subjects]>;

export interface PermissionCheck {
  action: string;
  subject: string;
}

export interface Permission {
  module: string;
  action: string;
}

export type PermissionKey = string;
