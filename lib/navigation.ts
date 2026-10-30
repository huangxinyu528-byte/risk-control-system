import type { NavigationItem } from "@/lib/types";

export const navigationItems: NavigationItem[] = [
  { label: "风控总览", href: "/risk", roles: ["admin", "sales", "finance", "legal", "management"] },
  { label: "风险客户", href: "/risk/customers", roles: ["admin", "sales", "finance", "legal", "management"] },
  { label: "风险项目", href: "/risk/projects", roles: ["admin", "sales", "finance", "legal", "management"] },
  { label: "应收风险", href: "/receivables", roles: ["admin", "finance", "management"] },
  { label: "处置跟进", href: "/collections", roles: ["admin", "sales", "finance", "legal", "management"] },
];
