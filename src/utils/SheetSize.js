/**
 * A remembered window size for a sheet: an explicit { width, height } value object so we never pass
 * anonymous position bags between the mixin and its store. Both dimensions must be finite, positive
 * numbers — anything else is treated as "no valid size" (fromObject returns null).
 */
export class SheetSize {
	constructor(width, height) {
		this.width = width;
		this.height = height;
	}

	/** Build a SheetSize from a stored/plain object, or null when either dimension is missing/invalid. */
	static fromObject(obj) {
		if (!obj) return null;
		const { width, height } = obj;
		if (!SheetSize.#isValidDimension(width) || !SheetSize.#isValidDimension(height)) return null;
		return new SheetSize(width, height);
	}

	static #isValidDimension(n) {
		return typeof n === "number" && Number.isFinite(n) && n > 0;
	}

	/**
	 * The same size, shrunk to fit within `maxWidth`/`maxHeight`. A `with`-method: returns a new
	 * SheetSize rather than mutating, and returns this one when it already fits.
	 *
	 * Scaling a designed size by a large font setting can easily exceed the display — a window
	 * wider than the screen is worse than a cramped one, because its controls are unreachable.
	 * Non-finite or non-positive bounds are ignored rather than clamping to nothing.
	 */
	clampedTo(maxWidth, maxHeight) {
		const width = SheetSize.#atMost(this.width, maxWidth);
		const height = SheetSize.#atMost(this.height, maxHeight);
		if (width === this.width && height === this.height) return this;
		return new SheetSize(width, height);
	}

	static #atMost(value, bound) {
		return SheetSize.#isValidDimension(bound) ? Math.min(value, Math.round(bound)) : value;
	}

	/** Plain object for persistence. */
	toObject() {
		return { width: this.width, height: this.height };
	}
}
