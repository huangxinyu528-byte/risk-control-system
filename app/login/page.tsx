"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { user, login, isReady } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isReady && user) {
      router.replace("/");
    }
  }, [isReady, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await login(password);

    if (!result.success) {
      setError(result.message ?? "登录失败");
      return;
    }

    setError("");
    router.replace("/");
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-intro">
          <p className="login-kicker">内部测试访问</p>
          <h1>众程建材客户风险管理系统</h1>
          <p className="muted">
            当前为内部测试访问模式，输入统一访问密码即可进入系统。后续可切换为正式账号体系和权限系统。
          </p>
        </div>

        <form className="form-layout" onSubmit={handleSubmit}>
          <label className="form-row">
            <span>密码</span>
            <input
              type="password"
              placeholder="请输入内部测试访问密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <div className="form-error">{error}</div> : null}

          <button className="button button-primary" type="submit" disabled={!isReady}>
            进入系统
          </button>
        </form>

        <section className="login-helper">
          <strong>测试说明</strong>
          <p className="muted">
            登录密码优先读取环境变量 <code>SITE_ACCESS_PASSWORD</code>。如果未配置，将使用开发默认值，仅用于内部测试。
          </p>
        </section>
      </section>

      <aside className="login-side-card">
        <h2>当前访问方式</h2>
        <div className="info-list">
          <article>
            <strong>统一密码登录</strong>
            <div className="muted">不再区分账号角色，适合内部测试和快速试用。</div>
          </article>
          <article>
            <strong>本地保持登录状态</strong>
            <div className="muted">登录成功后会保存本地状态，刷新页面后仍可继续访问。</div>
          </article>
          <article>
            <strong>后续可切正式权限</strong>
            <div className="muted">当前仅用于测试访问，后续可再切换为正式账号和权限体系。</div>
          </article>
        </div>
      </aside>
    </main>
  );
}
