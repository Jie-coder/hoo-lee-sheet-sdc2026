import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// jsdom has no layout observers; framer-motion's viewport and scroll
// features ask for them, so stub them with observers that never fire.
// Assigned directly (not vi.stubGlobal) so a test's vi.unstubAllGlobals()
// does not remove them.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
const g = globalThis as Record<string, unknown>;
g.IntersectionObserver ??= NoopObserver;
g.ResizeObserver ??= NoopObserver;

afterEach(() => {
  cleanup();
});
