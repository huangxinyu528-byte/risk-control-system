# 本机 PostgreSQL 初始化说明_2026-03-30

## 一、目标
让当前项目先稳定运行在你电脑本机的 PostgreSQL 上，作为正式数据版上线前的本机演练环境。

## 二、你需要准备的本机信息
至少准备以下 5 项：

- PostgreSQL 用户名
- PostgreSQL 密码
- PostgreSQL 端口
- 本机数据库名
- PostgreSQL 是否已经启动

常见本机默认值示例：
- 用户名：`postgres`
- 端口：`5432`
- 主机：`localhost`

## 三、本机 DATABASE_URL 配置方式
建议格式：

```bash
DATABASE_URL="postgresql://用户名:密码@localhost:5432/数据库名?schema=public"
```

示例：

```bash
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/credit_ops_admin?schema=public"
```

## 四、建议的本机初始化顺序
1. 先确认 PostgreSQL 服务已启动
2. 创建本机数据库
3. 在项目根目录配置 `.env.local`
4. 执行 Prisma generate
5. 执行 Prisma migration
6. 执行数据库连通检查
7. 启动项目并验证页面

## 五、本机数据库创建示例
如果你本机安装了 `psql`，可参考：

```bash
createdb credit_ops_admin
```

或者：

```bash
psql -U postgres -c "CREATE DATABASE credit_ops_admin;"
```

## 六、项目启动前建议
先执行：

```bash
npm install
npm run prisma:generate
npm run db:check
```

如果通过，再执行 migration 和启动。

## 七、完成标准
- `npm run db:check` 返回 PostgreSQL 连接成功
- `npm run prisma:migrate` 可执行
- `/login`、`/customers`、`/risk` 能打开
