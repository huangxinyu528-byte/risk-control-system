import type { AuthUser, UserRole } from "@/lib/types";

export const AUTH_STORAGE_KEY = "zc-building-risk-auth";
export const DEFAULT_SITE_ACCESS_PASSWORD = "zc-test-2026";

export const roleLabels: Record<UserRole, string> = {
  admin: "系统管理员",
  finance: "财务",
  sales: "销售",
  legal: "法务",
  management: "管理层",
};

export function getSiteAccessPassword() {
  return process.env.SITE_ACCESS_PASSWORD || DEFAULT_SITE_ACCESS_PASSWORD;
}

export function buildSiteAccessUser(): AuthUser {
  return {
    id: "site-access-user",
    username: "site-access",
    fullName: "内部测试访问",
    role: "admin",
  };
}

export function canAccessPath(
  role: UserRole,
  pathname: string,
  allowedRoles?: UserRole[],
) {
  if (pathname === "/") {
    return true;
  }

  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  return allowedRoles.includes(role);
}
