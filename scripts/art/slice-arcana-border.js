// Slices assets/ui/decor/arcana-card-border.png into the eight edge/corner PNGs the
// arcanum card's frame is masked with.
//
// Why the card can't just use the whole image: the frame is a 9-slice — notched
// corners that must not scale, straight runs that must stretch to the card's size.
// `mask-border` expresses that in one declaration, but Firefox implements neither
// `mask-border` nor `-webkit-mask-box-image`, so the mask is dropped there and the
// pseudo-element paints as a solid --st-decor block over the whole card. Eight plain
// `mask-image` layers say the same thing in CSS every engine supports, and this
// script cuts the layers the stylesheet expects.
//
// Run `npm run slice-arcana-border` after editing the source frame.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Raster } from "../../src/art/Raster.js";

const SOURCE = "assets/ui/decor/arcana-card-border.png";
const OUT_PREFIX = "assets/ui/decor/arcana-border-";
/** Matches the slice inset the frame was drawn with (the old `mask-border … 40 / 28px`). */
const INSET = 40;

/** One slice of a nine-slice frame: the CSS layer name and the source rectangle it comes from. */
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

/** The eight-region geometry of a nine-slice frame; the hollow centre is never cut. */
export class NineSlice {
	constructor(width, height, inset) {
		if (inset <= 0) throw new Error(`inset must be positive, got ${inset}`);
		if (inset * 2 >= width || inset * 2 >= height) {
			throw new Error(`inset ${inset} leaves no middle band in ${width}×${height}`);
		}
		this.width = width;
		this.height = height;
		this.inset = inset;
	}

	static of(raster, inset) {
		return new NineSlice(raster.width, raster.height, inset);
	}

	regions() {
		const i = this.inset;
		const midW = this.width - i * 2;
		const midH = this.height - i * 2;
		const right = this.width - i;
		const bottom = this.height - i;
		return [
			new BorderRegion("tl", 0, 0, i, i),
			new BorderRegion("tr", right, 0, i, i),
			new BorderRegion("bl", 0, bottom, i, i),
			new BorderRegion("br", right, bottom, i, i),
			new BorderRegion("top", i, 0, midW, i),
			new BorderRegion("bottom", i, bottom, midW, i),
			new BorderRegion("left", 0, i, i, midH),
			new BorderRegion("right", right, i, i, midH),
		];
	}
}

function main() {
	const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
	const source = Raster.fromPng(readFileSync(join(root, SOURCE)));
	for (const region of NineSlice.of(source, INSET).regions()) {
		const out = `${OUT_PREFIX}${region.name}.png`;
		writeFileSync(join(root, out), region.cut(source).toPng());
		console.log(`${out}  ${region.width}×${region.height}`);
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
