import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { CssColor } from "./cssColor.js";

// A theme is only finished if you can read it. These are the ratios every theme has to clear, and
// they are as much documentation for a module author as a guard on our own two: the same numbers
// apply to whatever `parchment-dark` gets copied into.
//
// WCAG AA is 4.5:1 for body text and 3:1 for large text and non-text UI. `--st-ink-muted` is held to
// the lower bar on purpose — it is the disabled/faintest role, and holding it to 4.5 would make it
// indistinguishable from --st-ink-faint, which is the distinction it exists to draw.

const THEMES_DIR = path.resolve("styles/themes");
const PALETTE = path.join(THEMES_DIR, "palette.css");
const AA_TEXT = 4.5;
const AA_LARGE = 3.0;

// palette.css names the colours; the parchment-*.css files only say which ramp each role reads. So a
// role has to be resolved through the palette before it can be measured.
const declutter = file => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const paletteRamps = () => new Map(
	[...declutter(PALETTE).matchAll(/(--color-[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));

const themeFiles = () =>
	readdirSync(THEMES_DIR).filter(f => f.endsWith(".css") && f !== "palette.css").sort();

const tokensIn = file => {
	const ramps = paletteRamps();
	const resolve = value => {
		const ref = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value.trim());
		return ref ? (ramps.get(ref[1]) ?? value) : value;
	};

	const colors = new Map();
	for (const [, name, value] of declutter(path.join(THEMES_DIR, file)).matchAll(/(--st-[\w-]+)\s*:\s*([^;]+);/g)) {
		const color = CssColor.parse(resolve(value));
		if (color) colors.set(name, color);
	}
	return colors;
};

// Text roles that must be readable on both the page and a panel raised above it.
const TEXT_ON_PAPER = ["--st-ink", "--st-ink-soft", "--st-ink-faint", "--st-accent",
	"--st-danger", "--st-danger-strong", "--st-positive", "--st-warning", "--st-info", "--st-arcane"];

describe.each(themeFiles())("%s", file => {
	const tokens = tokensIn(file);
	const against = (token, surface) => {
		const ratio = tokens.get(token).contrastWith(tokens.get(surface));
		return { token, surface, ratio: Math.round(ratio * 100) / 100 };
	};
	const atLeast = (token, surface, min) => {
		const { ratio } = against(token, surface);
		expect(`${token} on ${surface}: ${ratio >= min ? "ok" : ratio}`).toBe(`${token} on ${surface}: ok`);
	};

	it("defines the surfaces everything else is measured against", () => {
		expect(tokens.get("--st-paper")).toBeTruthy();
		expect(tokens.get("--st-paper-raised")).toBeTruthy();
	});

	describe.each(["--st-paper", "--st-paper-raised"])("on %s", surface => {
		it.each(TEXT_ON_PAPER)("%s clears AA for body text", token => {
			atLeast(token, surface, AA_TEXT);
		});

		it("--st-ink-muted clears the large-text bar", () => {
			atLeast("--st-ink-muted", surface, AA_LARGE);
		});

		// Borders are non-text UI, so 3:1 is the applicable bar.
		it.each(["--st-rule-strong", "--st-highlight"])("%s clears the non-text bar", token => {
			atLeast(token, surface, AA_LARGE);
		});
	});

	// The chip is reversed against the page, so it is its own foreground/background pair.
	it("keeps chip ink readable on chip fill", () => {
		atLeast("--st-chip-ink", "--st-chip-fill", AA_TEXT);
	});

	// A theme whose ink is barely distinct from its paper has probably had one value edited without
	// the other; this catches that before it reaches a sheet.
	it("separates ink from paper decisively", () => {
		const { ratio } = against("--st-ink", "--st-paper");
		expect(ratio).toBeGreaterThan(10);
	});

	// The faintest-to-strongest ink roles have to actually differ, or the vocabulary is decorative.
	it("orders its ink roles from strongest to faintest", () => {
		const paper = tokens.get("--st-paper");
		const ratios = ["--st-ink", "--st-ink-soft", "--st-ink-faint", "--st-ink-muted"]
			.map(t => tokens.get(t).contrastWith(paper));

		expect(ratios).toEqual([...ratios].sort((a, b) => b - a));
	});
});
