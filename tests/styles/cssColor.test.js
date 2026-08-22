import { describe, it, expect } from "vitest";
import { CssColor } from "./cssColor.js";

const rgb = value => {
	const c = CssColor.parse(value);
	return c && [c.r, c.g, c.b];
};
const rgbOf = c => [c.r, c.g, c.b];

describe("CssColor.parse", () => {
	it("reads six-digit hex", () => {
		expect(rgb("#c9c7b8")).toEqual([201, 199, 184]);
		expect(rgb("#000000")).toEqual([0, 0, 0]);
	});

	it("reads three-digit hex by doubling each channel", () => {
		expect(rgb("#fff")).toEqual([255, 255, 255]);
		expect(rgb("#a00")).toEqual([170, 0, 0]);
	});

	it("is case-insensitive", () => {
		expect(rgb("#C9C7B8")).toEqual([201, 199, 184]);
	});

	it("reads the space-separated hsl() the themes are written in", () => {
		expect(rgb("hsl(0deg 0% 100%)")).toEqual([255, 255, 255]);
		expect(rgb("hsl(0deg 0% 0%)")).toEqual([0, 0, 0]);
		expect(rgb("hsl(0deg 100% 50%)")).toEqual([255, 0, 0]);
		expect(rgb("hsl(120deg 100% 50%)")).toEqual([0, 255, 0]);
		expect(rgb("hsl(240deg 100% 50%)")).toEqual([0, 0, 255]);
	});

	it("handles a fully desaturated hsl", () => {
		expect(rgb("hsl(30deg 0% 50%)")).toEqual([128, 128, 128]);
	});

	it("reads the named colours the themes use", () => {
		expect(rgb("slategrey")).toEqual([112, 128, 144]);
		expect(rgb("lightslategrey")).toEqual([119, 136, 153]);
		expect(rgb("white")).toEqual([255, 255, 255]);
	});

	// Theme declarations carry trailing comments explaining a chosen value.
	it("looks past whitespace, a trailing semicolon and a comment", () => {
		expect(rgb("  #fff ; ")).toEqual([255, 255, 255]);
		expect(rgb("hsl(32deg 88% 33%);  /* darkened to clear AA */")).toEqual(rgb("hsl(32deg 88% 33%)"));
	});

	// getComputedStyle always reports colours this way, so the render probe depends on it.
	describe("computed rgb()", () => {
		it("reads comma and space separated rgb()", () => {
			expect(rgb("rgb(26, 26, 26)")).toEqual([26, 26, 26]);
			expect(rgb("rgb(1 2 3)")).toEqual([1, 2, 3]);
		});

		it("reads rgba() and keeps the alpha", () => {
			const c = CssColor.parse("rgba(0, 0, 0, 0.5)");
			expect([c.r, c.g, c.b]).toEqual([0, 0, 0]);
			expect(c.alpha).toBe(0.5);
		});

		it("defaults alpha to opaque", () => {
			expect(CssColor.parse("rgb(1, 2, 3)").alpha).toBe(1);
			expect(CssColor.parse("#fff").alpha).toBe(1);
		});

		it("rounds fractional channels", () => {
			expect(rgb("rgb(26.6, 25.4, 24.5)")).toEqual([27, 25, 25]);
		});
	});

	// color-mix() is how every derived token is written, and this is how Chrome reports the result.
	describe("color(srgb …)", () => {
		it("reads 0-1 channels as 0-255", () => {
			expect(rgb("color(srgb 1 0.5 0)")).toEqual([255, 128, 0]);
			expect(rgb("color(srgb 0 0 0)")).toEqual([0, 0, 0]);
		});

		it("keeps the slash alpha", () => {
			expect(CssColor.parse("color(srgb 1 0.992157 0.972549 / 0.7)").alpha).toBe(0.7);
			expect(rgb("color(srgb 1 0.992157 0.972549 / 0.7)")).toEqual([255, 253, 248]);
		});

		it("defaults to opaque without an alpha", () => {
			expect(CssColor.parse("color(srgb 0.1 0.2 0.3)").alpha).toBe(1);
		});
	});

	describe("compositing", () => {
		it("blends a translucent colour over a backdrop", () => {
			const half = CssColor.parse("rgba(0, 0, 0, 0.5)");
			expect(rgbOf(half.over(CssColor.parse("#fff")))).toEqual([128, 128, 128]);
		});

		it("returns an opaque colour unchanged", () => {
			const solid = CssColor.parse("rgb(10, 20, 30)");
			expect(rgbOf(solid.over(CssColor.parse("#fff")))).toEqual([10, 20, 30]);
		});

		// A wash derived from ink is meant to read against the paper behind it.
		it("makes a wash measurable against what is behind it", () => {
			const wash = CssColor.parse("rgba(255, 255, 255, 0.08)");
			const onDark = wash.over(CssColor.parse("#251f1d"));
            expect(onDark.relativeLuminance).toBeGreaterThan(CssColor.parse("#251f1d").relativeLuminance);
		});
	});

	it("reports null for notations it cannot read, rather than guessing", () => {
		for (const value of ["color-mix(in srgb, var(--st-ink) 4%, transparent)", "var(--st-ink)",
			"transparent", "invert(1)", "", null, undefined]) {
			expect(CssColor.parse(value)).toBeNull();
		}
	});
});

describe("CssColor contrast", () => {
	const white = CssColor.parse("#fff");
	const black = CssColor.parse("#000");

	it("gives 21 for black on white — the maximum", () => {
		expect(white.contrastWith(black)).toBeCloseTo(21, 5);
	});

	it("is symmetric", () => {
		expect(black.contrastWith(white)).toBeCloseTo(white.contrastWith(black), 10);
	});

	it("gives 1 for a colour against itself", () => {
		expect(white.contrastWith(white)).toBeCloseTo(1, 10);
	});

	// The WCAG worked example: #777 on white is just under 4.5:1.
	it("matches known WCAG values", () => {
		expect(CssColor.parse("#777777").contrastWith(white)).toBeCloseTo(4.48, 1);
		expect(white.relativeLuminance).toBeCloseTo(1, 5);
		expect(black.relativeLuminance).toBeCloseTo(0, 5);
	});
});
