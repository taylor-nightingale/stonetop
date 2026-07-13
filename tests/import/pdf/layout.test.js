import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { extractArticle } from "../../../scripts/import/pdf/layout.js";
import { renderHtml } from "../../../scripts/import/pdf/render-html.js";

const load = (name) =>
	JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.lines.json`, import.meta.url)), "utf8"));

// Extraction yields a renderer-agnostic document; the HTML preview/Foundry both run it through
// renderHtml. The golden assertions below check that data → HTML pipeline.
const article = (name, opts) => {
	const doc = extractArticle(load(name), opts);
	return { ...doc, body: renderHtml(doc) };
};

describe("extractArticle — an indented bullet does not absorb flush prose below it", () => {
	// An arcanum's "◇ , magical" tags line is indented; the description prose sits flush at the column
	// base just below it. The flush prose is a new paragraph, not a wrap of the indented bullet.
	const mk = (text, x, y, font = "ACaslonPro-Regular", size = 9) =>
		({ bbox: [x, y, x + 200, y + size], text, font, size, spans: [{ font, size, text }] });
	const page = { width: 1224, height: 792, lines: [
		mk("A test item", 80, 100, "Avara-Bold", 13),
		mk("◇ , magical", 98, 112),
		mk("Flush description prose that is its own paragraph.", 36, 124),
		mk("It continues at the base.", 36, 135),
	] };
	const blocks = extractArticle([page], { title: "T" }).sections[0].left.flatMap((c) => c.blocks);

	it("keeps the indented ◇ tags line as a one-item list (no prose merged in)", () => {
		const list = blocks.find((b) => b.type === "list");
		const text = list.items[0].map((l) => l.text).join(" ");
		expect(list.items).toHaveLength(1);
		expect(text).toContain("magical");
		expect(text).not.toContain("Flush description");
	});
	it("keeps the flush prose as a separate paragraph", () => {
		expect(blocks.some((b) => b.type === "para" && b.lines.some((l) => /Flush description/.test(l.text)))).toBe(true);
	});
});

describe("extractArticle — artifact tag lines with weight pips", () => {
	// A carried artifact's tag line leads with vector ◇ pips (injected as marker-font lines that
	// merge into the row) and puts roman text — a bare comma, or a count word like "each" — before
	// the first italic quality. It must classify as the artifact-tags line, not a list item.
	const mk = (text, x, y, font = "ACaslonPro-Regular", size = 9) =>
		({ bbox: [x, y, x + 150, y + size], text, font, size, spans: [{ font, size, text }] });
	const pip = (x, y) => ({ bbox: [x, y, x + 6.6, y + 8], text: "◇", font: "marker", size: 7, spans: [{ font: "marker", size: 7, text: "◇" }] });
	const tag = (x, y, lead, quals) =>
		({ bbox: [x, y, x + 100, y + 9], text: lead + quals, font: "ACaslonPro-Regular", size: 9, spans: [
			{ font: "ACaslonPro-Regular", size: 9, text: lead },
			{ font: "ACaslonPro-Italic", size: 9, text: quals },
		] });
	const page = (lines) => ({ width: 1224, height: 792, lines });
	const html = (lines) => renderHtml(extractArticle([page(lines)], { title: "T" }));

	it("renders a comma-led pip tag line as artifact-tags with tight pips", () => {
		const body = html([
			mk("A pot of gold", 58, 100, "Avara-Bold", 9),
			pip(49, 112), pip(56.5, 112), tag(66, 112, ", ", "magical"),
			mk("A small bronze cauldron, full of glittering", 36, 124),
		]);
		expect(body).toContain('<p class="artifact-tags">◇◇, <em>magical</em></p>');
	});

	it("renders a count-word pip tag line (\"◇ each, magical\") as artifact-tags", () => {
		const body = html([
			mk("Bloodshot amber", 58, 100, "Avara-Bold", 9),
			pip(49, 112), tag(58, 112, "each, ", "magical"),
			mk("Beads of amber, warm to the touch.", 36, 124),
		]);
		expect(body).toContain('<p class="artifact-tags">◇ each, <em>magical</em></p>');
	});

	it("keeps a pip-led treasure list item a list, not a tag line", () => {
		const body = html([
			mk("Various treasures", 58, 100, "Avara-Bold", 9),
			pip(49, 112), pip(56.5, 112), mk("A spinning wheel from your youth (how", 66, 112),
			mk("do you know?) that was lost in a fire", 66, 124),
		]);
		expect(body).not.toContain("artifact-tags");
	});
});

describe("extractArticle — The Crombil (prose + stat block)", () => {
	const r = article("crombil", { title: "The Crombil" });

	it("recovers the article title from the title-font line", () => {
		expect(r.bookTitle).toBe("The Crombil");
	});

	it("harvests the spread's printed page numbers as furniture (not body)", () => {
		expect(r.pageNumbers).toEqual([62, 63]);
		expect(r.body).not.toMatch(/<p>\s*62\s*<\/p>/);
		expect(r.body).not.toMatch(/>63</);
	});

	it("keeps the body verbatim and in reading order", () => {
		expect(r.body).toContain("A great scaly wurm, hundreds of feet long.");
		// Description (col 1) comes before the Hooks heading (col 2).
		expect(r.body.indexOf("scaly wurm")).toBeLessThan(r.body.indexOf("Hooks"));
	});

	it("renders section headings from the heading font", () => {
		expect(r.body).toContain("<h2>Hooks</h2>");
		expect(r.body).toContain("<h2>Signs &amp; portents</h2>");
	});

	it("renders the Hooks bullets as a list, de-hyphenating across item lines", () => {
		const hooks = r.body.slice(r.body.indexOf("<h2>Hooks</h2>"));
		expect(hooks).toMatch(/<h2>Hooks<\/h2>\s*<ul><li>/);
		expect(hooks).toContain("<li>The PCs wish to destroy some fell, indestructible artifact");
	});

	it("de-hyphenates words split across line ends", () => {
		expect(r.body).toContain("indestructible");
		expect(r.body).not.toContain("in-destructible");
		expect(r.body).toContain("Stonetop");
		expect(r.body).not.toContain("Stone-top");
	});

	it("merges inline emphasis without stray whitespace inside tags", () => {
		expect(r.body).not.toMatch(/<strong>\s/);
		expect(r.body).not.toMatch(/\s<\/strong>/);
	});

	it("decodes typographic entities (curly apostrophes, ellipses)", () => {
		expect(r.body).toContain("That’s for you to decide. Maybe…");
		expect(r.body).not.toContain("&#x");
	});
});

describe("extractArticle — Aratis (4-column prose)", () => {
	const r = article("aratis", { title: "Aratis, the Lawkeeper" });

	it("orders all four columns L→R as one flow", () => {
		const order = ["Themes", "Questions", "Hooks", "Shrines &amp; temples", "Judges"]
			.map((h) => r.body.indexOf(`<h2>${h}</h2>`));
		expect(order.every((i) => i >= 0)).toBe(true);
		// Col 2 (Questions) before col 3 (Shrines) before col 4 (Judges).
		expect(r.body.indexOf("Questions")).toBeLessThan(r.body.indexOf("Shrines"));
		expect(r.body.indexOf("Shrines")).toBeLessThan(r.body.indexOf("Judges"));
	});

	it("renders the Themes d12 table (header not mistaken for a section heading)", () => {
		expect(r.body).toContain("<table>");
		expect(r.body).not.toContain("<h2>1d12"); // the dice header is a table header, not <h2>
		expect(r.body).toMatch(/<td>1-2<\/td><td>[^<]+<\/td>/); // a roll/result row
	});

	it("renders the Questions prompts as a list", () => {
		const q = r.body.slice(r.body.indexOf("<h2>Questions</h2>"));
		expect(q).toMatch(/<h2>Questions<\/h2>[\s\S]*?<ul><li>/);
	});

	it("renders a (pick N) prompt's … options as own-line items, not bullets", () => {
		const i = r.body.indexOf("Perhaps it is");
		const seg = r.body.slice(i, i + 200);
		expect(seg).toContain("(pick 1)<br>… a hub of the community");
		expect(seg).not.toContain("<li>… a hub"); // not a bullet
	});

	it("treats an all-bold run-in line as an <h3> with its list intact", () => {
		expect(r.body).toContain("<h3>Various treasures</h3>");
		expect(r.body).toMatch(/<h3>Various treasures<\/h3>\s*<ul><li>A blanket woven/);
	});
});

describe("extractArticle — stat-block anchors vs. same-named headings (segmentColumn guard)", () => {
	// Book I's harm chapter has section headings that share names with stat-block fields ("Armor",
	// "Damage") and prose that starts with "HP". Pre-guard, looksStatStart fired on such a heading,
	// collectStatBlock immediately broke on it (endIdx === i), and segmentColumn spun on that row
	// until the heap died. These synthetic pages reproduce both trigger shapes; if this suite hangs,
	// the guard regressed.
	const L = (text, y, { font = "ACaslonPro-Regular", size = 9 } = {}) =>
		({ bbox: [36, y, 220, y + size], text, font, size, spans: [{ font, size, text }] });
	// Page 1: an "Armor" heading with "HP"-leading prose nearby — prose with no HP value must not
	// count as a stat-block anchor (pre-fix, isHpLine matched it and the heading row spun).
	const proseTrap = {
		width: 400, height: 600,
		lines: [
			L("Harm & recovery", 40, { font: "Avara-Bold", size: 18 }),
			L("Armor", 70, { font: "Avara-Bold", size: 12 }),
			L("It reduces harm. Some attacks ignore", 85),
			L("HP. Good for them! It still helps.", 100),
		],
	};
	// Page 2: a "Damage" heading directly above a real stat block. looksStatStart fires on the
	// heading itself (field-name match + true HP line in range); the collector consumes nothing, and
	// the guard must fall through to the heading branch, then collect the block off its real anchor.
	const headingTrap = {
		width: 400, height: 600,
		lines: [
			L("Damage", 200, { font: "Avara-Bold", size: 12 }),
			L("Iron hound", 215, { font: "Avara-Bold", size: 9 }),
			L("HP 12; Armor 3 (metal hide)", 230, { font: "ACaslonPro-Bold", size: 9 }),
			L("Instinct: to hunt", 245, { font: "ACaslonPro-Italic", size: 9 }),
		],
	};
	const doc = extractArticle([proseTrap, headingTrap], { title: "Harm & recovery" });
	const body = renderHtml(doc);
	const pageBlocks = (s) => [...s.left, ...s.right].flatMap((c) => c.blocks);

	it("terminates, keeping the field-named headings as headings", () => {
		expect(body).toContain("<h2>Armor</h2>");
		expect(body).toContain("<h2>Damage</h2>");
	});

	it("keeps HP-leading prose as prose (no digit after HP = no stat-block anchor)", () => {
		expect(pageBlocks(doc.sections[0]).filter((b) => b.type === "statblock")).toHaveLength(0);
		expect(body).toContain("HP. Good for them!");
	});

	it("still collects the real stat block from its name + valued HP line", () => {
		const sbs = pageBlocks(doc.sections[1]).filter((b) => b.type === "statblock");
		expect(sbs).toHaveLength(1);
		expect(sbs[0].lines.map((l) => l.text)).toContain("Iron hound");
		expect(sbs[0].lines.some((l) => /^HP 12/.test(l.text))).toBe(true);
	});
});

describe("extractArticle — non-numeric HP stat blocks (vortices, Servants of Daagon)", () => {
	// The Tempest Lords' elemental vortices print "HP varies" and Blackwater Lake's Servants of
	// Daagon "HP variable" — real stat blocks with no digit after HP. The digit-anchored guard
	// above must still accept them (they ship as wider-world-npcs actors with hp 0/0); only
	// valueless prose ("HP. Good for them!") stays excluded.
	const L = (text, y, { font = "ACaslonPro-Regular", size = 9 } = {}) =>
		({ bbox: [36, y, 220, y + size], text, font, size, spans: [{ font, size, text }] });
	const page = {
		width: 400, height: 600,
		lines: [
			L("Tempest Lords", 40, { font: "Avara-Bold", size: 18 }),
			L("Fire vortex", 70, { font: "Avara-Bold", size: 9 }),
			L("Solitary, size by HP, spirit, construct", 85, { font: "ACaslonPro-Italic", size: 9 }),
			L("HP varies; Armor by HP", 100, { font: "ACaslonPro-Bold", size: 9 }),
			L("Instinct: to consume", 115),
			L("Servants of Daagon", 200, { font: "Avara-Bold", size: 9 }),
			L("Terrifying, violent, wretched", 215, { font: "ACaslonPro-Italic", size: 9 }),
			L("HP variable; Armor variable", 230, { font: "ACaslonPro-Bold", size: 9 }),
			L("Instinct: to devour, then to steal", 245),
		],
	};
	const doc = extractArticle([page], { title: "Tempest Lords" });
	const sbs = [...doc.sections[0].left, ...doc.sections[0].right].flatMap((c) => c.blocks)
		.filter((b) => b.type === "statblock");

	it("anchors a stat block on 'HP varies' and 'HP variable'", () => {
		expect(sbs).toHaveLength(2);
		expect(sbs[0].lines.map((l) => l.text)).toContain("Fire vortex");
		expect(sbs[1].lines.map((l) => l.text)).toContain("Servants of Daagon");
	});

	it("renders them as stat-block asides", () => {
		const body = renderHtml(doc);
		expect(body).toMatch(/<div class="sb-name"><strong>Fire vortex<\/strong><\/div>/);
		expect(body).toMatch(/<div class="sb-name"><strong>Servants of Daagon<\/strong><\/div>/);
	});
});
