import { describe, it, expect } from "vitest";
import { ColorLiteral, ColorLiteralScan } from "./cssColorLiterals.js";

const scan = css => ColorLiteralScan.fromCss(css);
const values = css => scan(css).all.map(l => l.value);

describe("ColorLiteral", () => {
	it("normalizes case and whitespace so one colour counts once", () => {
		expect(new ColorLiteral("RGBA( 0, 0, 0, .5 )", 1).normalized).toBe("rgba(0,0,0,.5)");
		expect(new ColorLiteral("#FFF", 1).normalized).toBe("#fff");
	});

	it("keeps the literal exactly as authored", () => {
		expect(new ColorLiteral("#FFF", 9).value).toBe("#FFF");
		expect(new ColorLiteral("#FFF", 9).line).toBe(9);
	});
});

describe("ColorLiteralScan", () => {
	it("finds hex literals of every length", () => {
		expect(values("a{color:#fff;border:#ffff;background:#c9c7b8;outline:#c9c7b8ff}"))
			.toEqual(["#fff", "#ffff", "#c9c7b8", "#c9c7b8ff"]);
	});

	it("finds functional colours, including modern syntaxes", () => {
		expect(values("a{color:rgb(1,2,3);background:rgba(0,0,0,.06);border:hsl(30deg 20% 94%)}"))
			.toEqual(["rgb(1,2,3)", "rgba(0,0,0,.06)", "hsl(30deg 20% 94%)"]);
		expect(values("a{color:oklch(0.7 0.1 30)}")).toEqual(["oklch(0.7 0.1 30)"]);
	});

	it("finds named colours in value position", () => {
		expect(values("a{background:white;border-color:slategrey}")).toEqual(["white", "slategrey"]);
	});

	// The reason the named-colour regex carries lookarounds at all.
	it("does not read `white-space` as the colour white", () => {
		expect(values("a{white-space:nowrap}")).toEqual([]);
	});

	it("ignores property names that merely contain a colour word", () => {
		expect(values("a{border-color:var(--st-rule);accent-color:var(--st-accent)}")).toEqual([]);
	});

	it("ignores literals inside comments", () => {
		expect(values("/* was #1a1a1a, now tokenized */\na{color:var(--st-ink)}")).toEqual([]);
	});

	it("ignores url() payloads, which are paths and not colours", () => {
		expect(values("a{background:url(../assets/ui/decor/sheet-bg.png)}")).toEqual([]);
		expect(values(`a{background:url("#fff.png")}`)).toEqual([]);
	});

	// Blanking rather than deleting is what keeps this true.
	it("reports the line each literal was written on, past comments and urls", () => {
		const css = [
			"a{color:#111}",
			"/* a comment",
			"   spanning lines, mentioning #222 */",
			"b{background:url(x.png);border:#333}"
		].join("\n");
		expect(scan(css).all.map(l => [l.value, l.line])).toEqual([["#111", 1], ["#333", 4]]);
	});

	it("counts every occurrence but lists each value once", () => {
		const s = scan("a{color:#555}b{color:#555}c{color:#666}");
		expect(s.count).toBe(3);
		expect(s.distinctValues).toEqual(["#555", "#666"]);
		expect(s.countsByValue()).toEqual(new Map([["#555", 2], ["#666", 1]]));
	});

	it("treats differently-written forms of one colour as the same value", () => {
		expect(scan("a{color:#FFF}b{color:#fff}").distinctValues).toEqual(["#fff"]);
	});

	it("reports the literals an allow-list does not permit", () => {
		const s = scan("a{color:#555}b{color:#c0ffee}");
		expect(s.violations(["#555"]).map(l => l.value)).toEqual(["#c0ffee"]);
		expect(s.violations(["#555", "#c0ffee"])).toEqual([]);
	});

	it("finds nothing in a stylesheet that names only roles", () => {
		expect(scan("a{color:var(--st-ink);background:var(--st-paper);border:1px solid var(--st-rule)}").count)
			.toBe(0);
	});
});
