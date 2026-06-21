import nextEnv from "@next/env";
import { defineConfig } from "prisma/config";

const { loadEnvConfig } = nextEnv;

// 与 Next.js 保持一致：优先读取部署平台注入的环境变量，
// 本地开发时再从 .env* 文件补充加载。
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
