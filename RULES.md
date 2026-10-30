# 本轮改造规则

## Scope Control

- 每次只做一个阶段。
- 当前阶段完成前，不提前实现后续阶段功能。
- 不发散做与风控无关的新模块。
- 不删除已有数据库表或历史数据。
- 不重构无关代码。

## Data Safety

- 导入文件不得静默覆盖关键金额、客户主体、项目主体和风险结论。
- AI 输出不得直接修改业务数据。
- 风险动作建议必须人工确认后才可写入处置记录。
- 无证据的数据结论必须标记为资料不足。

## Code Change Boundaries

### AI Provider Adapter Task

当前任务只允许修改：

- `RULES.md`
- `TASKS.md`
- `.env.example`
- `lib/server/ai/openai-client.ts`
- `lib/server/ai/risk-assistant.ts`
- `components/ai/risk-assistant-panel.tsx`

本任务目标是让 AI 风控助理支持 OpenAI 与 OpenAI-compatible 模型供应商，例如 DeepSeek、Kimi、阿里百炼、火山方舟、智谱等。不得改动数据库、导入流程、前端页面布局或风险计算逻辑。

验收：

- 未配置 key 时仍返回基础分析。
- `AI_PROVIDER=openai` 默认走 OpenAI Responses API。
- `AI_PROVIDER=deepseek` 等兼容供应商走 Chat Completions。
- `npm run lint` 和 `npm run build` 通过。

### Stage 10 Historical Boundary

阶段 10 只允许修改：

- `PRD.md`
- `PLAN.md`
- `TASKS.md`
- `RULES.md`
- `components/customers/customer-full-profile-page.tsx`
- `components/ai/risk-assistant-panel.tsx`
- `components/collections/collection-report-management.tsx`
- `app/globals.css`

本阶段不得修改数据库、导入接口、agent 接口或业务计算逻辑。只做 UI、UX、UE 整理。

后续阶段开始前，必须先更新本文件的允许修改范围。

## Verification

- 小改动至少检查相关页面或类型错误。
- 阶段性改动必须运行 lint。
- 涉及构建、路由、服务端逻辑时必须运行 build。
- 涉及 Prisma 或数据库时必须检查数据库连接和 migration 状态。

## UI Timing

- 功能结构稳定前，不做全局 UI / UX / UE 重设计。
- 阶段 10 才统一处理视觉、交互、响应式和体验一致性。
