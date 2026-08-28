/**
 * The system version this bundle was built from, compiled in by scripts/build.js.
 *
 * It has to travel with the code rather than be read from the running world: a browser holding last
 * release's cached bundle reports last release's version here, while `game.system.version` reports what
 * the server actually installed. That disagreement is the only signal a stale client gives off.
 *
 * Outside the bundle — under the test runner — there is no define to substitute, and nothing to compare.
 */
export const SYSTEM_VERSION = typeof __SYSTEM_VERSION__ === "string" ? __SYSTEM_VERSION__ : "dev";
