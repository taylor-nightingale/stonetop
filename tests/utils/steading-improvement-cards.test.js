import { describe, it, expect } from "vitest";
import { sectionHtml, renderSteadingImprovementCard } from "../../scripts/local/shared/gazetteer.mjs";
import { readImprovementCard, STEADING_IMPROVEMENT_DRAG_TYPE } from "../../module/journal/steading-improvement-cards.js";

// Decode the data-steading-improvement attribute the way the browser would, then
// JSON.parse it back into the structured definition.
function payloadFrom(html) {
	const m = html.match(/data-steading-improvement="([^"]*)"/);
	if (!m) return null;
	const json = m[1]
		.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
	return JSON.parse(json);
}

const DEF = {
	name: "ROADBUILDING",
	flavor: "A grand road.",
	sections: [{ heading: "Requires all of the following:", items: ["Unlock the runes", "*Pull Together* a crew"] }],
	effect: "When you mark all the requirements, you can repair the Roads.",
};

describe("renderSteadingImprovementCard", () => {
	it("builds a draggable card carrying the definition as escaped JSON", () => {
		const html = renderSteadingImprovementCard(DEF);
		expect(html).toContain('class="stonetop-journal-improvement"');
		expect(html).toContain('draggable="true"');
		expect(html).toContain('<span class="stonetop-journal-improvement-name">ROADBUILDING</span>');
		expect(html).toContain('<li class="check-bullet">Unlock the runes</li>');
		// Light markdown is processed into HTML for both body and payload.
		expect(html).toContain("<em>Pull Together</em>");

		const payload = payloadFrom(html);
		expect(payload.name).toBe("ROADBUILDING");
		expect(payload.sections[0].items).toEqual(["Unlock the runes", "<em>Pull Together</em> a crew"]);
		expect(payload.effect).toContain("repair the Roads");
	});
});

describe("sectionHtml steading-improvement swap", () => {
	const lines = [
		"Some lead-in prose about the place.",
		"",
		"**. steading improvement .**",
		"",
		"**ROADBUILDING** Requires all of the following:",
		"",
		"- Unlock the runes",
		"- Recruit a crew",
		"",
		"When you mark all the requirements, you can repair the Roads.",
		"",
		"Henceforth, the Roads can be extended.",
	];

	it("swaps the marker block for one card and drops the raw improvement prose", () => {
		const out = sectionHtml(lines, [DEF]);
		// The lead-in prose survives.
		expect(out).toContain("Some lead-in prose about the place.");
		// Exactly one card, built from the manifest (not the messy source bullets).
		expect((out.match(/stonetop-journal-improvement"/g) || []).length).toBe(1);
		expect(out).toContain('<span class="stonetop-journal-improvement-name">ROADBUILDING</span>');
		// No leftover marker text or raw requirement/effect prose.
		expect(out).not.toContain("steading improvement .");
		expect(out).not.toContain("Henceforth, the Roads can be extended.");
	});

	it("leaves the prose untouched when no manifest entry is queued", () => {
		const out = sectionHtml(lines, []);
		expect(out).not.toContain("stonetop-journal-improvement");
		expect(out).toContain("Henceforth, the Roads can be extended.");
	});

	it("resumes normal parsing for unrelated content after the effect", () => {
		const withTrailing = [...lines, "", "- An unrelated artifact bullet"];
		const out = sectionHtml(withTrailing, [DEF]);
		expect(out).toContain("An unrelated artifact bullet");
	});
});

describe("readImprovementCard", () => {
	it("parses a card element's definition, or returns null when malformed/missing", () => {
		const ok = { dataset: { steadingImprovement: JSON.stringify(DEF) } };
		expect(readImprovementCard(ok).name).toBe("ROADBUILDING");

		expect(readImprovementCard({ dataset: { steadingImprovement: "not json" } })).toBeNull();
		expect(readImprovementCard({ dataset: {} })).toBeNull();
		expect(readImprovementCard(null)).toBeNull();
	});

	it("exposes the drag payload type", () => {
		expect(STEADING_IMPROVEMENT_DRAG_TYPE).toBe("StonetopSteadingImprovement");
	});
});
