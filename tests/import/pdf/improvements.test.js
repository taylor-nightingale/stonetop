import { describe, it, expect } from "vitest";
import { extractImprovements, improvementUuid } from "../../../scripts/import/pdf/improvements.js";

// Line/span builders mirroring extractArticle's output. A "marker" font span is the vector-layer □
// glyph (skipped in markdown but counted for the track); bold/italic come from the font name.
const span = (text, font = "ACaslonPro-Regular") => ({ font, size: 9, text });
const line = (text, spans) => ({ bbox: [0, 0, 100, 9], text, font: spans[0]?.font || "", size: 9, spans });
const bold = (t) => span(t, "ACaslonPro-Bold");
const box = (text) => span(text, "marker"); // the □ marker glyph

const heading = (text) => ({ type: "heading", level: "h3", line: { text } });
const para = (spans) => ({ type: "para", lines: [line(spans.map((s) => s.text).join(""), spans)] });
const list = (...items) => ({ type: "list", items });

// The Barrier Pass "Steading improvement" call-out, block-for-block as extractArticle yields it.
const improvementBox = [
	{ type: "boxstart" },
	heading(".  steading improvement  ."),
	{ type: "image" }, // a decorative image can sit inside the call-out (Tempest Lords) — skipped
	list([
		line("□ TRADE WITH", [box("□ "), bold("TRADE WITH")]),
		line("BARRIER PASS", [bold("BARRIER PASS")]),
		line("Surely it would benefit both", [span("Surely it would benefit both")]),
		line("communities were we to trade with each other!", [span("communities were we to trade with each other!")]),
	]),
	para([bold("Requires"), span(" getting them to talk to you, which requires 1 of these:")]),
	list(
		[line("□ Bringing them a valuable artifact of the Rime Lords", [box("□ "), span("Bringing them a valuable artifact of the Rime Lords")])],
		[line("□ A resident in good standing, vouching for you", [box("□ "), span("A resident in good standing, vouching for you")])],
	),
	para([span("And then, all of the following:")]),
	list(
		[line("□ Making a compelling offer", [box("□ "), span("Making a compelling offer")])],
		[line("□ Convincing at least two of the □ Honored Sages to accept", [box("□ "), span("Convincing at least two of the "), box("□ "), span("Honored Sages to accept")])],
		[line("□ Two successful trade missions, □ each in a different season", [box("□ "), span("Two successful trade missions, "), box("□ "), span("each in a different season")])],
	),
	para([span("When you "), span("mark all the requirements", "ACaslonPro-BoldItalic"), span(", increase Fortunes by 1.")]),
	{ type: "boxend" },
];

// A neighbouring "Trade opportunities" call-out — same box machinery, different heading. The
// detector must ignore it (only "Steading improvement" boxes become items).
const tradeOpportunitiesBox = [
	{ type: "boxstart" },
	heading(".  trade opportunities  ."),
	para([span("Barrier Pass might offer the following:")]),
	list([line("A fair exchange of goods", [span("A fair exchange of goods")])]),
	{ type: "boxend" },
];

const article = (...blocks) => ({ sections: [{ left: [{ blocks }], right: [] }] });

describe("extractImprovements", () => {
	const imps = extractImprovements(article(...improvementBox, ...tradeOpportunitiesBox));

	it("finds exactly the one Steading improvement box (ignores Trade opportunities)", () => {
		expect(imps).toHaveLength(1);
	});

	it("names and slugs the improvement from its bold title, title-cased", () => {
		expect(imps[0].name).toBe("Trade with Barrier Pass");
		expect(imps[0].slug).toBe("trade-with-barrier-pass");
	});

	it("uses the item slug as the choice-group namespace", () => {
		expect(imps[0].choices.slug).toBe("trade-with-barrier-pass");
	});

	// The name belongs to the document, and the sheets render it as the group's title. Repeating it
	// as a row title printed it twice on every panel that shows an improvement.
	it("makes the first list item a track-less, title-less entry holding only the flavor", () => {
		const first = imps[0].choices.list[0];
		expect(first).toEqual({ type: "entry", content: { title: null, text: "Surely it would benefit both communities were we to trade with each other!" } });
		expect(first.track).toBeUndefined();
	});

	it("still reports the improvement's name, which becomes the document's", () => {
		expect(imps[0].name).toBe("Trade with Barrier Pass");
	});

	it("keeps interstitial prose as plain entry rows in document order", () => {
		const texts = imps[0].choices.list.filter((r) => !r.track && !r.content.title).map((r) => r.content.text);
		expect(texts).toContain("**Requires** getting them to talk to you, which requires 1 of these:");
		expect(texts).toContain("And then, all of the following:");
	});

	it("makes each requirement a pick row, with track.max counted from its □ boxes", () => {
		const picks = imps[0].choices.list.filter((r) => r.track);
		expect(picks.map((p) => [p.content.text, p.track.max])).toEqual([
			["Bringing them a valuable artifact of the Rime Lords", 1],
			["A resident in good standing, vouching for you", 1],
			["Making a compelling offer", 1],
			["Convincing at least two of the Honored Sages to accept", 2],
			["Two successful trade missions, each in a different season", 2],
		]);
	});

	it("gives every pick row a deterministic slug", () => {
		const picks = imps[0].choices.list.filter((r) => r.track);
		expect(picks.every((p) => typeof p.slug === "string" && p.slug.length)).toBe(true);
	});

	it("keeps the bold-italic payoff as the trailing entry", () => {
		const last = imps[0].choices.list.at(-1);
		expect(last.content.text).toBe("When you **_mark all the requirements_**, increase Fortunes by 1.");
	});

	it("returns a reference to the title list item for in-place journal linking", () => {
		const firstList = improvementBox.find((b) => b.type === "list");
		expect(imps[0].titleItem).toBe(firstList.items[0]);
	});
});

describe("improvementUuid", () => {
	it("is deterministic and points at the steading-improvements pack", () => {
		const a = improvementUuid("trade-with-barrier-pass");
		expect(a).toBe(improvementUuid("trade-with-barrier-pass"));
		expect(a).toMatch(/^Compendium\.stonetop\.steading-improvements\.Item\.[A-Za-z0-9]{16}$/);
	});
});

// The Golden Sapling call-out (Golden Oak article): the book marks physical items INSIDE a
// requirement with ◇ weight diamonds ("Retrieve an ◇◇ acorn…"). The vector-layer glyphs arrive as
// "marker" font spans between the text cells; the parser must keep them (set tight, as printed)
// while still stripping leading bullet glyphs and counting only □ for the track.
const diamond = (t = "◇") => span(t, "marker");

const goldenSaplingBox = [
	{ type: "boxstart" },
	heading(".  steading improvement  ."),
	list(
		[
			line("□ GOLDEN SAPLING", [box("□ "), bold("GOLDEN SAPLING")]),
			line("Requires all of the following, in order:", [span("Requires all of the following, in order:")]),
		],
		[
			line("□ Retrieve an ◇ ◇ acorn from the", [box("□ "), span("Retrieve an "), diamond(), span(" "), diamond(), span(" acorn from the")]),
			line("boughs of the Golden Oak in late autumn", [span("boughs of the Golden Oak in late autumn")]),
		],
		[
			line("◇ Nurture and protect the □ □ □ sapling", [diamond("◇ "), span("Nurture and protect the "), box("□ "), box("□ "), box("□ "), span("sapling")]),
		],
	),
	{ type: "boxend" },
];

describe("extractImprovements — inline ◇ item-weight diamonds", () => {
	const imp = extractImprovements(article(...goldenSaplingBox))[0];

	it("keeps inline diamonds in the pick-row text, set tight as printed", () => {
		expect(imp.choices.list[1].content.text).toBe("Retrieve an ◇◇ acorn from the boughs of the Golden Oak in late autumn");
	});

	it("does not let diamonds change the row slug or the □-counted track", () => {
		expect(imp.choices.list[1].slug).toBe("retrieve-acorn");
		expect(imp.choices.list[1].track).toEqual({ max: 1 });
		expect(imp.choices.list[2].track).toEqual({ max: 3 });
	});

	it("still strips a LEADING diamond — a bullet glyph, not prose", () => {
		expect(imp.choices.list[2].content.text).toBe("Nurture and protect the sapling");
	});
});

// ── What the page layout glues together ──────────────────────────────────────
// These call-outs are set in narrow boxed columns, and the extractor sees the wrapped runs, not the
// breaks the reader sees. Both fixtures are the book's own text, line for line.

// Rhoillyg Orchard (Green Lords): two headers and the closing payoff run on inside the wrapped block
// of the requirement above them.
const orchardBox = [
	{ type: "boxstart" },
	heading(".  steading improvement  ."),
	list(
		[
			line("□ RHOILLYG ORCHARD", [box("□ "), bold("RHOILLYG ORCHARD")]),
			line("Requires both:", [span("Requires both:")]),
		],
		[line("□ A sack full of rhoillyg seeds", [box("□ "), span("A sack full of rhoillyg seeds")])],
		[
			line("□ An herbalist of considerable skill", [box("□ "), span("An herbalist of considerable skill")]),
			line("and patience", [span("and patience")]),
			line("And either of these, to germinate", [span("And either of these, to germinate")]),
			line("the seeds:", [span("the seeds:")]),
		],
		[line("□ A year or so of experimentation", [box("□ "), span("A year or so of experimentation")])],
		[
			line("□ Advice from a knowledgeable source", [box("□ "), span("Advice from a knowledgeable source")]),
			line("And then each of these:", [span("And then each of these:")]),
		],
		[
			line("□ Protecting the orchard through □", [box("□ "), span("Protecting the orchard through "), box("□")]),
			line("two more summers", [span("two more summers")]),
			line("When you mark all the requirements,", [span("When you mark all the requirements,")]),
			line("increase Fortunes by 1.", [span("increase Fortunes by 1.")]),
		],
	),
	{ type: "boxend" },
];

describe("extractImprovements — a header run onto the requirement above it", () => {
	const rows = extractImprovements(article(...orchardBox))[0].choices.list;

	it("ends the requirement where the requirement ends", () => {
		expect(rows[2].content.text).toBe("An herbalist of considerable skill and patience");
		expect(rows[2].track).toEqual({ max: 1 });
	});

	// Its own row, in the place the book prints it — which is what makes the two options below it a
	// "1 of" group rather than two more things the steading must do.
	it("gives the header its own untracked row", () => {
		expect(rows[3]).toEqual({ type: "entry", content: { title: null, text: "And either of these, to germinate the seeds:" } });
		expect(rows[5].content.text).toBe("Advice from a knowledgeable source");
		expect(rows[6]).toEqual({ type: "entry", content: { title: null, text: "And then each of these:" } });
	});

	it("splits the payoff prose off the last requirement, keeping its boxes", () => {
		expect(rows[7].content.text).toBe("Protecting the orchard through two more summers");
		expect(rows[7].track).toEqual({ max: 2 });
		expect(rows[8].content.text).toBe("When you mark all the requirements, increase Fortunes by 1.");
		expect(rows[8].track).toBeUndefined();
	});

	// "and patience" continues a sentence; only a tail that OPENS a header is cut.
	it("does not cut an ordinary continuation that happens to start with 'and'", () => {
		expect(rows.some(r => r.content.text === "and patience")).toBe(false);
	});
});

// Permanent Logging Camp (The Foothills): one requirement wrapped onto its own item, with three of
// the NEXT requirement's four checkboxes landing on that line.
const loggingBox = [
	{ type: "boxstart" },
	heading(".  steading improvement  ."),
	list([line("□ PERMANENT LOGGING CAMP", [box("□ "), bold("PERMANENT LOGGING CAMP")])]),
	para([span("Requires all of the following:")]),
	list(
		[line("□ An extra wagon (Value 3) and", [box("□ "), span("An extra wagon (Value 3) and")]),
		 line("extra horse or mule (Value 3) to", [span("extra horse or mule (Value 3) to")])],
		[line("□ haul timber to and from Stonetop □ □", [box("□ "), span("haul timber to and from Stonetop "), box("□ "), box("□")])],
		[line("□ Four seasons of operation", [box("□ "), span("Four seasons of operation")])],
	),
	{ type: "boxend" },
];

describe("extractImprovements — a requirement wrapped onto its own item", () => {
	const rows = extractImprovements(article(...loggingBox))[0].choices.list;

	it("reads it as one requirement, not two", () => {
		expect(rows.filter(r => r.track)).toHaveLength(2);
		expect(rows[2].content.text)
			.toBe("An extra wagon (Value 3) and extra horse or mule (Value 3) to haul timber to and from Stonetop");
	});

	// A continuation carries no marker of its own, so the boxes on its line are the next item's —
	// which is how "Four seasons of operation" gets its four back.
	it("hands the continuation's checkboxes to the requirement that follows", () => {
		expect(rows[2].track).toEqual({ max: 1 });
		expect(rows[3].track).toEqual({ max: 4 });
	});
});
