import { SheetSize } from "./SheetSize.js";

/**
 * How far Foundry's Font Size setting has moved the document root from the size this system's
 * layout was drawn against.
 *
 * The setting is `Game#configureUI` writing one px value from core's ten-step ladder
 * ([8, 10, 12, 14, 16, 18, 20, 24, 28, 32], default 16) onto the root element's font-size. Every
 * sheet dimension here is expressed in rem against that 16px default, so the CONTENTS of a sheet
 * follow the setting — but an ApplicationV2 `position` is plain px and does not. A window left at
 * its designed px therefore arrives too small for everything inside it at any step above the
 * default, which is the whole failure this class exists to prevent.
 */
export class RootFontScale {
	/** The root font size the sheets' rem dimensions were designed against — core's own default. */
	static BASELINE_PX = 16;

	#rootFontSizePx;

	/** @param {number} rootFontSizePx the document root's computed font size */
	constructor(rootFontSizePx) {
		this.#rootFontSizePx = rootFontSizePx;
	}

	/**
	 * Read the live root font size. Falls back to the baseline whenever the document cannot be
	 * measured or reports something nonsensical, so a sheet never opens at a garbage size.
	 */
	static fromDocument(doc = globalThis.document) {
		const root = doc?.documentElement;
		const measured = root ? parseFloat(globalThis.getComputedStyle?.(root)?.fontSize) : NaN;
		return new RootFontScale(Number.isFinite(measured) && measured > 0 ? measured : RootFontScale.BASELINE_PX);
	}

	/** Multiplier from designed px to the px that holds the same content at the reader's setting. */
	get factor() {
		return this.#rootFontSizePx / RootFontScale.BASELINE_PX;
	}

	/**
	 * The designed size, grown (or shrunk) to hold the same content at the reader's setting.
	 * @param {SheetSize} size
	 * @returns {SheetSize}
	 */
	scale(size) {
		return this.#by(size, this.factor);
	}

	/**
	 * A size the user chose at some earlier setting, restated at the current one — the same amount
	 * of sheet, not the same number of pixels. An entry that does not know its own setting is
	 * returned untouched, since there is nothing to convert from.
	 *
	 * @param {import("./RememberedSize.js").RememberedSize} remembered
	 * @returns {SheetSize}
	 */
	convert(remembered) {
		if (!remembered.isConvertible) return remembered.size;
		return this.#by(remembered.size, this.#rootFontSizePx / remembered.rootFontSizePx);
	}

	/** The root font size to record alongside a size the user chooses now. */
	get rootFontSizePx() {
		return this.#rootFontSizePx;
	}

	#by(size, factor) {
		return new SheetSize(Math.round(size.width * factor), Math.round(size.height * factor));
	}
}
