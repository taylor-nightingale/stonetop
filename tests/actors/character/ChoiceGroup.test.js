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
});

// ── Backward compatibility ────────────────────────────────────────────────────

describe("ChoiceGroup — backward compat with legacy row types", () => {
	it("heading rows are rendered as EntryRow with type 'entry'", () => {
		const group = ChoiceGroup.fromPackData({
			slug: "ns",
			list: [{ type: "heading", slug: "my-row", content: { title: null, text: "old heading" } }],
		});
		expect(group.list[0].type).toBe("entry");
		expect(group.list[0].followers).toEqual([]);
	});

	it("follower rows are rendered as EntryRow with type 'entry'", () => {
		const group = ChoiceGroup.fromPackData(
			{ slug: "ns", list: [{ type: "follower", slug: "enfys", title: "Enfys", track: { max: 1 } }] },
			new ChoiceValues(),
			{ enfys: { slug: "enfys", name: "Enfys" } },
		);
		expect(group.list[0].type).toBe("entry");
	});

	it("legacy follower row resolves follower from followersBySlug via its slug", () => {
		const SNAP = { slug: "enfys", name: "Enfys" };
		const group = ChoiceGroup.fromPackData(
			{ slug: "ns", list: [{ type: "follower", slug: "enfys", title: "Enfys", track: { max: 1 } }] },
			new ChoiceValues(),
			{ enfys: SNAP },
		);
		expect(group.list[0].followers).toEqual([SNAP]);
	});

	it("legacy follower row uses title as content.text", () => {
		const group = ChoiceGroup.fromPackData(
			{ slug: "ns", list: [{ type: "follower", slug: "enfys", title: "Enfys, your acolyte", track: { max: 1 } }] },
		);
		expect(group.list[0].content.text).toBe("Enfys, your acolyte");
	});
});
