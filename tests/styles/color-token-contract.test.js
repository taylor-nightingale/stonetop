import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";
import { ColorLiteralScan } from "./cssColorLiterals.js";

// The theming contract (helper/theming-plan.md): structural CSS names a ROLE — var(--st-ink) — and
// only a theme file says what colour that role is. That separation is the whole feature: it is what
// lets a dark theme exist at all, and what lets a module ship one by setting ~25 values instead of
// overriding rules one at a time.
//
// These are the rules that keep it true. The stylesheet reached this state from 278 colour literals
// in 80 distinct values, and the duplication was not deliberate — four interchangeable border greys
// (#c9c7b8 #bbb #ccc #ddd), four washes spanning 3-6% black. That is the drift a vocabulary prevents,
// and one un-tokenized `#555` is how it starts again.

const root = process.cwd();
const STYLES_DIR = path.join(root, "styles");
const THEMES_DIR = path.join(STYLES_DIR, "themes");
const TOKENS = path.join(STYLES_DIR, "tokens.css");

const read = file => readFileSync(file, "utf8");
// Theme files document the module contract with a worked example, so anything that reads selectors
// or token names out of CSS has to look past the prose.
const readCode = file => read(file).replace(/\/\*[\s\S]*?\*\//g, "");

const cssFilesIn = dir =>
	existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith(".css")).sort().map(f => path.join(dir, f)) : [];

// readdirSync is not recursive, so styles/themes/ is excluded by living one level down — themes are
// identified by location, not by a naming convention someone has to remember.
const structuralStylesheets = () => cssFilesIn(STYLES_DIR);

// styles/themes/ holds two kinds of file. palette.css repaints Foundry's 22 base colour ramps and is
// the one place a colour is actually named; the parchment-*.css files only say which ramp each
// Stonetop role reads. Separating them is what lets both themes share one set of colours.
const PALETTE = path.join(THEMES_DIR, "palette.css");
const themeStylesheets = () => cssFilesIn(THEMES_DIR);
const roleStylesheets = () => themeStylesheets().filter(f => f !== PALETTE);

const tokensDefinedIn = file => new Set([...readCode(file).matchAll(/(--st-[\w-]+)\s*:/g)].map(m => m[1]));
const tokensUsedIn = file => new Set([...readCode(file).matchAll(/var\((--st-[\w-]+)/g)].map(m => m[1]));

describe("colour token contract", () => {
	it("names no colour outside a theme file", () => {
		const offenders = structuralStylesheets().flatMap(file =>
			ColorLiteralScan.fromCss(read(file)).all.map(l => `${path.basename(file)}:${l.line}  ${l.value}`));

		expect(offenders).toEqual([]);
	});

	it("keeps theme files out of the structural scan", () => {
		expect(structuralStylesheets().some(f => f.startsWith(THEMES_DIR))).toBe(false);
	});

	it("ships every theme, and the derived tokens, as system styles", () => {
		const { styles } = JSON.parse(read(path.join(root, "system.json")));

		for (const theme of themeStylesheets()) {
			expect(styles).toContain(`styles/themes/${path.basename(theme)}`);
		}
		expect(styles).toContain("styles/tokens.css");
		expect(styles).toContain("styles/stonetop.css");
	});

	// The derived layer exists so a theme states a colour once. If it starts naming colours itself,
	// themes have to restate them and the dark theme drifts from the light one.
	it("derives every wash from a base token rather than naming one", () => {
		expect(ColorLiteralScan.fromCss(read(TOKENS)).all).toEqual([]);
		expect(readCode(TOKENS)).toMatch(/color-mix\(in srgb, var\(--st-/);
	});

	// This is what makes a second theme safe to write: whatever the light theme sets, every other
	// theme must set too, or that role silently falls back to the light value on a dark page.
	it("defines the same base tokens in every theme", () => {
		const themes = roleStylesheets();
		expect(themes.length).toBeGreaterThan(1);

		const [reference, ...others] = themes;
		const expected = [...tokensDefinedIn(reference)].sort();

		for (const theme of others) {
			expect({ theme: path.basename(theme), tokens: [...tokensDefinedIn(theme)].sort() })
				.toEqual({ theme: path.basename(theme), tokens: expected });
		}
	});

	// A var() pointing at a token no theme defines is a silently-unstyled rule.
	it("paints only with tokens the theme layer defines", () => {
		const defined = new Set([...roleStylesheets(), TOKENS].flatMap(f => [...tokensDefinedIn(f)]));

		const used = new Set([...structuralStylesheets().flatMap(f => [...tokensUsedIn(f)])]);

		expect([...used].filter(t => !defined.has(t)).sort()).toEqual([]);
	});

	it("derives only from tokens a theme actually defines", () => {
		const defined = new Set([...roleStylesheets(), TOKENS].flatMap(f => [...tokensDefinedIn(f)]));

		expect([...tokensUsedIn(TOKENS)].filter(t => !defined.has(t)).sort()).toEqual([]);
	});

	// Core's Color Scheme setting puts `theme-light`/`theme-dark` on <body>, and that is the whole
	// selection mechanism — there is no Stonetop attribute, applier or picker any more.
	it("keys each theme on the class core puts on the body", () => {
		const keyed = roleStylesheets()
			.flatMap(f => [...readCode(f).matchAll(/body\.(theme-light|theme-dark)\b/g)].map(m => m[1]));

		expect([...new Set(keyed)].sort()).toEqual(["theme-dark", "theme-light"]);
	});

	it("selects themes without JavaScript", () => {
		for (const file of themeStylesheets()) {
			expect(`${path.basename(file)}: ${/data-stonetop-theme/.test(read(file))}`)
				.toBe(`${path.basename(file)}: false`);
		}
	});

	// The bug this exists to prevent: the first attempt declared Foundry's variables on :root, which
	// looks tidy and does nothing. Cascade layers only arbitrate declarations targeting the SAME
	// element, and an element's own declaration always beats an inherited one — so core's
	// `body.theme-dark { --color-text-primary }` won on body and the whole override was inert.
	describe("where the palette is declared", () => {
		const rulesIn = file => [...readCode(file).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
			.map(([, selector, body]) => ({ selector: selector.replace(/\s+/g, " ").trim(), body }))
			.filter(r => r.selector && !r.selector.startsWith("@"));

		it("repaints the ramps on the elements core declares them on", () => {
			const declaring = rulesIn(PALETTE).filter(r => /--color-light-1\s*:/.test(r.body));

			expect(declaring.length).toBeGreaterThan(0);
			expect(declaring[0].selector).toMatch(/\bbody\b/);
			expect(declaring[0].selector).toMatch(/\.themed\b/);
		});

		it("declares no Foundry variable on :root, where it would only be inherited", () => {
			for (const file of [PALETTE, TOKENS]) {
				const onRoot = rulesIn(file)
					.filter(r => r.selector === ":root")
					.flatMap(r => [...r.body.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]))
					.filter(name => !name.startsWith("--st-"));

				expect(`${path.basename(file)}: ${onRoot.join(",")}`).toBe(`${path.basename(file)}: `);
			}
		});

		// 927 of core's declarations resolve back to these 22 names. Repainting them is the mechanism.
		it("covers the whole base palette", () => {
			const declared = new Set([...readCode(PALETTE).matchAll(/(--color-[\w-]+)\s*:/g)].map(m => m[1]));
			const required = [
				...[1, 2, 3, 4, 5, 6].map(n => `--color-light-${n}`),
				...[1, 2, 3, 4, 5, 6].map(n => `--color-dark-${n}`),
				"--color-cool-3", "--color-cool-4", "--color-cool-5",
				"--color-cool-5-25", "--color-cool-5-50", "--color-cool-5-75", "--color-cool-5-90",
				"--color-warm-1", "--color-warm-2", "--color-warm-3"
			];

			expect(required.filter(n => !declared.has(n))).toEqual([]);
		});
	});

	it("puts every theme in the system cascade layer, so a module can override it", () => {
		for (const file of [...themeStylesheets(), TOKENS, path.join(STYLES_DIR, "stonetop.css")]) {
			expect(`${path.basename(file)}: ${/@layer system\s*\{/.test(read(file))}`)
				.toBe(`${path.basename(file)}: true`);
		}
	});
});
