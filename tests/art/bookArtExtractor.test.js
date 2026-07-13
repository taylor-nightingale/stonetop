import { describe, it, expect } from "vitest";
import { BookArtExtractor } from "../../src/art/BookArtExtractor.js";
import { ArtManifest } from "../../src/art/ArtManifest.js";
import { Raster } from "../../src/art/Raster.js";

// -- stub pdf.js --------------------------------------------------------------
const OPS = { paintImageMaskXObject: 85, paintImageXObject: 86 };
const store = (objects) => ({
	has: (id) => id in objects,
	get: (id, cb) => { if (id in objects) cb(objects[id]); }, // unknown ids never call back
});
const page = ({ ops, objs = {}, commonObjs = {} }) => ({
	objs: store(objs),
	commonObjs: store(commonObjs),
	getOperatorList: async () => ops,
	cleanup() {},
});
const stubPdfjs = (pages) => ({
	OPS,
	getDocument: () => ({
		promise: Promise.resolve({ numPages: pages.length, getPage: async (n) => pages[n - 1] }),
		destroy: async () => {},
	}),
});

const extractor = (pages, manifest) =>
	new BookArtExtractor(stubPdfjs(pages), manifest, { objectTimeoutMs: 20 });

// -- fixtures ------------------------------------------------------------------
// A 13×5 mask (partial trailing row byte), its stencil raster, and an RGB image.
const maskWidth = 13, maskHeight = 5, maskRowBytes = 2;
const maskBits = Uint8Array.from({ length: maskRowBytes * maskHeight }, (_, i) => (i * 37 + 11) & 255);
const stencil = Raster.fromPdfMask(maskWidth, maskHeight, maskBits);
const rgb = new Raster(4, 3, 3, Uint8Array.from({ length: 36 }, (_, i) => (i * 7) & 255));
const grayAsRgb = new Raster(2, 2, 3, new Uint8Array([9, 9, 9, 50, 50, 50, 90, 90, 90, 200, 200, 200]));

const manifestFor = async (entries) => ArtManifest.fromJson({ entries: await Promise.all(entries) });

describe("BookArtExtractor", () => {
	it("finds a stencil through the two-level mask object indirection", async () => {
		const manifest = await manifestFor([
			(async () => ({ path: `wonders/${await stencil.key()}.png`, key: await stencil.key() }))(),
		]);
		const pages = [page({
			ops: { fnArray: [OPS.paintImageMaskXObject], argsArray: [[{ width: maskWidth, height: maskHeight, data: "mask_p0_1" }]] },
			objs: { mask_p0_1: { data: maskBits } },
		})];
		const result = await extractor(pages, manifest).extract(new Uint8Array());
		expect(result.found).toHaveLength(1);
		expect(result.found[0].path).toBe(`wonders/${await stencil.key()}.png`);
		// The delivered bytes decode to the exact committed raster.
		expect(await Raster.fromPng(result.found[0].bytes).key()).toBe(await stencil.key());
	});

	it("resolves image ids from commonObjs and matches RGB by exact key", async () => {
		const manifest = await manifestFor([
			(async () => ({ path: "wonders/color.png", key: await rgb.key() }))(),
		]);
		const pages = [page({
			ops: { fnArray: [OPS.paintImageXObject], argsArray: [["img_p0_1"]] },
			commonObjs: { img_p0_1: { width: 4, height: 3, data: rgb.px } },
		})];
		const result = await extractor(pages, manifest).extract(new Uint8Array());
		expect(result.found.map((f) => f.path)).toEqual(["wonders/color.png"]);
	});

	it("matches grayscale committed as one channel but delivered as expanded RGB", async () => {
		const gray = grayAsRgb.toGray();
		const manifest = await manifestFor([
			(async () => ({ path: "wonders/gray.png", key: await gray.key() }))(),
		]);
		const pages = [page({
			ops: { fnArray: [OPS.paintImageXObject], argsArray: [["img_p0_1"]] },
			objs: { img_p0_1: { width: 2, height: 2, data: grayAsRgb.px } },
		})];
		const result = await extractor(pages, manifest).extract(new Uint8Array());
		expect(result.found.map((f) => f.path)).toEqual(["wonders/gray.png"]);
	});

	it("identifies a lossy image perceptually when no key matches", async () => {
		// Committed at 32×16; the "decoder" hands back a half-resolution 16×8 variant.
		const committed = new Raster(32, 16, 1, Uint8Array.from({ length: 32 * 16 }, () => 100));
		const halfRes = new Raster(16, 8, 3, Uint8Array.from({ length: 16 * 8 * 3 }, () => 101));
		const manifest = await manifestFor([
			(async () => ({
				path: "wonders/lossy.png",
				key: await committed.key(),
				match: { width: 32, height: 16, thumb: committed.thumb8() },
			}))(),
		]);
		const pages = [page({
			ops: { fnArray: [OPS.paintImageXObject], argsArray: [["img_p0_1"]] },
			objs: { img_p0_1: { width: 16, height: 8, data: halfRes.px } },
		})];
		const result = await extractor(pages, manifest).extract(new Uint8Array());
		expect(result.found.map((f) => f.path)).toEqual(["wonders/lossy.png"]);
		// We keep the decoder's pixels, re-encoded as PNG, under the committed name.
		expect([...Raster.fromPng(result.found[0].bytes).px]).toEqual([...halfRes.px]);
	});

	it("skips repeated object ids and repeated paths", async () => {
		const manifest = await manifestFor([
			(async () => ({ path: "wonders/color.png", key: await rgb.key() }))(),
		]);
		const image = { width: 4, height: 3, data: rgb.px };
		const pages = [page({
			ops: {
				fnArray: [OPS.paintImageXObject, OPS.paintImageXObject, OPS.paintImageXObject],
				argsArray: [["img_p0_1"], ["img_p0_1"], ["img_p0_2"]], // same id twice + same pixels under a new id
			},
			objs: { img_p0_1: image, img_p0_2: { ...image } },
		})];
		const result = await extractor(pages, manifest).extract(new Uint8Array());
		expect(result.imagesSeen).toBe(2); // repeat id skipped before decode
		expect(result.found).toHaveLength(1);
	});

	it("gives up on an object that never resolves instead of hanging", async () => {
		const manifest = await manifestFor([]);
		const pages = [page({
			ops: { fnArray: [OPS.paintImageXObject], argsArray: [["img_missing"]] },
		})];
		const result = await extractor(pages, manifest).extract(new Uint8Array());
		expect(result.found).toEqual([]);
		expect(result.imagesSeen).toBe(0);
	});

	it("reports page progress", async () => {
		const manifest = await manifestFor([]);
		const empty = () => page({ ops: { fnArray: [], argsArray: [] } });
		const seen = [];
		await extractor([empty(), empty()], manifest).extract(new Uint8Array(), {
			onProgress: (p) => seen.push(p),
		});
		expect(seen).toEqual([
			{ page: 1, pages: 2, found: 0 },
			{ page: 2, pages: 2, found: 0 },
		]);
	});
});
