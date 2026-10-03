import { describe, it, expect } from "vitest";
import { InstalledArtTrim } from "../../src/art/InstalledArtTrim.js";
import { ArtManifest } from "../../src/art/ArtManifest.js";
import { Raster } from "../../src/art/Raster.js";

// Art installed before the store kept the major arcana trimmed is still on the book's padded canvas.
// Once, each installed file is brought to what the manifest now names — and only ever when trimming
// it gives exactly those pixels, so nothing the manifest does not describe is ever rewritten.

// 8×4, painted at (3,1), (4,1), (4,2): a 2×2 drawing on a margin.
const PADDED = Raster.fromPdfMask(8, 4, new Uint8Array([0xFF, 0xE7, 0xF7, 0xFF]));
const TRIMMED = PADDED.trimmed();
// A different drawing, its own padding: one painted pixel at (1,1).
const OTHER = Raster.fromPdfMask(8, 4, new Uint8Array([0xFF, 0xBF, 0xFF, 0xFF]));

const manifest = async (...entries) => ArtManifest.fromJson({ entries: await Promise.all(entries.map(async ([path, raster]) =>
	({ path, key: await raster.key() }))) });

/** The installed store: path → PNG bytes; a path not in it is not installed. */
const reader = files => ({ read: async path => files[path]?.toPng() ?? null });

const writer = () => {
	const written = [];
	return { written, write: async arts => { written.push(...arts); } };
};

describe("InstalledArtTrim", () => {
	it("rewrites an installed padded drawing as the trimmed one the manifest names", async () => {
		const out = writer();
		const trimmed = await new InstalledArtTrim(
			await manifest(["arcana/mindgem.png", TRIMMED]), reader({ "arcana/mindgem.png": PADDED }), out).run();
		expect(trimmed).toEqual(["arcana/mindgem.png"]);
		expect(out.written.map(a => a.path)).toEqual(["arcana/mindgem.png"]);
		expect(await Raster.fromPng(out.written[0].bytes).key()).toBe(await TRIMMED.key());
	});

	it("leaves a file that already matches the manifest alone", async () => {
		const out = writer();
		await new InstalledArtTrim(await manifest(["arcana/mindgem.png", TRIMMED]), reader({ "arcana/mindgem.png": TRIMMED }), out).run();
		expect(out.written).toEqual([]);
	});

	// Kept whole by the store (a steading's arched panel is laid out by its full canvas).
	it("leaves a padded file the manifest names whole", async () => {
		const out = writer();
		await new InstalledArtTrim(await manifest(["steading/arch.png", PADDED]), reader({ "steading/arch.png": PADDED }), out).run();
		expect(out.written).toEqual([]);
	});

	// A GM's own picture at a book path: trimming it does not give the manifest's pixels, so it stays.
	it("leaves a file whose trimmed pixels are not the manifest's", async () => {
		const out = writer();
		await new InstalledArtTrim(await manifest(["arcana/mindgem.png", TRIMMED]), reader({ "arcana/mindgem.png": OTHER }), out).run();
		expect(out.written).toEqual([]);
	});

	it("skips a path that is not installed", async () => {
		const out = writer();
		const trimmed = await new InstalledArtTrim(await manifest(["arcana/mindgem.png", TRIMMED]), reader({}), out).run();
		expect(trimmed).toEqual([]);
		expect(out.written).toEqual([]);
	});

	it("skips a file that is not a PNG it can read", async () => {
		const out = writer();
		const broken = { read: async () => new Uint8Array([1, 2, 3]) };
		await new InstalledArtTrim(await manifest(["arcana/mindgem.png", TRIMMED]), broken, out).run();
		expect(out.written).toEqual([]);
	});

	it("writes every file that needs it in one pass", async () => {
		const out = writer();
		const otherTrimmed = OTHER.trimmed();
		await new InstalledArtTrim(
			await manifest(["arcana/mindgem.png", TRIMMED], ["arcana/ring-of-daagon.png", otherTrimmed]),
			reader({ "arcana/mindgem.png": PADDED, "arcana/ring-of-daagon.png": OTHER }), out).run();
		expect(out.written.map(a => a.path).sort()).toEqual(["arcana/mindgem.png", "arcana/ring-of-daagon.png"]);
	});
});
