// Enough CSS colour parsing to check a theme is readable. Themes are authored in the handful of
// notations we actually use — hex, hsl() and a couple of named colours — so this deliberately does
// not try to be a general colour library; anything it cannot parse it reports as null, and the
// contrast test skips it rather than guessing.

const NAMED = {
	white: [255, 255, 255],
	black: [0, 0, 0],
	transparent: null,
	slategrey: [112, 128, 144],
	slategray: [112, 128, 144],
	lightslategrey: [119, 136, 153],
	lightslategray: [119, 136, 153]
};

/** An opaque sRGB colour, able to answer how legible it is against another. */
export class CssColor {
	constructor(r, g, b, alpha = 1) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.alpha = alpha;
	}

	/** @returns {CssColor|null} null for anything not in a notation themes use */
	static parse(value) {
		const text = String(value ?? "").replace(/\/\*[\s\S]*?\*\//g, "").trim().replace(/;$/, "").trim();

		const hex = CssColor.#parseHex(text);
		if (hex) return hex;

		const hsl = CssColor.#parseHsl(text);
		if (hsl) return hsl;

		const fn = CssColor.#parseRgb(text);
		if (fn) return fn;

		const predefined = CssColor.#parseColorFunction(text);
		if (predefined) return predefined;

		const named = NAMED[text.toLowerCase()];
		return named ? new CssColor(...named) : null;
	}

	static #parseHex(text) {
		const long = /^#([0-9a-f]{6})$/i.exec(text);
		if (long) return new CssColor(...[0, 2, 4].map(i => parseInt(long[1].slice(i, i + 2), 16)));

		const short = /^#([0-9a-f]{3})$/i.exec(text);
		if (short) return new CssColor(...[...short[1]].map(c => parseInt(c + c, 16)));

		return null;
	}

	// Space-separated hsl() only — the notation the themes are written in.
	static #parseHsl(text) {
		const m = /^hsla?\(\s*([\d.]+)deg\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i.exec(text);
		if (!m) return null;

		const [h, s, l] = [parseFloat(m[1]) / 360, parseFloat(m[2]) / 100, parseFloat(m[3]) / 100];
		if (s === 0) return new CssColor(...Array(3).fill(Math.round(l * 255)));

		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
		const channel = t => {
			const x = (t + 1) % 1;
			if (x < 1 / 6) return p + (q - p) * 6 * x;
			if (x < 1 / 2) return q;
			if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
			return p;
		};
		return new CssColor(...[h + 1 / 3, h, h - 1 / 3].map(t => Math.round(channel(t) * 255)));
	}

	// getComputedStyle always reports colours as rgb()/rgba(), so the render probe needs this even
	// though no theme file is authored in it. A translucent colour is composited over `over` — for a
	// probe that means "what does this actually look like against the surface behind it".
	static #parseRgb(text) {
		const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.%]+)\s*)?\)$/i.exec(text);
		if (!m) return null;

		const [r, g, b] = [m[1], m[2], m[3]].map(v => Math.round(parseFloat(v)));
		const colour = new CssColor(r, g, b);
		colour.alpha = m[4] === undefined ? 1 : (m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
		return colour;
	}

	// Chrome reports a resolved color-mix() as `color(srgb r g b / a)` with 0-1 channels, so anything
	// measuring a derived token has to read this form or the token is silently treated as absent.
	static #parseColorFunction(text) {
		const m = /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.%]+)\s*)?\)$/i.exec(text);
		if (!m) return null;

		const [r, g, b] = [m[1], m[2], m[3]].map(v => Math.round(parseFloat(v) * 255));
		const alpha = m[4] === undefined ? 1 : (m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
		return new CssColor(r, g, b, alpha);
	}

	/** This colour composited over an opaque backdrop. */
	over(backdrop) {
		const a = this.alpha ?? 1;
		if (a >= 1) return this;
		return new CssColor(
			Math.round(this.r * a + backdrop.r * (1 - a)),
			Math.round(this.g * a + backdrop.g * (1 - a)),
			Math.round(this.b * a + backdrop.b * (1 - a))
		);
	}

	/** WCAG relative luminance. */
	get relativeLuminance() {
		const [r, g, b] = [this.r, this.g, this.b].map(v => {
			const c = v / 255;
			return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	}

	/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
	contrastWith(other) {
		const [hi, lo] = [this.relativeLuminance, other.relativeLuminance].sort((a, b) => b - a);
		return (hi + 0.05) / (lo + 0.05);
	}
}
