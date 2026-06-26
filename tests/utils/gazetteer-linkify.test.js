import { describe, expect, it } from "vitest";
import { buildNameIndex, linkifyByIndex } from "../../scripts/local/shared/gazetteer.mjs";

// linkifyByIndex turns plain-text mentions of named entries into @UUID content
// links. These guard the `{ bold }` mode the bestiary codex uses: the place name
// renders bold, and a lowercase leading "the" is left OUTSIDE the link (it's an
// article, not part of the proper name) while a capitalized "The" stays inside.

const index = buildNameIndex([
	{ slug: "the-stream", name: "the Stream", uuid: "Compendium.x.JournalEntry.S" },
	{ slug: "the-maw", name: "The Maw", uuid: "Compendium.x.JournalEntry.M" },
]);

describe("linkifyByIndex { bold: false }", () => {
	it("links the whole mention, article included, with no emphasis", () => {
		expect(linkifyByIndex("They haunt the Stream.", "self", index, { bold: false }))
			.toBe("They haunt @UUID[Compendium.x.JournalEntry.S]{the Stream}.");
	});
});

describe("linkifyByIndex default (bold)", () => {
	const bold = html => linkifyByIndex(html, "self", index);

	it("bolds the name and leaves a lowercase 'the' outside the link", () => {
		expect(bold("They haunt the Stream."))
			.toBe("They haunt the <strong>@UUID[Compendium.x.JournalEntry.S]{Stream}</strong>.");
	});

	it("keeps a capitalized 'The' inside the link (part of the name)", () => {
		expect(bold("Beyond The Maw lies darkness."))
			.toBe("Beyond <strong>@UUID[Compendium.x.JournalEntry.M]{The Maw}</strong> lies darkness.");
	});

	it("bolds a bare name with no article", () => {
		expect(bold("Down in Maw, things stir."))
			.toBe("Down in <strong>@UUID[Compendium.x.JournalEntry.M]{Maw}</strong>, things stir.");
	});

	it("links only the first mention per entry", () => {
		expect(bold("the Stream feeds the Stream"))
			.toBe("the <strong>@UUID[Compendium.x.JournalEntry.S]{Stream}</strong> feeds the Stream");
	});
});

// The creature index (hand-authored journals) is case-insensitive + plural so the
// real-animal names the book/overview lowercase and pluralize ("cave bears",
// "cougars") still link, resolving back to the singular record.
describe("buildNameIndex { caseInsensitive, plural }", () => {
	const ci = buildNameIndex(
		[{ slug: "cave-bear", name: "Cave Bear", uuid: "Compendium.x.JournalEntry.B" }],
		{ caseInsensitive: true, plural: true },
	);

	it("links a lowercase plural mention back to the singular entry", () => {
		expect(linkifyByIndex("Hunted by cave bears in winter.", "self", ci))
			.toBe("Hunted by <strong>@UUID[Compendium.x.JournalEntry.B]{cave bears}</strong> in winter.");
	});

	it("links a lowercase singular mention", () => {
		expect(linkifyByIndex("a lone cave bear", "self", ci))
			.toBe("a lone <strong>@UUID[Compendium.x.JournalEntry.B]{cave bear}</strong>");
	});

	it("stays case-sensitive and singular by default (no spurious lowercase match)", () => {
		const cs = buildNameIndex([{ slug: "cave-bear", name: "Cave Bear", uuid: "Compendium.x.JournalEntry.B" }]);
		expect(linkifyByIndex("Hunted by cave bears in winter.", "self", cs))
			.toBe("Hunted by cave bears in winter.");
	});
});
