# 众程建材客户风险管理系统

基于 `Next.js + React + TypeScript + Prisma + PostgreSQL` 的企业风控管理后台第一版开发版本。

当前版本重点是：

- 中文后台界面
- 登录页与基础后台体验
- 首页看板、客户管理、合同管理、应收账款、风险记录、信用评分、催收与报告、系统设置
- Next.js API Routes
- Prisma Schema
- 风控规则基础封装
- OpenClaw Agent API 只读接口预留
- 天眼查同步任务接口预留

---

## 1. 交付状态检查

### 导航完整性

- 左侧菜单已覆盖：
  - 首页看板
  - 客户管理
  - 合同管理
  - 应收账款
  - 风险记录
  - 信用评分
  - 催收与报告
  - 系统设置
- 登录页单独存在：`/login`
- 顶部栏与面包屑已接入

### 数据模型与页面一致性

已覆盖页面主要字段：

- `customers`：客户基础资料、信用额度、停供状态、备注
- `contracts`：合同编号、项目名称、金额、账期、业务负责人、项目状态
- `accounts_receivable`：应收、已收、未收、回款率、账期、到期日、逾期天数、账龄阶段、风险状态
- `risk_records`：风险类型、时间、来源、等级、处理状态、备注
- `credit_scores`：信用/经营/财务三维评分、总分、等级、评分说明、重点关注
- `collection_tasks`：催收等级、当前措施、跟进状态、是否移交法务、OpenClaw 摘要预留
- `monthly_reports`、`system_logs`：已预留

### API 与页面一致性

已实现并被页面使用的接口：

- 客户管理：列表、详情、新增、编辑
- 合同管理：列表、详情、新增、编辑
- 应收账款：列表、详情、新增、编辑
- 风险记录：列表、详情、新增、编辑
- 信用评分：列表、详情、新增、编辑
- 催收与报告：列表聚合、催收记录更新
- 首页看板：概览聚合
- Agent API：客户画像、风险摘要、首页摘要、月报基础包

### 字段命名统一情况

前端页面层采用业务友好的 camelCase：

- `customerId`
- `creditLimit`
- `billingPeriodDays`
- `receivedAmount`
- `creditRiskScore`
- `keyAttention`

Prisma 数据库层采用 snake_case 映射：

- `customer_id`
- `credit_limit`
- `billing_period_days`
- `received_amount`
- `credit_risk_score`
- `key_attention`

当前命名策略已统一：

- 前端 / API DTO：camelCase
- 数据库字段：snake_case + Prisma `@map`

### “账期为空”兼容逻辑检查

已实现：

- 应收账款页：
  - `账期` 为空显示 `待补数据`
  - `到期日` 为空显示 `待补数据`
  - `逾期天数` 为空显示 `未计算`
  - `账龄阶段` 为空显示 `未计算`
- 风控规则：
  - 当 `账期`、`到期日` 为空时，不参与自动预警
  - 规则状态显示 `未启用`
  - 不报错
  - 保留人工维护状态
- 合同页：
  - 账期为空显示 `待补数据`

---

## 2. 项目启动说明

### 环境要求

- Node.js 18 或以上
- npm 10 或以上
- PostgreSQL 14 或以上

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
cp .env.example .env
```

默认示例：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/credit_ops_admin?schema=public"
```

### 生成 Prisma Client

```bash
npm run prisma:generate
```

### 推荐本地启动方式

为了避免多个 `Next.js` 进程并存、旧端口缓存漂移、Prisma / PostgreSQL 连接被打满，后续请统一按下面这套方式启动。

本地开发推荐模式：

```bash
npm run local:dev
```

固定入口：

- 登录页：`http://localhost:3006/login`
- 客户管理页：`http://localhost:3006/customers`
- 风控总览页：`http://localhost:3006/risk`

说明：

- 会先自动停止本地旧的 `3000-3007` 端口服务
- 会自动清理本地开发与历史 Next 构建目录，避免旧 chunk 和缓存残留
- 会把开发模式产物单独放到 `.next-dev`
- 用开发模式稳定启动到 `3006`
- 这是当前阶段**唯一推荐**的本地开发入口

本地预览模式（仅在需要验证 production build 时使用）：

```bash
npm run local:preview
```

固定入口：

- 登录页：`http://localhost:3006/login`
- 客户管理页：`http://localhost:3006/customers`

说明：

- 会先自动停止本地旧的 `3000-3007` 端口服务
- 会把 production 产物单独放到 `.next-prod`
- 再执行生产构建并用 `next start` 启动
- 只在需要验证生产构建链路时使用，不作为日常开发入口

如果你只想手动清理旧端口：

```bash
npm run local:stop
```

### 启动开发环境（兼容旧命令）

```bash
npm run dev
```

默认访问地址：

- 登录页：`http://localhost:3000/login`
- 后台首页：`http://localhost:3000`

说明：

- 这个旧命令仍然能用，但以后不建议作为日常入口
- 推荐统一使用 `local:dev`

---

## 3. 数据库初始化说明

### 第一步：创建 PostgreSQL 数据库

示例：

```sql
CREATE DATABASE credit_ops_admin;
```

### 第二步：配置 `.env`

确保 `DATABASE_URL` 指向本地数据库。

### 第三步：执行 Prisma Client 生成

```bash
npm run prisma:generate
```

### 第四步：执行迁移

当前仓库还没有正式 migration 文件，第一版建议直接生成首个迁移：

```bash
npm run prisma:migrate -- --name init
```

说明：

- 当前项目已具备完整 schema
- 但还没有 `seed.ts`
- 如果数据库暂未初始化，系统会优先回退到开发 mock 数据，不会阻塞页面开发

### Excel 导入脚本

当前已提供“众程建材”第一版导入脚本，支持从项目 `data/` 目录读取：

- `众程建材客户风险管理系统模板_最终版(2).xlsx`
- `众程建材应收账款分类表2026.2.28(2)(1).xls`

可用命令：

```bash
npm run import:zhongcheng:dry
```

说明：

- 只做结构化提取和统计，不写入数据库
- 会生成导入 payload、统计 summary、文本日志

正式导入：

```bash
npm run import:zhongcheng
```

导入范围：

- `customers`
- `contracts`
- `accounts_receivable`
- `risk_records`
- `credit_scores`

导入兼容逻辑：

- 缺失字段保留为空
- 账期、到期日为空时不报错
- 风险、评分、合同编号等缺失时会生成稳定占位编号，便于重复导入

日志目录：

```text
logs/imports/
```

---

## 4. 开发环境配置说明

### 推荐本地开发配置

- Node.js: `18+`
- npm: `10+`
- PostgreSQL: `14+`
- 编辑器：VS Code
- Prisma 插件：建议安装
- TypeScript 插件：建议安装

### 当前开发模式

系统支持两种开发方式：

1. 纯前端开发模式
   - 不连接数据库
   - 使用 `mock-data + memoryStore`
   - 适合页面联调和交互开发

2. 本地数据库开发模式
   - 连接 PostgreSQL
   - Prisma 直连数据库
   - 适合接口联调和真实数据验证

### 登录开发账号

当前登录为本地模拟登录，内置账号包括：

- `admin / admin123`
- `finance / finance123`
- `sales / sales123`
- `legal / legal123`
- `management / management123`

---

## A. 项目目录说明

```text
app/
  (dashboard)/                 后台页面路由
  api/                         业务 API 与 Agent API
  login/                       登录页
  layout.tsx                   根布局
  providers.tsx                全局 Provider
  globals.css                  全局样式

components/
  auth/                        登录态与后台壳子
  layout/                      顶部栏、侧栏、面包屑
  dashboard/                   首页看板组件
  customers/                   客户管理页组件
  contracts/                   合同管理页组件
  receivables/                 应收管理页组件
  risks/                       风险管理页组件
  scores/                      信用评分页组件
  collections/                 催收与报告页组件
  shared/                      通用页面头部与表格组件

lib/
  auth.ts                      登录与角色配置
  format.ts                    金额/百分比格式化
  mock-data.ts                 开发数据
  navigation.ts                菜单配置
  prisma.ts                    Prisma Client
  types.ts                     统一类型定义
  integrations/                第三方集成占位
  server/
    data-access.ts             统一数据访问层
    risk-rules.ts              风控规则封装
    agent-api.ts               OpenClaw Agent API 聚合层

prisma/
  schema.prisma                数据库模型定义
```

---

## B. 主要页面说明

### 1. 首页看板

- 展示应收账款总额、已收金额、未收金额、高风险客户数、重点关注客户数
- 展示客户等级分布
- 展示催收重点客户
- 展示规则启用状态
- 展示规则结果总览

### 2. 客户管理

- 支持列表、搜索、新增、编辑、详情查看
- 展示信用额度使用率、额度状态、规则标识

### 3. 合同管理

- 支持列表、搜索、新增、编辑、详情查看
- 支持按客户筛选、按项目状态筛选

### 4. 应收账款管理

- 支持列表、搜索、新增、编辑
- 支持按客户、业务员、风险状态筛选
- 自动计算未收金额和回款率
- 账期为空时兼容展示

### 5. 风险记录管理

- 支持列表、搜索、新增、编辑、详情查看
- 支持按客户、风险类型、风险等级筛选

### 6. 信用评分

- 支持评分列表
- 支持按月份筛选
- 支持按信用等级筛选
- 支持查看单客户评分详情

### 7. 催收与报告

- 催收清单：支持人工维护措施、跟进状态、法务移交
- 报告中心：提供月报、风险清单、领导摘要、AI分析入口预留

### 8. 系统设置

- 预留第三方配置入口
- 预留 OpenClaw Token 和天眼查同步频率配置位

---

## C. 主要接口说明

### 页面业务接口

- `GET /api/dashboard/overview`
- `GET /api/customers`
- `POST /api/customers`
- `GET /api/customers/:id`
- `PUT /api/customers/:id`
- `GET /api/contracts`
- `POST /api/contracts`
- `GET /api/contracts/:id`
- `PUT /api/contracts/:id`
- `GET /api/receivables`
- `POST /api/receivables`
- `GET /api/receivables/:id`
- `PUT /api/receivables/:id`
- `GET /api/risks`
- `POST /api/risks`
- `GET /api/risks/:id`
- `PUT /api/risks/:id`
- `GET /api/scores`
- `POST /api/scores`
- `GET /api/scores/:id`
- `PUT /api/scores/:id`
- `GET /api/collections`
- `GET /api/collections/:id`
- `PUT /api/collections/:id`

### Agent API

- `GET /api/agent/customers/:customerId`
  - 用于 OpenClaw 获取客户基础画像
- `GET /api/agent/customers/:customerId/risk-summary`
  - 用于 OpenClaw 获取客户风险摘要
- `GET /api/agent/reports/dashboard-summary`
  - 用于 OpenClaw 获取首页摘要
- `GET /api/agent/reports/monthly?month=YYYY-MM`
  - 用于 OpenClaw 获取月报基础数据包

### 预留接口

- `POST /api/tasks/tianyancha-sync`
- `GET /api/openclaw/export`
- 系统设置页中的 OpenClaw、天眼查配置位

---

## 5. 后续可扩展模块清单

- 用户与真实权限系统
- 审批流与授信审批
- 客户回访记录
- 风险自动预警中心
- 合同附件管理
- 发票与对账管理
- 催收过程记录时间线
- 月报/周报导出
- AI 风险解释与催款建议
- 系统日志与审计查询

---

## 6. 第一版未完成但已预留的能力

### 已预留但未完成

- 天眼查同步任务
- OpenClaw Agent API 深度集成
- 飞书通知 / 飞书机器人 / 飞书审批
- 自动预警任务调度
- 真实登录与 RBAC 权限系统
- Prisma migration 文件
- Prisma seed 初始化数据
- 报告导出与文件下载
- AI 自动分析入口

### 当前预留位置

- 天眼查：`/api/tasks/tianyancha-sync`、`lib/integrations/tianyancha.ts`
- OpenClaw：`/api/agent/...`、`/api/openclaw/export`
- 权限系统：`components/auth/auth-provider.tsx`、`lib/auth.ts`
- 风控规则：`lib/server/risk-rules.ts`
- 第三方配置：系统设置页

---

## D. 后续开发建议

### 建议优先顺序

1. 补 Prisma migration
2. 补 seed 数据
3. 完成真实数据库联调
4. 完成真实登录与用户表接入
5. 接入定时任务与风险自动预警
6. 接入 OpenClaw 分析能力

### 建议先补的工程项

- `prisma/seed.ts`
- 接口响应统一 `schema_version`
- 统一错误处理
- 表单提交成功/失败提示
- API 鉴权中间层
- 数据校验层

---

## E. 下一阶段最推荐做什么

最推荐下一阶段直接做这 4 件事：

1. 生成 Prisma migration 并初始化数据库
2. 补 seed 数据，让页面全部跑真实 PostgreSQL
3. 接入真实用户登录与角色权限
4. 把首页看板、风控规则、月报接口全部改成数据库聚合查询

如果只选一个最重要的动作：

**最推荐先做 Prisma migration + seed 数据。**

因为这一步做完后，整个“众程建材客户风险管理系统”就会从“结构完整的开发版本”进入“可持续联调的正式开发阶段”。
