import { describe, expect, it } from "vitest";
import { questionsToPairs } from "../../scripts/local/shared/gazetteer.mjs";

// questionsToPairs turns a rendered "Questions" section into qa prompt rows — one
// row per source bullet. These guard the rule that a bullet bundling several "?"
// sentences (an option menu, or a question + follow-up) stays a single prompt
// rather than being shattered on every "?", which is how the PDF reads.

describe("questionsToPairs", () => {
	it("keeps a multi-question bullet on one prompt", () => {
		const out = questionsToPairs(
			"<ul><li>Has anyone been down in the Cistern, that you know of? What did they supposedly find?</li></ul>");
		expect(out).toEqual([
			{ prompt: "Has anyone been down in the Cistern, that you know of? What did they supposedly find?", answer: "" },
		]);
	});

	it("keeps an option-menu bullet whole", () => {
		const out = questionsToPairs(
			"<ul><li>What's the opening like? A low stone wall? A crack in the earth? Or what?</li></ul>");
		expect(out).toHaveLength(1);
		expect(out[0].prompt).toBe("What's the opening like? A low stone wall? A crack in the earth? Or what?");
	});

	it("emits one prompt per bullet across separate lists", () => {
		const out = questionsToPairs(
			"<ul><li>Who goes there?</li></ul><ul><li>Why now?</li></ul>");
		expect(out.map(p => p.prompt)).toEqual(["Who goes there?", "Why now?"]);
	});

	it("renders a bold group lead-in as a **lead** prefix the qa sheet can split", () => {
		const out = questionsToPairs(
			"<ul><li><strong>According to the tales…</strong> How did Tor come to be? What's his origin story?</li></ul>");
		expect(out[0].prompt).toBe("**According to the tales…** How did Tor come to be? What's his origin story?");
	});

	it("keeps a non-question note bullet as its own row", () => {
		const out = questionsToPairs(
			"<ul><li>Which god is her kin?</li><li>Use the answers to help decide her true nature.</li></ul>");
		expect(out.map(p => p.prompt)).toEqual([
			"Which god is her kin?",
			"Use the answers to help decide her true nature.",
		]);
	});

	it("preserves a baked @UUID link inside a prompt", () => {
		const link = "@UUID[Compendium.x.y.JournalEntry.abc]{Stonetop}";
		const out = questionsToPairs(`<ul><li>How is it different from <strong>${link}</strong>'s?</li></ul>`);
		expect(out[0].prompt).toBe(`How is it different from **${link}**'s?`);
	});

	it("falls back to a single prompt when the section has no bullets", () => {
		const out = questionsToPairs("<p>What lies beyond the wall?</p>");
		expect(out).toEqual([{ prompt: "What lies beyond the wall?", answer: "" }]);
	});
});
