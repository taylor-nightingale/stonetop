import { describe, it, expect } from "vitest";
import { ArtManifest, ManifestEntry } from "../../src/art/ArtManifest.js";

const fakeRaster = (width, height, thumb) => ({ width, height, thumb8: () => thumb });

describe("ManifestEntry JSON round-trip", () => {
	it("keeps match only when present", () => {
		const exact = ManifestEntry.fromJson({ path: "wonders/abc.png", key: "abc" });
		expect(exact.toJson()).toEqual({ path: "wonders/abc.png", key: "abc" });
		const match = { width: 10, height: 5, thumb: Array(64).fill(7) };
		const lossy = ManifestEntry.fromJson({ path: "wonders/def.png", key: "def", match });
		expect(lossy.toJson()).toEqual({ path: "wonders/def.png", key: "def", match });
	});
});

describe("ArtManifest.pathForKey", () => {
	const manifest = ArtManifest.fromJson({
		entries: [
			{ path: "wonders/abc.png", key: "abc" },
			{ path: "arcana/mindgem.png", key: "m1" },
		],
	});
	it("resolves a known key to its store path", () => {
		expect(manifest.pathForKey("m1")).toBe("arcana/mindgem.png");
	});
	it("returns null for an unknown key", () => {
		expect(manifest.pathForKey("nope")).toBeNull();
	});
	it("reports size and paths", () => {
		expect(manifest.size).toBe(2);
		expect(manifest.paths()).toEqual(["wonders/abc.png", "arcana/mindgem.png"]);
	});
});

describe("ArtManifest.identifyLossy", () => {
	const flat = (v) => Array(64).fill(v);
	const manifest = ArtManifest.fromJson({
		entries: [
			{ path: "wonders/exact.png", key: "e1" }, // no match data — never a lossy candidate
			{ path: "wonders/wide.png", key: "w1", match: { width: 3000, height: 799, thumb: flat(100) } },
			{ path: "wonders/wide2.png", key: "w2", match: { width: 3000, height: 799, thumb: flat(140) } },
			{ path: "wonders/tall.png", key: "t1", match: { width: 799, height: 3000, thumb: flat(100) } },
		],
	});

	it("identifies a half-resolution decode of the same image", () => {
		expect(manifest.identifyLossy(fakeRaster(1500, 400, flat(101)))).toBe("wonders/wide.png");
	});
	it("picks the nearest signature when several share an aspect", () => {
		expect(manifest.identifyLossy(fakeRaster(3000, 799, flat(138)))).toBe("wonders/wide2.png");
	});
	it("rejects a thumbnail beyond the distance threshold", () => {
		expect(manifest.identifyLossy(fakeRaster(3000, 799, flat(120)))).toBeNull();
	});
	it("rejects a matching thumbnail with the wrong aspect", () => {
		expect(manifest.identifyLossy(fakeRaster(1000, 1000, flat(100)))).toBeNull();
	});
});
