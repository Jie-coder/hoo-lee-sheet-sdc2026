import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// jsdom covers schema unit tests (.test.ts) and component tests (.test.tsx,
// React Testing Library) per the Next.js Vitest guide. The data importer's
// own unit/integration tests under scripts/ run here too.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
