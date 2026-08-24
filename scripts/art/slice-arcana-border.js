// Cuts assets/ui/decor/arcana-card-border.png into the eight PNGs the arcanum card's
// chain frame is masked with: four corner squares and four short repeating edge tiles.
//
// Why the card can't just use the whole image: the frame is a nine-slice — notched
// corners that must not scale, straight chain runs that must span the card's sides.
// `mask-border` expresses that in one declaration, but Firefox implements neither
// `mask-border` nor `-webkit-mask-box-image`, so there the mask is dropped and the
// pseudo-element paints as a solid --st-decor block over the whole card. Plain
// `mask-image` layers say the same thing in CSS every engine supports.
//
// Why the edges are TILES rather than full-length runs: mask-border's `stretch`
// scaled each run to the card's side, so the chain's link size tracked the card's
// shape — the 1045px vertical runs squeezed into a ~275px side came out at 0.26×
// while the horizontal ones sat near 0.81×, visibly crushing the uprights. A short
// tile repeated at a fixed scale keeps every link the same size on all four sides,
// whatever the card's size. The chain's period is 5px (measured by autocorrelation
// over all four edges, ~1% pixel mismatch at that shift), so TILE is a multiple of
// it: four links, landing on a whole 14px once scaled by 28/40.
//
// Run `npm run slice-arcana-border` after editing the source frame.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Raster } from "../../src/art/Raster.js";

const SOURCE = "assets/ui/decor/arcana-card-border.png";
const OUT_PREFIX = "assets/ui/decor/arcana-border-";
/** Frame thickness in the source art (the inset the old `mask-border … 40 / 28px` sliced at). */
const INSET = 40;
/** Along-run length of each edge tile: four links of the chain's 5px period. */
const TILE = 20;

/** One slice of the frame: the CSS layer name and the source rectangle it comes from. */
export class BorderRegion {
	constructor(name, x, y, width, height) {
		this.name = name;
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
	}

	/** The slice lifted out of `raster`. */
	cut(raster) {
		return raster.crop(this.x, this.y, this.width, this.height);
	}
}

/**
 * Where the eight frame slices sit in a framed source image: four corner squares of
 * `inset`, and one `tile`-long run taken from the middle of each side, far enough from
 * the corners to be clear of their notch.
 */
export class FrameGeometry {
	constructor(width, height, inset, tile) {
		if (inset <= 0) throw new Error(`inset must be positive, got ${inset}`);
		if (tile <= 0) throw new Error(`tile must be positive, got ${tile}`);
		if (inset * 2 >= width || inset * 2 >= height) {
			throw new Error(`inset ${inset} leaves no side runs in ${width}×${height}`);
		}
		if (tile > width - inset * 2 || tile > height - inset * 2) {
			throw new Error(`tile ${tile} is longer than a side run of ${width}×${height} at inset ${inset}`);
		}
		this.width = width;
		this.height = height;
		this.inset = inset;
		this.tile = tile;
	}

	static of(raster, inset, tile) {
		return new FrameGeometry(raster.width, raster.height, inset, tile);
	}

	/** Start of a centred `tile`-long run within a side of `span`, offset by the corner. */
	#runStart(span) {
		return this.inset + Math.floor((span - this.inset * 2 - this.tile) / 2);
	}

	regions() {
		const i = this.inset;
		const right = this.width - i;
		const bottom = this.height - i;
		const acrossX = this.#runStart(this.width);
		const acrossY = this.#runStart(this.height);
		return [
			new BorderRegion("tl", 0, 0, i, i),
			new BorderRegion("tr", right, 0, i, i),
			new BorderRegion("bl", 0, bottom, i, i),
			new BorderRegion("br", right, bottom, i, i),
			new BorderRegion("top", acrossX, 0, this.tile, i),
			new BorderRegion("bottom", acrossX, bottom, this.tile, i),
			new BorderRegion("left", 0, acrossY, i, this.tile),
			new BorderRegion("right", right, acrossY, i, this.tile),
		];
	}
}

function main() {
	const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
	const source = Raster.fromPng(readFileSync(join(root, SOURCE)));
	for (const region of FrameGeometry.of(source, INSET, TILE).regions()) {
		const out = `${OUT_PREFIX}${region.name}.png`;
		writeFileSync(join(root, out), region.cut(source).toPng());
		console.log(`${out}  ${region.width}×${region.height}`);
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
