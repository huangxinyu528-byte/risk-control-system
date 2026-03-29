"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/components/auth/auth-provider";
import { canAccessPath } from "@/lib/auth";
import { navigationItems } from "@/lib/navigation";

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    const currentNav = navigationItems.find((item) => item.href === pathname);
    const hasAccess = canAccessPath(user.role, pathname, currentNav?.roles);

    if (!hasAccess) {
      router.replace("/");
    }
  }, [isReady, pathname, router, user]);

  if (!isReady) {
    return <div className="shell-loading">正在加载系统环境...</div>;
  }

  if (!user) {
    return <div className="shell-loading">正在跳转到登录页...</div>;
  }

  const currentNav = navigationItems.find((item) => item.href === pathname);
  const hasAccess = canAccessPath(user.role, pathname, currentNav?.roles);

  return (
    <div className="app-shell">
      <Sidebar items={navigationItems} />
      <div className="content-shell">
        <Topbar />
        <main className="page-container">
          {!hasAccess ? (
            <section className="empty-card">
              <h2 style={{ marginTop: 0 }}>暂无访问权限</h2>
              <p className="muted">
                当前为开发权限占位逻辑，你的角色暂未开放该页面访问。后续可接真实 RBAC 或组织权限系统。
              </p>
            </section>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
