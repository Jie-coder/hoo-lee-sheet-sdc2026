import { defineConfig } from "vitest/config";

// Schema unit tests, plus the data importer's own unit/integration tests.
// Component tests would follow the Next.js Vitest guide (jsdom, Testing
// Library); none of this renders anything.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
