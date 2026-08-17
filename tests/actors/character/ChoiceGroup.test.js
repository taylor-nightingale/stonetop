import { describe, expect, it } from "vitest";
import { ChoiceValues, EntryRow, EntryRowFollowers, EntryRowMoves } from "../../../src/model/snapshot/character/ChoiceGroup.js";
import { buildChoiceGroup } from "../../../src/model/snapshot/character/buildChoiceGroup.js";

// ── EntryRow — content/track/input ───────────────────────────────────────────

describe("ChoiceGroup — entry row without followers", () => {
	it("builds an EntryRow with type 'entry'", () => {
		const group = buildChoiceGroup({
			slug: "ns",
			list: [{ type: "entry", slug: "my-row", content: { title: "T", text: "Hello" } }],
		});
		expect(group.list[0].type).toBe("entry");
	});

	it("entry row has null followers when no followers field", () => {
		const group = buildChoiceGroup({
			slug: "ns",
			list: [{ type: "entry", slug: "my-row", content: { title: null, text: null } }],
		});
		expect(group.list[0].followers).toBeNull();
	});

	it("entry row track starts all false", () => {
		const group = buildChoiceGroup({
			slug: "ns",
			list: [{ type: "entry", slug: "tracked", content: {}, track: { max: 2 } }],
		});
		expect(group.list[0].track.checks).toEqual([false, false]);
	});

	it("entry row track reflects stored count", () => {
		const values = new ChoiceValues({ ns: { tracked: 1 } });
		const group = buildChoiceGroup(
			{ slug: "ns", list: [{ type: "entry", slug: "tracked", content: {}, track: { max: 2 } }] },
			values,
		);
		expect(group.list[0].track.checks).toEqual([true, false]);
	});

	it("entry row has null track when no track field", () => {
		const group = buildChoiceGroup({
			slug: "ns",
			list: [{ type: "entry", slug: "no-track", content: {} }],
		});
		expect(group.list[0].track).toBeNull();
	});
});

// ── EntryRow — follower REFERENCES ───────────────────────────────────────────
// buildChoiceGroup emits a pure reference (slugs + inlineDisplay); resolution to cards happens later
// against followers.bySlug (see CharacterFollowers.buildFollowersSnapshot). No card data lives here.

describe("ChoiceGroup — entry row with a follower reference", () => {
	it("emits an EntryRowFollowers carrying the link's slugs", () => {
		const group = buildChoiceGroup(
			{ slug: "ns", list: [{ type: "entry", slug: "enfys", content: {}, grants: [{ type: "follower", slug: "enfys", locations: ["tab"] }], track: { max: 1 } }] },
			new ChoiceValues(),
		);
		expect(group.list[0].followers).toBeInstanceOf(EntryRowFollowers);
		expect(group.list[0].followers.slugs).toEqual(["enfys"]);
	});

	it("followers is null when the row carries no follower link", () => {
		const group = buildChoiceGroup(
			{ slug: "ns", list: [{ type: "entry", slug: "rook", content: {}, track: { max: 1 } }] },
			new ChoiceValues(),
		);
		expect(group.list[0].followers).toBeNull();
	});

	it("inlineDisplay is false when the link omits it", () => {
		const group = buildChoiceGroup(
			{ slug: "ns", list: [{ type: "entry", slug: "enfys", content: {}, grants: [{ type: "follower", slug: "enfys", locations: ["tab"] }] }] },
			new ChoiceValues(),
		);
		expect(group.list[0].followers.inlineDisplay).toBe(false);
	});

	it("inlineDisplay is carried from the link", () => {
		const group = buildChoiceGroup(
			{ slug: "ns", list: [{ type: "entry", slug: "enfys", content: {}, grants: [{ type: "follower", slug: "enfys", locations: ["inline", "tab"] }] }] },
			new ChoiceValues(),
		);
		expect(group.list[0].followers.inlineDisplay).toBe(true);
	});

	it("emits an EntryRowMoves from an inline move grant (resolved against moves.bySlug at render)", () => {
		const group = buildChoiceGroup(
			{ slug: "ns", list: [{ type: "entry", slug: "darksome-vessel", content: {}, track: { max: 1 },
				grants: [{ type: "follower", slug: "hectumel", locations: ["inline"] }, { type: "move", slug: "darksome-vessel", locations: ["inline"] }] }] },
			new ChoiceValues(),
		);
		// A row can carry both a follower and a move grant.
		expect(group.list[0].moves).toBeInstanceOf(EntryRowMoves);
		expect(group.list[0].moves.slugs).toEqual(["darksome-vessel"]);
		expect(group.list[0].followers.slugs).toEqual(["hectumel"]);
	});

	it("moves is null for a non-inline (tab-only) move grant, or no move grant", () => {
		const noInline = buildChoiceGroup(
			{ slug: "ns", list: [{ type: "entry", slug: "x", content: {}, grants: [{ type: "move", slug: "m", locations: ["tab"] }] }] },
			new ChoiceValues(),
		);
		expect(noInline.list[0].moves).toBeNull();
		const none = buildChoiceGroup({ slug: "ns", list: [{ type: "entry", slug: "y", content: {} }] }, new ChoiceValues());
		expect(none.list[0].moves).toBeNull();
	});

	it("indent is false by default", () => {
		const group = buildChoiceGroup({
			slug: "ns",
			list: [{ type: "entry", slug: "c1", content: { text: "Base consequence" }, track: { max: 1 } }],
		});
		expect(group.list[0].indent).toBe(false);
	});

	it("indent is carried from pack data", () => {
		const group = buildChoiceGroup({
			slug: "ns",
			list: [{ type: "entry", slug: "c2", content: { text: "Escalation" }, track: { max: 1 }, indent: true }],
		});
		expect(group.list[0].indent).toBe(true);
	});
});

// ── Pick rows ─────────────────────────────────────────────────────────────────

describe("ChoiceGroup — pick rows", () => {
	it("builds a ChoiceRow (radio) for a type:'pick' row with pickCount 1", () => {
		const group = buildChoiceGroup({
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
		const group = buildChoiceGroup({
			slug: "ns",
			list: [{ type: "pick", pickCount: 2, options: [{ slug: "a" }, { slug: "b" }] }],
		});
		expect(group.list[0].radio).toBe(false);
		expect(group.list[0].siblingSlugsCsv).toBeNull();
	});

	it("routes a type-less row with an options array to a pick (groupDefs shape)", () => {
		const group = buildChoiceGroup({
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
		const group = buildChoiceGroup({
			slug: "ns",
			list: [{ type: "entry", slug: "my-row", content: { text: "a heading" } }],
		});
		expect(group.list[0].type).toBe("entry");
		expect(group.list[0].content.text.raw).toBe("a heading");
		expect(group.list[0].followers).toBeNull();
	});

	it("emits a follower reference (slugs + inlineDisplay) from the grouped link", () => {
		const group = buildChoiceGroup(
			{ slug: "ns", list: [{ type: "entry", slug: "enfys", grants: [{ type: "follower", slug: "enfys", locations: ["inline", "tab"] }], track: { max: 1 } }] },
			new ChoiceValues(),
		);
		expect(group.list[0].followers.slugs).toEqual(["enfys"]);
		expect(group.list[0].followers.inlineDisplay).toBe(true);
	});

	it("exposes the input type and the renamed content fields", () => {
		const group = buildChoiceGroup({
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
		const group = buildChoiceGroup({
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

// ── ChoiceValues#without ─────────────────────────────────────────────────────

describe("ChoiceValues#without", () => {
	it("drops the named group", () => {
		const values = new ChoiceValues({ ns: { opt: 1 }, other: { opt: 2 } });
		expect(values.without("ns").toRaw()).toEqual({ other: { opt: 2 } });
	});

	it("leaves the original untouched", () => {
		const values = new ChoiceValues({ ns: { opt: 1 } });
		values.without("ns");
		expect(values.toRaw()).toEqual({ ns: { opt: 1 } });
	});

	it("is a no-op for a group that was never set", () => {
		const values = new ChoiceValues({ ns: { opt: 1 } });
		expect(values.without("absent").toRaw()).toEqual({ ns: { opt: 1 } });
	});
});
