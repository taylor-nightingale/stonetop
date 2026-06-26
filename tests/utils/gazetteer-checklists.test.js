import { describe, expect, it } from "vitest";
import { sectionHtml } from "../../scripts/local/shared/gazetteer.mjs";

// sectionHtml turns parsed-gazetteer lines into journal HTML. These guard the
// check-off list detection: a requirement/option lead-in turns the following
// bullets into checkbox items (class="check-bullet"), with sub-options nested,
// while descriptive and example lists keep the default spiral.
const html = (...lines) => sectionHtml(lines);

describe("sectionHtml check-off lists", () => {
	it("marks a list under a requirement lead-in as a check-off list", () => {
		const out = html("Requires all of the following:", "", "- A crew", "- A carpenter");
		expect(out).toContain('<li class="check-bullet">A crew</li>');
		expect(out).toContain('<li class="check-bullet">A carpenter</li>');
	});

	it("leaves a descriptive list as spiral bullets", () => {
		const out = html("The roads are grand and humbling:", "", "- Big slabs of basalt", "- Clean gutters");
		expect(out).toContain("<li>Big slabs of basalt</li>");
		expect(out).not.toContain("check-bullet");
	});

	it("nests short sub-options under a parent item ending in a colon", () => {
		const out = html(
			"To unlock it, you must:", "",
			"- Master each of these minor arcana:",
			"- Peacebond",
			"- Preserving Runes",
			"- Acquire a pavestone",
		);
		expect(out).toContain('<li class="check-bullet">Master each of these minor arcana:<ul>'
			+ '<li class="check-bullet">Peacebond</li>'
			+ '<li class="check-bullet">Preserving Runes</li></ul></li>');
		expect(out).toContain('<li class="check-bullet">Acquire a pavestone</li>');
	});

	it("does not treat an example/suggestion list as a check-off list", () => {
		// "must" appears early, but the operative final clause is a soft "involve".
		const out = html("You must decide how it's done. Perhaps it involves:", "", "- great risk", "- a sacrifice");
		expect(out).not.toContain("check-bullet");
	});

	it("ignores an incidental 'must' that isn't the list's lead-in clause", () => {
		const out = html("They must find the spirit. Good challenges include:", "", "- a guide", "- a long road");
		expect(out).not.toContain("check-bullet");
	});

	it("continues a check-off list split across consecutive lists by the PDF", () => {
		// A blank line between requirement fragments yields separate <ul>s; the run
		// should stay a check-off list throughout.
		const out = html("Requires all of the following:", "", "- Unlock the secret", "", "- Teach the runes");
		expect(out).toContain('<li class="check-bullet">Unlock the secret</li>');
		expect(out).toContain('<li class="check-bullet">Teach the runes</li>');
	});

	it("drops ellipsis-only bullets left by the PDF column-wrap", () => {
		const out = html("Roll and add…", "", "- …", "- +1 if tied by blood", "- +1 if you bear a possession");
		expect(out).not.toMatch(/<li[^>]*>…<\/li>/);
		expect(out).toContain("+1 if tied by blood");
	});

	it("keeps question items on their own marker, not the checkbox", () => {
		const out = html("Some questions:", "", "- Who goes there?", "- Why now?");
		expect(out).toContain('<li class="question-bullet">Who goes there?</li>');
		expect(out).not.toContain("check-bullet");
	});
});
