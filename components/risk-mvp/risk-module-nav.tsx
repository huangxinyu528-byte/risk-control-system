"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const RISK_NAV_ITEMS = [
  { label: "总览", href: "/risk" },
  { label: "客户", href: "/risk/customers" },
  { label: "项目", href: "/risk/projects" },
];

export function RiskModuleNav() {
  const pathname = usePathname();

  return (
    <section className="card risk-module-nav">
      <div className="risk-module-nav-list">
        {RISK_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              className={isActive ? "risk-module-nav-link risk-module-nav-link-active" : "risk-module-nav-link"}
              href={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
