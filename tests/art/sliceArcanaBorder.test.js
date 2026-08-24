import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { FrameGeometry, BorderRegion } from "../../scripts/art/slice-arcana-border.js";
import { Raster } from "../../src/art/Raster.js";

const byName = (regions) => Object.fromEntries(regions.map(r => [r.name, r]));
const box = (r) => [r.x, r.y, r.width, r.height];

const CORNERS = ["tl", "tr", "bl", "br"];
const RUNS = ["top", "bottom", "left", "right"];

describe("FrameGeometry", () => {
	const regions = byName(new FrameGeometry(100, 60, 10, 20).regions());

	it("cuts four corners and four edge tiles, and never the hollow centre", () => {
		expect(Object.keys(regions).sort()).toEqual([...CORNERS, ...RUNS].sort());
	});

	it("keeps corners square at the inset size", () => {
		expect(box(regions.tl)).toEqual([0, 0, 10, 10]);
		expect(box(regions.tr)).toEqual([90, 0, 10, 10]);
		expect(box(regions.bl)).toEqual([0, 50, 10, 10]);
		expect(box(regions.br)).toEqual([90, 50, 10, 10]);
	});

	it("cuts edge tiles one tile long, across the full frame thickness", () => {
		expect([regions.top.width, regions.top.height]).toEqual([20, 10]);
		expect([regions.bottom.width, regions.bottom.height]).toEqual([20, 10]);
		expect([regions.left.width, regions.left.height]).toEqual([10, 20]);
		expect([regions.right.width, regions.right.height]).toEqual([10, 20]);
	});

	it("takes each tile from the middle of its side, clear of both corner notches", () => {
		// Horizontal sides run x∈[10,90]; a tile of 20 centres at 40. Vertical sides run y∈[10,50].
		expect(regions.top.x).toBe(40);
		expect(regions.bottom.x).toBe(40);
		expect(regions.left.y).toBe(20);
		expect(regions.right.y).toBe(20);
		for (const name of RUNS) {
			const r = regions[name];
			expect(r.x, name).toBeGreaterThanOrEqual(0);
			expect(r.y, name).toBeGreaterThanOrEqual(0);
			expect(r.x + r.width, name).toBeLessThanOrEqual(100);
			expect(r.y + r.height, name).toBeLessThanOrEqual(60);
		}
		expect(regions.top.x).toBeGreaterThanOrEqual(10);
		expect(regions.top.x + regions.top.width).toBeLessThanOrEqual(90);
		expect(regions.left.y).toBeGreaterThanOrEqual(10);
		expect(regions.left.y + regions.left.height).toBeLessThanOrEqual(50);
	});

	it("pins each edge tile to the outer face of its side", () => {
		expect(regions.top.y).toBe(0);
		expect(regions.bottom.y).toBe(50);
		expect(regions.left.x).toBe(0);
		expect(regions.right.x).toBe(90);
	});

	it("takes its bounds from a raster", () => {
		const r = new Raster(30, 30, 1, new Uint8Array(900));
		expect(byName(FrameGeometry.of(r, 5, 4).regions()).br.x).toBe(25);
	});

	it("rejects geometry that leaves no side run to tile from", () => {
		expect(() => new FrameGeometry(20, 100, 10, 4)).toThrow(/no side runs/);
		expect(() => new FrameGeometry(100, 20, 10, 4)).toThrow(/no side runs/);
		expect(() => new FrameGeometry(100, 100, 0, 4)).toThrow(/inset must be positive/);
		expect(() => new FrameGeometry(100, 100, 10, 0)).toThrow(/tile must be positive/);
	});

	it("rejects a tile longer than the shortest side run", () => {
		// Vertical runs are 60 - 2*10 = 40 long, so a 50 tile cannot come from one.
		expect(() => new FrameGeometry(100, 60, 10, 50)).toThrow(/longer than a side run/);
	});
});

describe("BorderRegion.cut", () => {
	it("lifts its rectangle out of the source raster", () => {
		const src = new Raster(3, 2, 1, new Uint8Array([0, 1, 2, 3, 4, 5]));
		expect([...new BorderRegion("tr", 2, 0, 1, 2).cut(src).px]).toEqual([2, 5]);
	});
});

// The stylesheet masks the card with these eight files at sizes derived from this geometry;
// a re-slice that changed it would silently distort or misalign the frame in every browser.
describe("shipped arcana border slices", () => {
	const INSET = 40, TILE = 20, THICKNESS = 28;
	const slice = (name) => Raster.fromPng(readFileSync(`assets/ui/decor/arcana-border-${name}.png`));
	const css = readFileSync("styles/stonetop.css", "utf8");

	it("match the frame geometry of the source art", () => {
		const source = Raster.fromPng(readFileSync("assets/ui/decor/arcana-card-border.png"));
		for (const region of FrameGeometry.of(source, INSET, TILE).regions()) {
			const r = slice(region.name);
			expect([r.width, r.height], region.name).toEqual([region.width, region.height]);
		}
	});

	it("carry the source's alpha, which is what a mask reads", () => {
		for (const name of [...CORNERS, ...RUNS]) {
			const r = slice(name);
			const alphas = new Set();
			for (let i = 0; i < r.px.length; i += r.channels) alphas.add(r.px[i + r.channels - 1]);
			expect(alphas.size, name).toBeGreaterThan(1);
		}
	});

	// The runs repeat, so their rendered tile size has to be the slice scaled by the frame's
	// thickness. Get this wrong and the chain either overlaps itself or leaves gaps.
	it("are masked at the size the frame thickness implies", () => {
		const scale = THICKNESS / INSET;
		const runTile = TILE * scale;
		expect(runTile).toBe(14);
		expect(css).toContain(`mask-size: ${THICKNESS}px ${THICKNESS}px;`);
		expect(css).toContain(`mask-size: ${runTile}px ${THICKNESS}px;`);
		expect(css).toContain(`mask-size: ${THICKNESS}px ${runTile}px;`);
	});

	// A run tiles across its whole box, so it needs a box that already stops at the corners —
	// and the box that carries it must not itself be masked, or it would clip its own runs away.
	it("run in boxes inset by the frame thickness, on an unmasked span", () => {
		expect(css).toMatch(/\.stonetop-arcanum-frame::before \{\s*inset: 0 28px;/);
		expect(css).toMatch(/\.stonetop-arcanum-frame::after \{\s*inset: 28px 0;/);
		const span = css.slice(css.indexOf(".stonetop-arcanum-frame {"));
		expect(span.slice(0, span.indexOf("}"))).not.toMatch(/mask/);
	});
});
