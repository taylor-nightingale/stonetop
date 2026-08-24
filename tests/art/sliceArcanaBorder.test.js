import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { NineSlice, BorderRegion } from "../../scripts/art/slice-arcana-border.js";
import { Raster } from "../../src/art/Raster.js";

const byName = (regions) => Object.fromEntries(regions.map(r => [r.name, r]));
const box = (r) => [r.x, r.y, r.width, r.height];

describe("NineSlice geometry", () => {
	const regions = byName(new NineSlice(100, 60, 10).regions());

	it("cuts the eight frame regions and never the hollow centre", () => {
		expect(Object.keys(regions).sort()).toEqual(
			["bl", "bottom", "br", "left", "right", "tl", "top", "tr"]);
	});

	it("keeps corners square at the inset size", () => {
		expect(box(regions.tl)).toEqual([0, 0, 10, 10]);
		expect(box(regions.tr)).toEqual([90, 0, 10, 10]);
		expect(box(regions.bl)).toEqual([0, 50, 10, 10]);
		expect(box(regions.br)).toEqual([90, 50, 10, 10]);
	});

	it("spans the edges between the corners, not through them", () => {
		expect(box(regions.top)).toEqual([10, 0, 80, 10]);
		expect(box(regions.bottom)).toEqual([10, 50, 80, 10]);
		expect(box(regions.left)).toEqual([0, 10, 10, 40]);
		expect(box(regions.right)).toEqual([90, 10, 10, 40]);
	});

	it("tiles the frame without overlap or gaps", () => {
		const covered = new Set();
		for (const r of Object.values(regions)) {
			for (let y = r.y; y < r.y + r.height; y++) {
				for (let x = r.x; x < r.x + r.width; x++) {
					const cell = `${x},${y}`;
					expect(covered.has(cell)).toBe(false);
					covered.add(cell);
				}
			}
		}
		expect(covered.size).toBe(100 * 60 - 80 * 40); // everything but the centre
	});

	it("takes its bounds from a raster", () => {
		const r = new Raster(30, 30, 1, new Uint8Array(900));
		expect(byName(NineSlice.of(r, 5).regions()).br.x).toBe(25);
	});

	it("rejects an inset that leaves no middle band", () => {
		expect(() => new NineSlice(20, 100, 10)).toThrow(/no middle band/);
		expect(() => new NineSlice(100, 20, 10)).toThrow(/no middle band/);
		expect(() => new NineSlice(100, 100, 0)).toThrow(/must be positive/);
	});
});

describe("BorderRegion.cut", () => {
	it("lifts its rectangle out of the source raster", () => {
		const src = new Raster(3, 2, 1, new Uint8Array([0, 1, 2, 3, 4, 5]));
		expect([...new BorderRegion("tr", 2, 0, 1, 2).cut(src).px]).toEqual([2, 5]);
	});
});

// The stylesheet masks the card with these eight files at these sizes; a re-slice that
// changed the geometry would silently distort the frame in every browser.
describe("shipped arcana border slices", () => {
	const sizeOf = (name) => {
		const r = Raster.fromPng(readFileSync(`assets/ui/decor/arcana-border-${name}.png`));
		return [r.width, r.height];
	};

	it("match the nine-slice of the source frame", () => {
		const source = Raster.fromPng(readFileSync("assets/ui/decor/arcana-card-border.png"));
		for (const region of NineSlice.of(source, 40).regions()) {
			expect(sizeOf(region.name), region.name).toEqual([region.width, region.height]);
		}
	});

	it("carry the source's alpha, which is what a mask reads", () => {
		const tl = Raster.fromPng(readFileSync("assets/ui/decor/arcana-border-tl.png"));
		const alphas = new Set();
		for (let i = 0; i < tl.px.length; i += tl.channels) alphas.add(tl.px[i + tl.channels - 1]);
		expect(alphas.size).toBeGreaterThan(1);
	});
});
