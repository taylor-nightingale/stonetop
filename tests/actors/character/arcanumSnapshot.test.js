import { describe, it, expect } from "vitest";
import {
	ArcanumSnapshotBuilder, ArcanumRenderContext, arcanumOutfitItemSnapshot,
} from "../../../src/model/snapshot/character/CharacterSnapshot.js";
import { MoveSnapshot, MoveSnapshotBuilder } from "../../../src/model/snapshot/character/MoveSnapshot.js";
import { ChoiceValues } from "../../../src/model/snapshot/character/ChoiceGroup.js";
import { Arcanum } from "../../../src/model/data/character/Arcanum.js";
import { Stats } from "../../../src/model/data/character/Stats.js";

// The builders own the construction; a caller just hands over an Arcanum + a render context.
const snap = (arcanum, opts = {}) => ArcanumSnapshotBuilder.fromArcanum(arcanum, new ArcanumRenderContext(opts));

const richArcanum = () => new Arcanum({
	slug: "azure", major: true, name: "Azure Hand", img: null,
	front: {
		item: { name: "Azure Hand", weight: 1, note: "magical" },
		choices: [{ slug: "azure", list: [{ type: "entry", slug: "marks", content: { text: "Marks" }, track: { max: 4 } }] }],
	},
	back: {
		title: "Mysteries", resource: { max: 2, labels: ["a", "b"] },
		choices: [
			{ slug: "moves", title: "Moves", list: [{ type: "entry", slug: "battery", track: { max: 1 }, grants: [{ type: "move", slug: "battery", locations: ["inline"] }] }] },
			{ slug: "consequences", title: "Consequences", list: [
				{ type: "entry", slug: "c1", content: { text: "burned" }, track: { max: 1 } },
				{ type: "entry", slug: "c2", content: { text: "scorched" }, track: { max: 1 }, indent: true },
			] },
		],
	},
});

// A side's first (unlock) group; and the consequences group inside the back's ordered choices array.
const frontGroup    = (s) => s.front.choices[0];
const consequencesOf = (s) => s.back.choices.find(g => g.slug === "consequences");

describe("ArcanumSnapshotBuilder.fromArcanum", () => {
	it("maps a full arcanum to front/back snapshots", () => {
		const s = snap(richArcanum(), { flipped: true });
		expect(s).toMatchObject({ slug: "azure", major: true, name: "Azure Hand", owned: true, flipped: true });
		expect(s.front.item.name).toBe("Azure Hand");
		expect(frontGroup(s)).toBeTruthy();             // ChoiceGroup
		expect(s.back.resource).toBeTruthy();           // ResourceSnapshot
		expect(s.back.choices.map(g => g.slug)).toEqual(["moves", "consequences"]);  // ordered groups
		// A move is a move-grant entry (resolved inline against moves.bySlug at render), not a MoveSnapshot here.
		expect(s.back.choices[0].list[0].moves.slugs).toEqual(["battery"]);
	});

	it("heads the front with the ARCANUM's name and the back with its own mystery title", () => {
		const s = snap(richArcanum(), { flipped: true });
		expect(s.front.title.raw).toBe("Azure Hand");
		expect(s.back.title.raw).toBe("Mysteries");
	});

	it("front title follows the arcanum name — a stale stored front.title is ignored", () => {
		const a = new Arcanum({ slug: "azure", name: "Azure Hand", front: { title: "Something Else" }, back: {} });
		expect(snap(a).front.title.raw).toBe("Azure Hand");
	});

	it("carries a diamond-less front's disguise tags through to the snapshot (item stays null)", () => {
		const a = new Arcanum({ slug: "the-key", name: "A... key?", front: { tagList: ["magical", "terrifying"], description: "a white thing" }, back: {} });
		const s = snap(a);
		expect(s.front.item).toBeNull();
		expect(s.front.tags.map((t) => t.label)).toEqual(["magical", "terrifying"]);
	});

	it("builds a front header resource track the same way the back's is built", () => {
		const a = new Arcanum({ slug: "x", name: "X", front: { resource: { max: 3, labels: [] } }, back: {} });
		const s = snap(a);
		expect(s.front.resource).toBeTruthy();
		expect(s.front.resource.max).toBe(3);
	});

	// One `resource()` builds both a side's header track and its inline item's — including a `maxStat` def,
	// which used to resolve to 0 on the item path.
	it("resolves a maxStat max from the stats for a header track AND an inline item resource", () => {
		const a = new Arcanum({
			slug: "x", name: "X",
			back: { resource: { maxStat: "wis", labels: [] }, item: { name: "Orb", resource: { maxStat: "wis", labels: [] } } },
		});
		const s = snap(a, { stats: new Stats({ wis: 2 }) });
		expect(s.back.resource.max).toBe(2);
		expect(s.back.item.resource.max).toBe(2);
	});

	it("defaults (preview): not flipped, empty choices arrays, no stats crash", () => {
		const s = snap(new Arcanum({ slug: "x", front: {}, back: {} }));
		expect(s.flipped).toBe(false);
		expect(s.owned).toBe(true);
		expect(s.front.choices).toEqual([]);
		expect(s.back.choices).toEqual([]);
		expect(s.back.resource).toBeNull();
	});

	it("reads each front/back group from the ONE choiceValues store by each group's own slug", () => {
		const choiceValues = new ChoiceValues({
			azure:        { marks: 3 },   // front group slug = "azure"
			consequences: { c1: 1 },      // consequences group slug = "consequences"
		});
		const s = snap(richArcanum(), { flipped: true, choiceValues });
		expect(frontGroup(s).list[0].track.checks).toEqual([true, true, true, false]);
		expect(consequencesOf(s).list[0].track.checks).toEqual([true]);
	});

	it("consequences default to unchecked when the store has no value (regression: #50)", () => {
		const s = snap(richArcanum(), { flipped: true });
		expect(consequencesOf(s).list[0].track.checks).toEqual([false]);
	});

	it("carries a consequence's indent flag through to the snapshot row", () => {
		const s = snap(richArcanum(), { flipped: true });
		expect(consequencesOf(s).list.map(r => r.indent)).toEqual([false, true]);
	});
});

describe("arcanumOutfitItemSnapshot", () => {
	it("returns null for no item; maps fields otherwise", () => {
		expect(arcanumOutfitItemSnapshot("x", null)).toBeNull();
		expect(arcanumOutfitItemSnapshot("x", { name: "Cloak", weight: 1 })).toMatchObject({ slug: "x", name: "Cloak", weight: 1 });
	});
});

describe("MoveSnapshotBuilder.forArcanum", () => {
	it("maps an arcanum mystery move into an always-active, non-selectable MoveSnapshot", () => {
		const m = MoveSnapshotBuilder.forArcanum({ id: "battery", name: "Battery", text: "store energy" });
		expect(m).toBeInstanceOf(MoveSnapshot);
		expect(m).toMatchObject({
			id: "battery", slug: "battery", name: "Battery",
			rollStat: null, selectable: false, resource: null, requirement: null, choices: null,
		});
		expect(m.description.raw).toBe("store energy");
		expect(m.selection).toEqual({ value: 1, max: 1 });
	});

	it("carries a subtitle through as the move sourceLabel (null when absent)", () => {
		expect(MoveSnapshotBuilder.forArcanum({ name: "Resonance", subtitle: "Requires: Battery" }).sourceLabel).toBe("Requires: Battery");
		expect(MoveSnapshotBuilder.forArcanum({ name: "Unquenched" }).sourceLabel).toBeNull();
	});
});
