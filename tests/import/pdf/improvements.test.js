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

	it("makes the first list item a track-less title entry with name + flavor", () => {
		const first = imps[0].choices.list[0];
		expect(first).toEqual({ type: "entry", content: { title: "Trade with Barrier Pass", text: "Surely it would benefit both communities were we to trade with each other!" } });
		expect(first.track).toBeUndefined();
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
