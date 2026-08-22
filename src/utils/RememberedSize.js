import { SheetSize } from "./SheetSize.js";

/**
 * A sheet size the user chose, together with the root font size they chose it at.
 *
 * Without that second half a remembered size is not interpretable: "900 wide" meant something
 * different when the reader's text was 16px than it does at 32px, and replaying the raw number at a
 * different setting reopens the sheet too small (or absurdly large) for its own contents. Recording
 * the scale lets the same INTENT — "about this much sheet" — be restored at any setting.
 *
 * `rootFontSizePx` is null for entries stored before it was recorded. Those are used as-is, which is
 * exactly the old behaviour, and they heal the first time the user resizes that sheet.
 */
export class RememberedSize {
	constructor(size, rootFontSizePx = null) {
		this.size = size;
		this.rootFontSizePx = rootFontSizePx;
	}

	/** Build from a stored/plain object, or null when it carries no valid size. */
	static fromObject(obj) {
		const size = SheetSize.fromObject(obj);
		if (!size) return null;
		const px = obj.rootFontSizePx;
		return new RememberedSize(size, typeof px === "number" && Number.isFinite(px) && px > 0 ? px : null);
	}

	/** True when we know the setting this size was chosen at, and so can convert it. */
	get isConvertible() {
		return this.rootFontSizePx !== null;
	}

	/** Plain object for persistence — the size's own fields plus the setting it was chosen at. */
	toObject() {
		return { ...this.size.toObject(), rootFontSizePx: this.rootFontSizePx };
	}
}
