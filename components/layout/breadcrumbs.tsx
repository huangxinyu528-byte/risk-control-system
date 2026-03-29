"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/lib/navigation";

export function Breadcrumbs() {
  const pathname = usePathname();
  const current = navigationItems.find((item) => item.href === pathname);

  return (
    <nav className="breadcrumbs" aria-label="面包屑导航">
      <Link href="/">首页</Link>
      <span className="breadcrumbs-separator">/</span>
      <strong>{current?.label ?? "页面"}</strong>
    </nav>
  );
}
