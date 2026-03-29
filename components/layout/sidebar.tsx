"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { canAccessPath, roleLabels } from "@/lib/auth";
import type { NavigationItem } from "@/lib/types";

type SidebarProps = {
  items: NavigationItem[];
};

export function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleItems = user
    ? items.filter((item) => canAccessPath(user.role, item.href, item.roles))
    : [];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <strong>众程建材客户风险管理系统</strong>
        <span>客户 / 合同 / 应收 / 风险 / 催收</span>
      </div>

      <section className="sidebar-user-card">
        <div className="sidebar-user-avatar">
          {user?.fullName.slice(0, 1) ?? "访"}
        </div>
        <div>
          <strong className="sidebar-user-name">{user?.fullName ?? "未登录用户"}</strong>
          <div className="sidebar-user-role">
            {user ? roleLabels[user.role] : "开发访客"}
          </div>
        </div>
      </section>

      <div>
        <div className="sidebar-section-label">功能菜单</div>
        <nav className="sidebar-nav" aria-label="侧边菜单">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link${isActive ? " active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
