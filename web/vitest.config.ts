import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node environment: everything under test is build-time data code, not
    // browser code. Component rendering is verified in the browser instead.
    environment: "node",
    include: ["lib/**/*.test.ts"],
    coverage: { include: ["lib/**/*.ts"], exclude: ["lib/**/*.test.ts"] },
  },
});
