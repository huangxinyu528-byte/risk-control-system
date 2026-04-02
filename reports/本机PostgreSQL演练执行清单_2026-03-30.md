# 本机 PostgreSQL 演练执行清单_2026-03-30

## 第一步：确认本机 PostgreSQL 已启动

### 执行命令
```bash
pg_isready -h localhost -p 5432
```

### 预期结果
- 返回 `accepting connections`

### 出错时怎么看
- 如果提示命令不存在，说明 `pg_isready` 未安装到 PATH
- 如果提示拒绝连接，说明 PostgreSQL 服务未启动或端口不对

---

## 第二步：创建本机演练数据库

### 执行命令
```bash
createdb credit_ops_admin
```

或：

```bash
psql -U postgres -c "CREATE DATABASE credit_ops_admin;"
```

### 预期结果
- 数据库创建成功

### 出错时怎么看
- 如果提示数据库已存在，可以直接继续下一步
- 如果提示权限不足，检查当前 PostgreSQL 用户权限

---

## 第三步：配置本机 DATABASE_URL

### 执行命令
在项目根目录创建或修改 `.env.local`：

```bash
cp .env.example .env.local
```

然后把其中的 `DATABASE_URL` 改成你本机真实值，例如：

```bash
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/credit_ops_admin?schema=public"
SITE_ACCESS_PASSWORD="your-local-password"
```

### 预期结果
- `.env.local` 已存在
- `DATABASE_URL` 指向你本机 PostgreSQL

### 出错时怎么看
- 如果密码有特殊字符，需要做 URL 编码
- 如果端口不是 `5432`，要改成实际端口

---

## 第四步：生成 Prisma Client

### 执行命令
```bash
npm run prisma:generate
```

### 预期结果
- Prisma Client 生成成功

### 出错时怎么看
- 若报 `schema.prisma` 解析错误，先修 Prisma 配置
- 若依赖缺失，先执行 `npm install`

---

## 第五步：验证数据库连通

### 执行命令
```bash
npm run db:check
```

### 预期结果
- 输出 `PostgreSQL 连接成功`
- 同时返回当前数据库名、用户、服务器时间

### 出错时怎么看
- 如果提示 `DATABASE_URL 未配置`，检查 `.env.local`
- 如果提示认证失败，检查用户名/密码
- 如果提示连接超时，检查 PostgreSQL 是否启动、端口是否正确

---

## 第六步：执行 migration

### 执行命令
```bash
npm run prisma:migrate -- --name init_local_rehearsal
```

### 预期结果
- 本机数据库建表成功

### 出错时怎么看
- 若提示 migration 冲突，先确认本机库是否为空
- 若只是想把已有 migration 应用到库，也可用：

```bash
npm run prisma:migrate:deploy
```

---

## 第七步：导入本地真实数据（如已准备）

### 执行命令
如果你使用现有导入脚本：

```bash
npm run import:zhongcheng
```

### 预期结果
- 数据导入成功
- 客户、项目、应收、风险、档案等数据进入本机 PostgreSQL

### 出错时怎么看
- 若提示 Python/文件路径问题，检查：
  - `python3`
  - `data/` 下 Excel 文件是否存在
- 若提示数据库写入错误，先确认 migration 是否执行完成

---

## 第八步：启动项目

### 执行命令
```bash
npm run local:stable
```

### 预期结果
- 本机站点启动成功
- 可打开：
  - `http://localhost:3006/login`
  - `http://localhost:3006/customers`
  - `http://localhost:3006/risk`

### 出错时怎么看
- 若 3006 被占用，先执行：

```bash
npm run local:stop
```

- 若构建失败，先看终端最后 50 行报错

---

## 第九步：最小验证

### 需要检查
- `/login`
- `/customers`
- `/customers/[id]`
- `/risk`
- `/risk/customers`
- `/risk/projects`

### 预期结果
- 页面可打开
- 客户详情页能显示完整账款档案
- 风控页面能显示真实数据库结果

---

## 当前哪些动作 Codex 可以直接帮你完成
- 检查 Prisma 配置是否正确
- 补 `.env.example`
- 补数据库连通检查脚本
- 帮你看 migration / build / 启动报错
- 帮你核对页面和 API 是否已经读到真实数据库

## 哪些动作必须由你亲自执行
- 确认你本机 PostgreSQL 用户名/密码
- 在你本机创建数据库
- 配置你本机真实 `.env.local`
- 若涉及系统权限，启动 PostgreSQL 服务

## 完成本机演练后，如何再迁到正式云 PostgreSQL
建议顺序：
1. 本机 PostgreSQL 跑通
2. 在本机完成数据导入和页面验证
3. 再把同一套结构和数据迁到云 PostgreSQL
4. 最后让 Netlify 切到云数据库
