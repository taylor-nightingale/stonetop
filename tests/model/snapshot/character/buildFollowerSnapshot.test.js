import { describe, it, expect } from "vitest";
import { buildFollowerSnapshot } from "../../../../src/model/snapshot/character/buildFollowerSnapshot.js";
import { FollowerSnapshot } from "../../../../src/model/snapshot/character/FollowerSnapshot.js";

// A minimal npc-item stand-in: buildFollowerSnapshot only reads item.name / item.img / item.system.
function item(system = {}, { name = "Follower", img = null } = {}) {
	return { name, img, system };
}

describe("buildFollowerSnapshot", () => {
	it("returns a FollowerSnapshot carrying the item's core fields", () => {
		const snap = buildFollowerSnapshot(item({
			slug: "enfys", hp: { value: 4, max: 6 }, armor: "1", damage: "d6",
		}, { name: "Enfys", img: "systems/stonetop/assets/x.png" }));
		expect(snap).toBeInstanceOf(FollowerSnapshot);
		expect(snap.slug).toBe("enfys");
		expect(snap.name).toBe("Enfys");
		expect(snap.img).toBe("systems/stonetop/assets/x.png");
		expect(snap.hp).toBe(4);
		expect(snap.hpMax).toBe(6);
		expect(snap.armor.raw).toBe("1");
		expect(snap.damage.raw).toBe("d6");
	});

	it("carries specialQuality and description through as RichText", () => {
		const snap = buildFollowerSnapshot(item({
			slug: "x", specialQuality: "Immune to fire", description: "A weathered old scout.",
		}));
		expect(snap.specialQuality.raw).toBe("Immune to fire");
		expect(snap.description.raw).toBe("A weathered old scout.");
	});

	it("defaults specialQuality and description to empty RichText when unset", () => {
		const snap = buildFollowerSnapshot(item({ slug: "x" }));
		expect(snap.specialQuality.raw).toBe("");
		expect(snap.description.raw).toBe("");
	});

	it("builds loyalty from the passed loyaltyCurrent + stored max (not the stored value)", () => {
		const snap = buildFollowerSnapshot(item({ slug: "x", loyalty: { value: 0, max: 3 } }), { loyaltyCurrent: 2 });
		expect(snap.loyalty.current).toBe(2);
		expect(snap.loyalty.max).toBe(3);
	});

	it("defaults loyalty max to 3 and current to 0 when unset", () => {
		const snap = buildFollowerSnapshot(item({ slug: "x" }));
		expect(snap.loyalty.current).toBe(0);
		expect(snap.loyalty.max).toBe(3);
	});

	it("marks a follower with the group tag as isGroup and carries members", () => {
		const snap = buildFollowerSnapshot(item({
			slug: "crew",
			tagList: { selected: ["group"], options: ["group"], multi: true, allowCustom: true },
			members: [{ name: "Aled", hp: { value: 6, max: 6 } }],
			membersNote: "note",
			memberSuggestions: { names: ["Nesta"], tags: ["big"], traits: ["snores"] },
		}));
		expect(snap.isGroup).toBe(true);
		expect(snap.members).toHaveLength(1);
		expect(snap.members[0].name).toBe("Aled");
		expect(snap.memberSuggestions.names).toContain("Nesta");
	});

	it("marks a follower tagged 'horde' as isGroup — horde is a group tag", () => {
		const snap = buildFollowerSnapshot(item({
			slug: "servant-of-daagon",
			tagList: { selected: ["terrifying", "horde"], options: [], multi: true, allowCustom: true },
			members: [{ name: "", hp: { value: 3, max: 3 } }],
		}));
		expect(snap.isGroup).toBe(true);
		expect(snap.members).toHaveLength(1);
	});

	it("exposes an enabled animal companion + its catalog", () => {
		const snap = buildFollowerSnapshot(item({
			slug: "animal-companion",
			companion: {
				enabled: true,
				type:    { selected: [], options: [], multi: false, allowCustom: true },
				options: { selected: [], options: [], multi: true, allowCustom: true },
				catalog: [{ slug: "bird", name: "Bird", hp: { value: 5, max: 5 }, pickCount: 4, options: [], defaults: [] }],
			},
		}));
		expect(snap.isCompanion).toBe(true);
		expect(snap.companionTypeSelection.options).toEqual(["Bird"]);
	});

	it("builds a choices ChoiceGroup when the item has a choices group", () => {
		const snap = buildFollowerSnapshot(item({
			slug: "x",
			choices: [{ slug: "choices", list: [{ type: "pick", pickCount: 1, options: [{ slug: "a", text: "A" }] }] }],
			choiceValues: {},
		}));
		expect(snap.choices).not.toBeNull();
		expect(snap.choices.list.length).toBeGreaterThan(0);
	});

	it("has no choices when the choices array is empty", () => {
		expect(buildFollowerSnapshot(item({ slug: "x", choices: [] })).choices).toBeNull();
	});

	it("passes the inventory snapshot through (null → no inventory)", () => {
		expect(buildFollowerSnapshot(item({ slug: "x" })).hasInventory).toBe(false);
		const inv = { hasAny: false, showDetails: false, ownedSections: [], sections: [] };
		expect(buildFollowerSnapshot(item({ slug: "x" }), { inventory: inv }).hasInventory).toBe(true);
	});
});
