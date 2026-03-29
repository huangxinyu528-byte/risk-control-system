import { PageHeader } from "@/components/shared/page-header";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="系统设置"
        description="保留系统参数、接口配置和同步任务开关的统一入口。"
        actionLabel="保存设置"
      />
      <div className="placeholder-grid">
        <section className="form-card">
          <h3 style={{ marginTop: 0 }}>基础配置</h3>
          <div className="form-layout">
            <label className="form-row">
              <span>系统名称</span>
              <input defaultValue="企业风控管理后台" />
            </label>
            <label className="form-row">
              <span>OpenClaw API 访问令牌</span>
              <input defaultValue="dev-openclaw-token" />
            </label>
            <label className="form-row">
              <span>天眼查同步频率</span>
              <input defaultValue="每天 02:00 执行一次" />
            </label>
            <button className="button button-primary" type="button">
              保存开发配置
            </button>
          </div>
        </section>
        <aside className="empty-card">
          <h3 style={{ marginTop: 0 }}>预留说明</h3>
          <p className="muted">
            第一版仅保留配置入口，不接入真实密钥管理。后续建议把第三方接口密钥迁移到环境变量与密钥服务中统一管理。
          </p>
        </aside>
      </div>
    </>
  );
}
