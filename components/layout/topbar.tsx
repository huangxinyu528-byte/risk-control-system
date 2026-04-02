"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { FontSizeSwitcher } from "@/components/layout/font-size-switcher";
import { roleLabels } from "@/lib/auth";

export function Topbar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-start">
        <div>
          <h1>众程建材客户风险管理系统</h1>
          <Breadcrumbs />
        </div>
      </div>

      <div className="topbar-end">
        <div className="topbar-utility-bar">
          <FontSizeSwitcher />
        </div>

        <div className="topbar-meta">
          <span>内部测试</span>
          <span className="topbar-badge">统一密码访问</span>
          <span className="topbar-user">
            {user?.fullName ?? "未登录"} · {user ? roleLabels[user.role] : "访客"}
          </span>
          <button
            className="button button-ghost"
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            退出登录
          </button>
        </div>
      </div>
    </header>
  );
}
