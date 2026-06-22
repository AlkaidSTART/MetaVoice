# GitHub Actions CI/CD 配置说明

本项目使用 GitHub Actions 进行持续集成和持续部署。

## 工作流说明

### CI 工作流 (`.github/workflows/ci.yml`)

在以下情况自动运行：
- 推送到 `main` 或 `master` 分支
- 创建或更新 Pull Request 到 `main` 或 `master` 分支

包含三个任务：

1. **Lint & Type Check**
   - 运行 ESLint 检查代码质量
   - 运行 TypeScript 类型检查

2. **Test**
   - 生成 Prisma Client
   - 运行单元测试

3. **Build**
   - 构建生产版本（仅在 lint 和 test 通过后运行）

## 环境变量配置

### CI 构建环境变量

CI 构建时设置了 `NEXT_SKIP_ENV_VALIDATION=1`，跳过环境变量验证。
这是因为 CI 环境不需要真实的 API 密钥，只需要验证构建是否成功。

### Vercel 部署环境变量

在 Vercel Dashboard 中配置以下环境变量：

```bash
# DashScope API（必需）
DASHSCOPE_API_KEY=sk-xxx

# Supabase（必需）
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# 数据库（如果使用）
DATABASE_URL=xxx
DIRECT_URL=xxx
```

## 可选：启用自动部署到 Vercel

如果需要通过 GitHub Actions 部署到 Vercel（而不是使用 Vercel 的自动部署）：

1. 在 Vercel Dashboard 获取以下信息：
   - `VERCEL_TOKEN`：在 Account Settings > Tokens 创建
   - `VERCEL_ORG_ID`：在项目设置中查看
   - `VERCEL_PROJECT_ID`：在项目设置中查看

2. 在 GitHub 仓库设置 Secrets：
   - 进入 Settings > Secrets and variables > Actions
   - 添加上述三个 secrets

3. 取消 `.github/workflows/ci.yml` 中 deploy job 的注释

## 本地测试

在提交前可以本地运行相同的检查：

```bash
# 运行 lint
npm run lint

# 运行类型检查
npx tsc --noEmit

# 运行测试
npm run test

# 构建项目
npm run build
```

## 注意事项

- 所有 PR 必须通过 CI 检查才能合并
- CI 使用 Node.js 20.x
- 使用 `npm ci` 而不是 `npm install` 确保依赖版本一致性
- 并发控制：同一分支的新推送会取消正在运行的旧工作流