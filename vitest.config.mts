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
      // Outside Next's server-component bundler there is no "react-server"
      // resolve condition, so the real "server-only" package always throws
      // (see node_modules/server-only/index.js). Its own package.json picks
      // the no-op "empty.js" only under that condition, so point tests at
      // it directly instead of flipping conditions globally (which would
      // also affect react/react-dom's own server/client exports).
      "server-only": path.resolve(import.meta.dirname, "./node_modules/server-only/empty.js"),
    },
  },
});
