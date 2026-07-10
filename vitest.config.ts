import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

// Pin the test process to a DST-observing zone so the snooze parser's
// daylight-saving tests exercise real spring-forward / fall-back transitions.
// (Set before the runtime reads the zone; propagated to worker threads.)
process.env.TZ = "America/New_York";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
