import type { NavigationItem } from "@/lib/types";

export const navigationItems: NavigationItem[] = [
  { label: "首页看板", href: "/" },
  { label: "风控总览", href: "/risk", roles: ["admin", "sales", "finance", "legal", "management"] },
  { label: "风险客户", href: "/risk/customers", roles: ["admin", "sales", "finance", "legal", "management"] },
  { label: "风险项目", href: "/risk/projects", roles: ["admin", "sales", "finance", "legal", "management"] },
  { label: "客户管理", href: "/customers", roles: ["admin", "sales", "finance", "legal", "management"] },
  { label: "合同管理", href: "/contracts", roles: ["admin", "sales", "legal", "management"] },
  { label: "应收账款", href: "/receivables", roles: ["admin", "finance", "management"] },
  { label: "风险记录", href: "/risks", roles: ["admin", "legal", "management", "finance"] },
  { label: "信用评分", href: "/scores", roles: ["admin", "finance", "management"] },
  { label: "催收与报告", href: "/collections", roles: ["admin", "finance", "legal", "management"] },
  { label: "系统设置", href: "/settings", roles: ["admin"] },
];
