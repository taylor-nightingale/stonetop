import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.js"],
    // The style suite measures real Chrome (tests/styles/RenderProbe.js): a `describe` there spawns
    // a browser once or twice in a beforeAll, which comfortably fits vitest's 5s default on its own
    // and does not when thirty files are running in parallel. The symptom is not an assertion
    // failure but a hook timeout — the file's tests report as skipped, and the same file passes when
    // run alone, which is exactly the shape of a flake nobody can reproduce.
    //
    // Raised for every test rather than per file: fifteen of the twenty-four probe files had no
    // explicit budget, so any of them could be the one that fails on a given run. A generous ceiling
    // costs nothing on the pure-JS tests, which finish in milliseconds either way.
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
