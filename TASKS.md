# 当前任务清单

## Stage 0: 冻结现场

- [x] 确认主项目路径：`/Users/jamiekeke/Documents/New project/zhongcheng-risk-admin`
- [x] 查看当前 git 状态
- [x] 确认项目根目录缺少轻量项目文档
- [x] 创建 `PRD.md`
- [x] 创建 `PLAN.md`
- [x] 创建 `TASKS.md`
- [x] 创建 `RULES.md`
- [x] 复查 git 状态
- [x] 向用户汇报第 0 阶段结果

## Stage 1: 信息架构收口

- [x] 简化主菜单
- [x] 将首页入口收口到风控总览
- [x] 隐藏重复页面入口
- [x] 验证页面仍可直接访问

## Stage 2: 风险总览

- [x] 增加风险评分标准
- [x] 高风险客户和项目置顶
- [x] 风险结论显示原因

## Stage 3: 风险客户详情简化

- [x] 保留顶部指标
- [x] 只保留内嵌 Excel 表格
- [x] 隐藏重复项目明细表
- [x] 简化右侧风险摘要

## Stage 4: 文件导入悬浮入口

- [x] 添加悬浮操作球
- [x] 接入 Excel 导入入口
- [x] 接入 Word 导入入口
- [x] 添加更新预览/确认流程

## Stage 5: 客户档案问答和证据链

- [x] 定义问答返回结构
- [x] 接入文档索引和客户数据
- [x] 展示证据链

## Stage 6: 右侧 AI 风控助理

- [x] 添加右侧面板
- [x] 支持当前页面上下文
- [x] 固定输出结构

## Stage 7: AI 月报/催收报告

- [x] 定义报告 JSON 结构
- [x] 生成中文报告
- [x] 支持复制不同角色版本

## Stage 8: 顾问式风险动作建议

- [x] 定义动作建议结构
- [x] 展示原因和证据
- [x] 添加人工确认/驳回

## Stage 9: 稳定性验证

- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run db:check`
- [x] Prisma migration 状态检查
- [x] Netlify 配置检查

## Stage 10: UI / UX / UE

- [x] 统一视觉
- [x] 优化交互
- [x] 优化响应式
- [x] 最终走查

## AI Provider Adapter

- [x] 增加通用 AI 环境变量约定
- [x] 保留 OpenAI Responses API 调用
- [x] 增加 DeepSeek / OpenAI-compatible Chat Completions 调用
- [x] 前端模式文案改为通用 AI 模式
- [x] `npm run lint`
- [x] `npm run build`
- [x] 本地无 key fallback API 验收
