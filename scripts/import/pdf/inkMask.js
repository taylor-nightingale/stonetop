import { decode8bit } from "./png.js";

/**
 * A rectangle of page pixels, at the resolution of the render it was measured on.
 *
 * Named rather than a bare `{x0,y0,x1,y1}` because a crop travels between a measurement pass and a
 * render pass, and the two disagree about units unless the thing carrying them says which it is.
 */
export class PixelRect {
	constructor(x0, y0, x1, y1) {
		this.x0 = x0;
		this.y0 = y0;
		this.x1 = x1;
		this.y1 = y1;
	}

	get width() {
		return this.x1 - this.x0 + 1;
	}

	get height() {
		return this.y1 - this.y0 + 1;
	}

	/** The same rect grown by `pad` pixels on every side, clipped to `bounds`. */
	padded(pad, bounds) {
		return new PixelRect(
			Math.max(bounds.x0, this.x0 - pad),
			Math.max(bounds.y0, this.y0 - pad),
			Math.min(bounds.x1, this.x1 + pad),
			Math.min(bounds.y1, this.y1 + pad),
		);
	}

	/** Rescaled from the resolution it was measured at to another. */
	scaled(factor) {
		return new PixelRect(
			Math.round(this.x0 * factor),
			Math.round(this.y0 * factor),
			Math.round(this.x1 * factor),
			Math.round(this.y1 * factor),
		);
	}
}

/**
 * A rendered page as ink-or-not, so a crop can be MEASURED off the page instead of hard-coded.
 *
 * A hard-coded rect is a number nobody can check: it is right for one printing of one book and
 * silently wrong for the next, and nothing fails loudly when it drifts. Asking the page where its
 * ink actually is survives a re-flow, and says what it found.
 *
 * Built from a rendered page: anything darker than `threshold` is ink. Thresholding rather than
 * asking for a 1-bit render, because `pdftoppm -png` quietly ignores `-mono` and hands back RGB —
 * a bit depth is not something to depend on when a luminance test costs nothing.
 */
export class InkMask {
	static fromPng(buf, { threshold = 128 } = {}) {
		const { width, height, channels, px } = decode8bit(buf);
		const ink = new Uint8Array(width * height);
		for (let i = 0; i < width * height; i++) {
			const p = i * channels;
			const lum = channels === 1 ? px[p] : Math.round(px[p] * 0.299 + px[p + 1] * 0.587 + px[p + 2] * 0.114);
			ink[i] = lum < threshold ? 1 : 0;
		}
		return new InkMask(width, height, ink);
	}

	/** @param {Uint8Array} ink one byte per pixel, 1 where the page is inked. */
	constructor(width, height, ink) {
		this.width = width;
		this.height = height;
		this._ink = ink;
	}

	/** The whole page, as a rect — what a padded crop is clipped against. */
	get bounds() {
		return new PixelRect(0, 0, this.width - 1, this.height - 1);
	}

	isInk(x, y) {
		return this._ink[y * this.width + x] === 1;
	}

	/** How much of one row, between two columns, is ink. */
	rowInk(y, x0, x1) {
		let ink = 0;
		for (let x = x0; x <= x1; x++) if (this.isInk(x, y)) ink++;
		return ink / (x1 - x0 + 1);
	}

	/** The leftmost and rightmost inked columns of one row, or null where it carries none. */
	rowInkExtent(y, x0, x1) {
		let first = null, last = null;
		for (let x = x0; x <= x1; x++) {
			if (!this.isInk(x, y)) continue;
			if (first === null) first = x;
			last = x;
		}
		return first === null ? null : [first, last];
	}

	/**
	 * Walking up from `fromY`, the first row whose ink reaches `minInk` and then the top of that
	 * unbroken run — the solid rule, band or bar nearest above a known landmark. Null where the
	 * search runs off the page without finding one.
	 */
	solidRunAbove(fromY, x0, x1, minInk) {
		let y = fromY;
		while (y >= 0 && this.rowInk(y, x0, x1) < minInk) y--;
		if (y < 0) return null;
		const bottom = y;
		while (y >= 0 && this.rowInk(y, x0, x1) >= minInk) y--;
		return { top: y + 1, bottom };
	}

	/**
	 * Walking up from `fromY`, the topmost inked row reached before `gap` consecutive blank rows —
	 * or null where it never reaches any ink. The gap is what separates one printed object from the
	 * next, so it — not a remembered distance — is where the object ends.
	 */
	inkTopAbove(fromY, x0, x1, { gap, minInk = 0 }) {
		let blank = 0, top = null;
		for (let y = fromY; y >= 0 && blank < gap; y--) {
			if (this.rowInk(y, x0, x1) > minInk) { top = y; blank = 0; }
			else blank++;
		}
		return top;
	}
}
