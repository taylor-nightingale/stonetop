import { describe, expect, it } from "vitest";
import { ChoiceGroup, ChoiceValues, EntryRow } from "../../../src/model/snapshot/character/ChoiceGroup.js";

// ── EntryRow — content/track/input ───────────────────────────────────────────

describe("ChoiceGroup — entry row without followers", () => {
	it("builds an EntryRow with type 'entry'", () => {
		const group = ChoiceGroup.fromPackData({
			slug: "ns",
			list: [{ type: "entry", slug: "my-row", content: { title: "T", text: "Hello" } }],
		});
		expect(group.list[0].type).toBe("entry");
	});

	it("entry row has empty followers array when no followers field", () => {
		const group = ChoiceGroup.fromPackData({
			slug: "ns",
			list: [{ type: "entry", slug: "my-row", content: { title: null, text: null } }],
		});
		expect(group.list[0].followers).toEqual([]);
	});

	it("entry row track starts all false", () => {
		const group = ChoiceGroup.fromPackData({
			slug: "ns",
			list: [{ type: "entry", slug: "tracked", content: {}, track: { max: 2 } }],
		});
		expect(group.list[0].track.checks).toEqual([false, false]);
	});

	it("entry row track reflects stored count", () => {
		const values = new ChoiceValues({ ns: { tracked: 1 } });
		const group = ChoiceGroup.fromPackData(
			{ slug: "ns", list: [{ type: "entry", slug: "tracked", content: {}, track: { max: 2 } }] },
			values,
		);
		expect(group.list[0].track.checks).toEqual([true, false]);
	});

	it("entry row has null track when no track field", () => {
		const group = ChoiceGroup.fromPackData({
			slug: "ns",
			list: [{ type: "entry", slug: "no-track", content: {} }],
		});
		expect(group.list[0].track).toBeNull();
	});
});

// ── EntryRow — followers resolution ──────────────────────────────────────────

describe("ChoiceGroup — entry row with followers", () => {
	const ENFYS_SNAPSHOT = { slug: "enfys", name: "Enfys" };

	it("resolves follower slugs to snapshots from followersBySlug", () => {
		const group = ChoiceGroup.fromPackData(
			{ slug: "ns", list: [{ type: "entry", slug: "enfys", content: {}, followers: ["enfys"], track: { max: 1 } }] },
			new ChoiceValues(),
			{ enfys: ENFYS_SNAPSHOT },
		);
		expect(group.list[0].followers).toEqual([ENFYS_SNAPSHOT]);
	});

	it("follower slug not in followersBySlug is omitted from followers array", () => {
		const group = ChoiceGroup.fromPackData(
			{ slug: "ns", list: [{ type: "entry", slug: "rook", content: {}, followers: ["rook"], track: { max: 1 } }] },
			new ChoiceValues(),
			{},
		);
		expect(group.list[0].followers).toEqual([]);
	});

	it("inlineDisplay is false by default", () => {
		const group = ChoiceGroup.fromPackData({
			slug: "ns",
			list: [{ type: "entry", slug: "enfys", content: {}, followers: ["enfys"] }],
		});
		expect(group.list[0].inlineDisplay).toBe(false);
	});

	it("inlineDisplay is carried from pack data", () => {
		const group = ChoiceGroup.fromPackData({
			slug: "ns",
			list: [{ type: "entry", slug: "enfys", content: {}, followers: ["enfys"], inlineDisplay: true }],
		});
		expect(group.list[0].inlineDisplay).toBe(true);
	});

	it("indent is false by default", () => {
		const group = ChoiceGroup.fromPackData({
			slug: "ns",
			list: [{ type: "entry", slug: "c1", content: { text: "Base consequence" }, track: { max: 1 } }],
		});
		expect(group.list[0].indent).toBe(false);
	});

	it("indent is carried from pack data", () => {
		const group = ChoiceGroup.fromPackData({
			slug: "ns",
			list: [{ type: "entry", slug: "c2", content: { text: "Escalation" }, track: { max: 1 }, indent: true }],
		});
		expect(group.list[0].indent).toBe(true);
	});
});

// ── Pick rows ─────────────────────────────────────────────────────────────────

describe("ChoiceGroup — pick rows", () => {
	it("builds a ChoiceRow (radio) for a type:'pick' row with pickCount 1", () => {
		const group = ChoiceGroup.fromPackData({
			slug: "ns",
			list: [{ type: "pick", pickCount: 1, options: [{ slug: "a", content: { title: "A" } }, { slug: "b", content: { title: "B" } }] }],
		});
		const row = group.list[0];
		expect(row.type).toBe("choice");
		expect(row.radio).toBe(true);
		expect(row.siblingSlugsCsv).toBe("a,b");
		expect(row.options).toHaveLength(2);
	});

	it("builds a checkbox ChoiceRow for pickCount > 1", () => {
		const group = ChoiceGroup.fromPackData({
			slug: "ns",
			list: [{ type: "pick", pickCount: 2, options: [{ slug: "a" }, { slug: "b" }] }],
		});
		expect(group.list[0].radio).toBe(false);
		expect(group.list[0].siblingSlugsCsv).toBeNull();
	});

	it("routes a type-less row with an options array to a pick (groupDefs shape)", () => {
		const group = ChoiceGroup.fromPackData({
			slug: "ns",
			list: [{ options: [{ slug: "a" }, { slug: "b" }] }],
		});
		expect(group.list[0].type).toBe("choice");
		expect(group.list[0].radio).toBe(true);
	});
});

// ── Backward compatibility ────────────────────────────────────────────────────

describe("ChoiceGroup — entry rows (current shape; legacy is handled by migrateChoices)", () => {
	it("renders entry rows with type 'entry'", () => {
		const group = ChoiceGroup.fromPackData({
			slug: "ns",
			list: [{ type: "entry", slug: "my-row", content: { text: "a heading" } }],
		});
		expect(group.list[0].type).toBe("entry");
		expect(group.list[0].content.text.raw).toBe("a heading");
		expect(group.list[0].followers).toEqual([]);
	});

	it("resolves followers from followers[] via followersBySlug", () => {
		const SNAP = { slug: "enfys", name: "Enfys" };
		const group = ChoiceGroup.fromPackData(
			{ slug: "ns", list: [{ type: "entry", slug: "enfys", followers: ["enfys"], track: { max: 1 } }] },
			new ChoiceValues(),
			{ enfys: SNAP },
		);
		expect(group.list[0].followers).toEqual([SNAP]);
	});

	it("exposes the input type and the renamed content fields", () => {
		const group = ChoiceGroup.fromPackData({
			slug: "ns",
			list: [{ type: "entry", slug: "cost", content: { subtitle: "S", subtitleNote: "(p1)", titleNote: "(p2)" }, input: { type: "inline" } }],
		});
		const row = group.list[0];
		expect(row.content.subtitle.raw).toBe("S");
		expect(row.content.subtitleNote.raw).toBe("(p1)");
		expect(row.content.titleNote.raw).toBe("(p2)");
		expect(row.input.type).toBe("inline");
	});
});

// Drives a choice group's content text from raw pack data through the single enrichRichTextTree pass
// (the same pass the character/arcanum/steading sheets run) and proves a markdown @UUID link comes
// out as a real anchor. Only the Foundry enrichHTML boundary is mocked.
describe("ChoiceGroup — rich-text enrichment (integration)", () => {
	it("enriches content.{title,text} @UUID/markdown through the one pass", async () => {
		const { enrichRichTextTree } = await import("../../../src/utils/enrichRichText.js");
		const group = ChoiceGroup.fromPackData({
			slug: "ns",
			list: [{ type: "entry", slug: "row", content: {
				title: "**Choose**",
				text:  "see @UUID[JournalEntry.x]{the Barrow}",
			} }],
		});
		const content = group.list[0].content;
		expect(content.text.raw).toContain("@UUID");   // stored as RichText, not enriched yet

		const orig = foundry.applications.ux.TextEditor.implementation.enrichHTML;
		foundry.applications.ux.TextEditor.implementation.enrichHTML =
			async html => html.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '<a class="content-link">$1</a>');
		try {
			await enrichRichTextTree(group, {});
		} finally {
			foundry.applications.ux.TextEditor.implementation.enrichHTML = orig;
		}

		expect(content.title.render()).toContain("<strong>Choose</strong>");
		expect(content.text.render()).toContain('<a class="content-link">the Barrow</a>');
	});
});
