import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@app": path.resolve(__dirname, "app"),
      "@lib": path.resolve(__dirname, "app/lib"),
      "@test": path.resolve(__dirname, "test"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}", "test/**/*.spec.{ts,tsx}"],
    exclude: ["node_modules", "dist", ".next"],
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "lib/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "app/api/**/*.ts",
      ],
      exclude: [
        "node_modules",
        "dist",
        ".next",
        "test",
        "**/*.d.ts",
        "**/*.config.*",
      ],
    },
  },
});
