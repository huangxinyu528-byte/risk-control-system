# 众程建材客户风险管理系统：AI 接手交接文档

更新日期：2026-10-30（Asia/Shanghai）

## 1. 项目是什么、要解决什么问题

这是服务建材企业的中文客户与项目风控管理后台。核心问题是客户主体、合同、项目、应收账款、回款和催收资料分散，管理者难以迅速判断“谁风险最高、欠款多少、为什么有风险、依据是什么、下一步谁处理”。

目标是形成可追溯闭环：原始业务资料导入 → 客户/项目档案 → 风险识别与评分解释 → 证据链问答 → 人工确认处置 → 催收跟进与管理报告。AI 是辅助分析工具，不能无确认地修改金额、风险结论或自动执行停供等动作。

这是已有业务数据和代码的项目，不是从零创建的演示。不要把仓库里的真实账款数据描述成虚构样例。

## 2. 仓库与边界

- GitHub：https://github.com/huangxinyu528-byte/risk-control-system
- 默认分支：main；仓库公开，用户已明确允许公开客户名称、应收金额、业务表格和报表。
- 本机目录：`/Users/jamiekeke/Documents/New project/zhongcheng-risk-admin`。
- 相邻 `solution-factory-studio` 是独立原型，不属于本系统；父目录的方案工厂文档不能当成本系统需求。
- 用户要求补传除 API 密钥以外的项目资料，包括环境配置、数据库备份和导入日志；不提交依赖目录、构建缓存等可再生文件。
- API 密钥应通过本机或部署平台环境变量配置。不得把真实 API 密钥写入代码、文档或提交记录。

## 3. 先读哪些文件

1. 本文：当前全貌、已知缺口和接手顺序。
2. `PRD.md`：本次风控垂直化改造目标和验收标准。
3. `PLAN.md`：分阶段实施顺序。
4. `TASKS.md`：历史执行记录；勾选不代表当前环境已重新验收。
5. `RULES.md`：数据安全、人工确认、最小改动要求；其中任务级文件白名单属于历史任务，开展新任务前明确新边界。
6. `README.md`：启动、接口和早期模块说明；其旧菜单描述以 `lib/navigation.ts` 当前实现为准。
7. `reports/`：业务规则、数据核对、交付说明、部署记录与截图。

## 4. 系统有哪些功能

当前主导航见 `lib/navigation.ts`：风控总览 `/risk`、风险客户 `/risk/customers`、风险项目 `/risk/projects`、应收风险 `/receivables`、处置跟进 `/collections`。首页归并到风控总览。

| 模块 | 已有实现与入口 | 接手时注意 |
| --- | --- | --- |
| 登录与身份 | `/login`、`app/api/auth/login/route.ts`、`lib/auth.ts` | 共享访问密码和基础角色模型，不等于完善的生产级鉴权系统 |
| 风控总览 | 客户/项目风险聚合、评分解释、高风险展示；`app/api/risk/overview/route.ts` | 必须核对实际数据来源、规则和缺失值处理 |
| 客户档案 | 客户列表、详情、主体归并、档案表格、指标和关联项目；`components/customers/` | 客户主体与项目主体不可混淆；金额必须可追溯 |
| 风险项目 | 项目、欠款、风险标签及筛选；`components/risk-mvp/` | 数据补录缺失项要明确标注，不能推断为零 |
| 基础业务管理 | 客户、合同、应收、风险记录、信用评分、催收等页面/API 仍保留 | 部分旧页面已隐藏菜单，不能因此删除数据库表或历史数据 |
| Excel 导入 | `/api/import/excel`、`/api/import/customers`、Python 解析、导入日志 | 支持 xls/xlsx；解析依赖 Python，部署环境需另验 |
| 档案检索与证据问答 | `lib/server/document-search.ts`、`/api/agent/documents/*`、客户 document-answer API | 有文档来源与分块模型；检索质量、索引完整性需实测 |
| AI 风控助理 | 右侧面板、客户问答、风险分析、催收建议、证据与动作建议；`lib/server/ai/` | OpenAI Responses 和兼容 Chat Completions 适配；无 key 时仅基础分析，不能声称真实模型已接通 |
| 报告 | 催收与报告组件、Agent monthly/dashboard-summary API | 核对结构化数据和老板/财务/业务版本，不可虚构金额或结论 |
| 外部接口 | OpenClaw/Agent 只读输出、天眼查同步入口 | 天眼查 `lib/integrations/tianyancha.ts` 明确为 mock，占位不等于真实同步 |

## 5. 已发现的目标与代码差距（优先处理）

以下来自本次代码静态核对，比历史任务勾选更可靠：

- **Word 导入未真正接通**：`components/ai/risk-assistant-panel.tsx` 对 doc/docx 只提示尚未接入解析入库；Excel API 只接受 xls/xlsx。不能宣称 Word/PDF 全流程已完成。
- **Excel 更新预览/确认需补齐验收**：当前 AI 面板选文件后直接调用导入 API 并提示已更新，没有在该入口看到写入前的差异预览与确认。按 PRD 要求补上对关键金额、主体和风险结论的保护。
- **处置闭环未证实**：AI 输出包含 `requiresHumanConfirmation`，面板显示人工确认提示，但这不等于已完成确认/驳回、落库、责任人和审计记录的完整链路。需要沿页面到 API 到数据库验收。
- **权限需专项检查**：登录返回用户对象，前端存在本地身份存储约定；是否所有写接口都具备服务端鉴权，本次未验证。不要把角色菜单等同于接口权限。
- **数据降级可能掩盖问题**：`lib/server/data-access.ts` 有数据库、development dataset、mock/fallback 多种路径。页面有数据不代表数据库正常；诊断时先调用对应 API，确认来源。
- **线上与本机能力未重验**：没有在本次执行数据库恢复、生产构建、真实模型请求、线上功能回归；历史 TASKS 的通过记录仅作线索。

## 6. 目录与技术地图

- `app/`：Next.js App Router 页面及 API；`app/(dashboard)/` 为后台页面。
- `components/`：客户档案、账款表格、风控看板、AI 面板、催收报告等 UI。
- `lib/server/data-access.ts`：主要业务读写和聚合；`risk-rules.ts` 为风险规则。
- `lib/server/document-search.ts`：档案检索、索引和问答；`lib/server/ai/` 为供应商调用及结构化输出。
- `prisma/schema.prisma`、`prisma/migrations/`：PostgreSQL 模型与迁移。
- `data/`：原始 Word/Excel、导出的 development dataset。
- `backups/`：数据库 dump。备份文件日期不等于当前数据库状态，恢复前检查版本、目标库和备份内容，禁止覆盖生产库。
- `logs/imports/`：历史导入载荷、摘要和日志，用于对账溯源。
- `reports/`：核对报表、规则、验收记录、图文手册和截图。
- `scripts/`：Excel 解析、导入、客户归并、回填、索引重建、本地启动和数据库检查。
- `netlify.toml`：部署构建配置；`.netlify/state.json`、`.vercel/project.json` 为原项目关联信息，不要未经判断部署到原生产项目。

技术栈：Next.js 14、React 18、TypeScript、Prisma 5、PostgreSQL、Zod、OpenAI SDK、x-data-spreadsheet；Excel 解析使用 Python（openpyxl、xlrd）。精确版本和命令以 `package.json`/锁文件为准。

主要数据实体：User、Customer、Project、Contract、AccountReceivable、CustomerLedgerProfile/Row、DocumentSource/Chunk、RiskRecord、ImportLog/Error、CustomerMergeMapping、CreditScore、CollectionTask、MonthlyReport、SystemLog。前端/API 使用 camelCase，数据库通过 Prisma 映射 snake_case。

## 7. 启动与配置

```bash
npm ci
npm run prisma:generate
npm run local:dev
```

默认本机入口 `http://localhost:3006`。`local:dev` 会停止 3000–3007 的旧本地服务并准备独立构建目录，运行前注意其他本地服务。生产预览用 `npm run local:preview`。

配置变量见 `.env.example`：DATABASE_URL、SITE_ACCESS_PASSWORD，以及 AI_PROVIDER、AI_API_KEY、AI_BASE_URL、AI_MODEL 等。实际 API 密钥由环境注入。

仓库同时包含 `.env` 和 `.env.local` 时，Next.js 与独立脚本加载环境的方式可能不同；必须检查具体脚本，说明实际使用的数据库，不要仅凭文件名猜测。公开配置只是交接快照，不能保证原云端连接长期有效，也不应让新环境依赖原生产数据库。

数据库先在隔离的开发库执行连接检查和迁移状态检查，再决定迁移或恢复。`npm run prisma:migrate:deploy` 会写库；`import:zhongcheng`、客户归并、回填和索引重建也可能写库，需先确认目标。Prisma 配置包含 `rhel-openssl-3.0.x`，这是 Netlify Linux 运行需要的引擎目标，不能只保留 macOS native。

Python 依赖与运行时需要单独安装确认，npm install 不会自动满足 Excel 解析依赖。云端导入尤其要验证 python3 是否存在。

## 8. 接手后建议执行顺序

1. 读取本文和 PRD/规则，执行 git status，确认任务范围。
2. 安装依赖、检查实际环境来源，在隔离开发库检查连接及迁移状态。
3. 执行 lint/build，再验登录 → 风控总览 → 客户档案 → 项目/应收 → 催收报告。
4. 用可回滚数据验证导入前后金额、客户/项目映射、日志及错误处理，优先修复预览确认缺口。
5. 验证文档索引和来源证据，接通 Word 解析；没有证据明确返回资料不足。
6. 注入自己的 AI key 后验证真实供应商调用、结构化输出及失败降级；确保无 key 分析有明确标记。
7. 完成人工确认处置、落库、跟进及审计闭环，再统一 UI/UX。
8. 部署前验证生产运行时、数据库引擎、迁移、鉴权及核心 API，只有实际验证过才能宣称完成。

验收标准是能解释风险、能追溯金额和证据、能安全导入、能人工确认并跟进处置，而不是页面存在或任务清单全勾选。每次改动保持最小范围，不扩展到无关 ERP/方案工厂业务。

## 9. 本次交接验证记录

- 2026-10-30：上一轮代码同步已执行 `npm run lint`，无 ESLint 警告或错误。
- 仓库公开访问与匿名 ZIP 下载已验证 HTTP 200。
- 本文功能差距通过代码静态核对识别，未进行端到端运行验证。
- 本次只补充交接资料和上传范围，不修改业务实现；未恢复数据库、未执行迁移或导入、未调用真实 AI。

## 10. 建议技能

接手 AI 可按任务需要使用：`diagnose`（故障复现与定位）、`handoff`（后续交接）、`netlify-frameworks`/`netlify-deploy`（生产运行与部署）、`spreadsheets`（原始 Excel 与金额核对）、`documents`（Word 需求资料）。技能不可替代实际代码和数据验证。
