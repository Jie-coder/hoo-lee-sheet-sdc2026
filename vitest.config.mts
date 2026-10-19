import { defineConfig } from "vitest/config";

// Schema unit tests only. Component tests would follow the Next.js Vitest
// guide (jsdom, Testing Library); these contracts do not render anything.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
