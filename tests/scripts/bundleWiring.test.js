import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { buildOptions, manifestPath } from "../../scripts/build.js";

// Foundry loads whatever system.json names and nothing else. If the manifest and the build drift apart —
// an outfile renamed here, a path left behind there — nothing else would notice: the bundle builds, the
// tests pass, and the shipped system loads no JavaScript at all.

const manifest = JSON.parse(readFileSync(new URL("../../system.json", import.meta.url), "utf8"));
const options  = buildOptions();

describe("the bundle the manifest asks Foundry to load", () => {
	it("is the file the build writes", () => {
		expect(manifest.esmodules).toEqual([manifestPath()]);
		expect(options.outfile.endsWith(manifestPath())).toBe(true);
	});

	it("is built from an entry point that exists", () => {
		expect(options.entryPoints.every(existsSync)).toBe(true);
	});

	// One file is the point: a client that fetches modules separately caches them separately, and can
	// end up running a mix of two releases.
	it("is a single bundled ES module", () => {
		expect(options.bundle).toBe(true);
		expect(options.format).toBe("esm");
	});
});

describe("the version compiled into the bundle", () => {
	// The stamp is only worth anything while it is the manifest's. Written down by hand it would drift
	// silently in one of two directions — every client stale forever, or no client ever stale — and both
	// look exactly like a check that works.
	it("is the manifest's, taken at build time", () => {
		expect(options.define.__SYSTEM_VERSION__).toBe(JSON.stringify(manifest.version));
	});
});
