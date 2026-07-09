import { describe, it, expect } from "vitest";
import { parseSettlement, segmentSettlement, Settlement } from "../../../scripts/import/pdf/settlement.js";

// Line builders mirroring extractArticle's settlement-block output: each line carries an x (bbox left),
// its text, and a first-span font. The book marks bold field/heading lines (ACaslonPro-Bold), swirl
// bullet items (the swirl dingbat font), and regular wrapped continuations.
const line = (text, x = 45.5, font = "ACaslonPro-Regular") => ({ bbox: [x, 0, x + 100, 9], text, font, size: 9, spans: [{ font, size: 9, text }] });
const field  = (t) => line(t, 45.5, "ACaslonPro-Bold");   // Size / Population / Prosperity / Resources / Defenses
const bullet = (t) => line(`   ${t}`, 44.4, "swirl");     // a swirl-bulleted list entry
const wrap   = (t) => line(t, 45.5, "ACaslonPro-Regular"); // a flush lower-case continuation of the entry above
const opt    = (t) => line(t, 59, "ACaslonPro-Regular");   // an "… partner" trade option / indented line

// A compact box exercising every quirk: a Prosperity field that carries a stray swirl bullet, a
// "Trade with…" heading with ellipsis options (one wrapping to a lower-case line), a Resources bullet
// whose continuation sits flush (the line that used to be dropped), and a negative Defenses rating.
const gordinish = [
	field("Size town (~700 to 800 souls)"),
	field("Population +2"),
	line("Prosperity +0", 44.4, "swirl"),      // rating line stamped with a bullet glyph — still a heading
	bullet("Trade with..."),
	opt("... Marshedge (wheat, flax,"),
	opt("textiles, herbs, glass)"),
	opt("... Stonetop (barley)"),
	field("Resources"),
	bullet("Mining (iron, copper, lead,"),
	wrap("tin, silver)"),                        // flush lower-case continuation → joins the bullet above
	bullet("Trades (smithing, tinkering)"),
	field("Defenses -1"),
	bullet("Maker-ramparts"),
	bullet("Unassailable position"),
];

describe("parseSettlement", () => {
	const s = parseSettlement(gordinish);

	it("returns a Settlement", () => {
		expect(s).toBeInstanceOf(Settlement);
	});

	it("reads the four ratings — size tier as a lower-case string, ±N as signed numbers", () => {
		expect(s.size).toBe("town");
		expect(s.population).toBe(2);
		expect(s.prosperity).toBe(0);
		expect(s.defenses).toBe(-1);
	});

	it("recognises a rating line even when it carries a stray swirl bullet glyph", () => {
		// If "Prosperity +0" were misread as a bullet, the Trade options beneath it would land nowhere.
		expect(s.resources).toContain("Trade with Marshedge (wheat, flax, textiles, herbs, glass)");
	});

	it("rejoins ellipsis trade options as 'Trade with …' and drops the bare heading", () => {
		expect(s.resources).toContain("Trade with Marshedge (wheat, flax, textiles, herbs, glass)");
		expect(s.resources).toContain("Trade with Stonetop (barley)");
		expect(s.resources).not.toContain("Trade with...");
	});

	it("joins a flush lower-case continuation onto the entry above (not dropped, not its own entry)", () => {
		expect(s.resources).toContain("Mining (iron, copper, lead, tin, silver)");
		expect(s.resources).not.toContain("tin, silver)");
	});

	it("buckets Prosperity/Resources lists into resources and the Defenses list into fortifications", () => {
		expect(s.resources).toEqual([
			"Trade with Marshedge (wheat, flax, textiles, herbs, glass)",
			"Trade with Stonetop (barley)",
			"Mining (iron, copper, lead, tin, silver)",
			"Trades (smithing, tinkering)",
		]);
		expect(s.fortifications).toEqual(["Maker-ramparts", "Unassailable position"]);
	});

	it("normalises book minus glyphs (en-dash / minus sign) to negative numbers", () => {
		const r = parseSettlement([field("Size hamlet"), field("Prosperity −1"), field("Defenses –0")]);
		expect(r.prosperity).toBe(-1);
		expect(r.defenses).toBe(0);
	});

	it("de-hyphenates a word split across a wrapped line", () => {
		const r = parseSettlement([field("Resources"), bullet("Bronze-smith-"), wrap("ing and weaving")]);
		expect(r.resources).toEqual(["Bronze-smithing and weaving"]);
	});

	it("keeps a plain 'Trade with …' entry that isn't an ellipsis heading", () => {
		const r = parseSettlement([field("Resources"), bullet("Trade with other bands")]);
		expect(r.resources).toEqual(["Trade with other bands"]);
	});

	it("ignores content before the first list heading and leaves empty lists empty", () => {
		const r = parseSettlement([field("Size village"), field("Population +0")]);
		expect(r.size).toBe("village");
		expect(r.resources).toEqual([]);
		expect(r.fortifications).toEqual([]);
	});
});

describe("segmentSettlement", () => {
	it("splits the block into flush field lines and indented bullet items with their wraps", () => {
		const segs = segmentSettlement([
			field("Resources"),
			bullet("Mining (iron,"),
			opt("copper)"),
			bullet("Timber"),
		]);
		expect(segs.map((s) => (s.field ? "field" : "items"))).toEqual(["field", "items"]);
		expect(segs[0].field[0].text).toBe("Resources");
		expect(segs[1].items).toHaveLength(2);                       // two bullets
		expect(segs[1].items[0].map((l) => l.text)).toEqual(["   Mining (iron,", "copper)"]); // bullet + its wrap
	});
});
