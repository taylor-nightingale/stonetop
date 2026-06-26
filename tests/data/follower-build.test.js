import { describe, it, expect } from "vitest";
import {
	deriveHp, deriveArmor, deriveDamageDie, formatDamage,
	normalizeTags, parseFollowerArmor, buildCustomFollower, monsterFollowerTags, followerFromMonster,
	orderFollowersBonus,
} from "../../module/data/follower-build.js";

// The rules content + derivations behind the Create-a-Follower walkthrough and
// the monster→follower conversion (Book I, NPCs & Followers, pp.474–479).

describe("deriveHp", () => {
	it("uses the chosen resilience base", () => {
		expect(deriveHp({ base: "weak",  mods: [] })).toBe(3);
		expect(deriveHp({ base: "able",  mods: [] })).toBe(6);
		expect(deriveHp({ base: "tough", mods: [] })).toBe(9);
	});

	it("adds all checked modifiers", () => {
		// Able-bodied + large + fates smile = 6 + 4 + 2
		expect(deriveHp({ base: "able", mods: ["large", "fates"] })).toBe(12);
	});

	it("never drops below 1 HP even when tiny", () => {
		// Weak (3) - tiny (2) = 1
		expect(deriveHp({ base: "weak", mods: ["tiny"] })).toBe(1);
	});

	it("defaults to 1 for an unknown base with no mods", () => {
		expect(deriveHp({ base: "???", mods: [] })).toBe(1);
	});
});

describe("deriveArmor", () => {
	it("uses the chosen protection base", () => {
		expect(deriveArmor({ base: "cloth", mods: [] })).toBe(0);
		expect(deriveArmor({ base: "steel", mods: [] })).toBe(3);
		expect(deriveArmor({ base: "magical", mods: [] })).toBe(4);
	});

	it("stacks the +1 modifiers", () => {
		// Leathers (1) + shield (1) + skilled (1) = 3
		expect(deriveArmor({ base: "leather", mods: ["shield", "skilled"] })).toBe(3);
	});

	it("floors at 0", () => {
		expect(deriveArmor({ base: "cloth", mods: [] })).toBe(0);
	});
});

describe("deriveDamageDie / formatDamage", () => {
	it("maps danger to a die", () => {
		expect(deriveDamageDie("weak")).toBe("d4");
		expect(deriveDamageDie("defends")).toBe("d6");
		expect(deriveDamageDie("veteran")).toBe("d8");
	});

	it("joins die + form", () => {
		expect(formatDamage("d6", "hand")).toBe("d6 (hand)");
		expect(formatDamage("d8", "")).toBe("d8");
		expect(formatDamage("d6", "(near, low ammo)")).toBe("d6 (near, low ammo)");
	});
});

describe("orderFollowersBonus", () => {
	it("adds +0 when no tag applies", () => {
		expect(orderFollowersBonus({ helps: 0 })).toEqual({ bonus: 0, rollMode: "normal" });
	});

	it("adds +1 when at least one tag applies", () => {
		expect(orderFollowersBonus({ helps: 1 })).toEqual({ bonus: 1, rollMode: "normal" });
		// Multiple applicable tags still only grant +1.
		expect(orderFollowersBonus({ helps: 3 }).bonus).toBe(1);
	});

	it("adds +2 only when exceptional AND another tag applies", () => {
		expect(orderFollowersBonus({ helps: 1, exceptional: true }).bonus).toBe(2);
	});

	it("keeps an exceptional follower at +0 when nothing else applies", () => {
		// Book edge case (p.462): exceptional alone, no applicable tag → +0.
		expect(orderFollowersBonus({ helps: 0, exceptional: true }).bonus).toBe(0);
	});

	it("rolls with disadvantage when a tag gets in the way", () => {
		expect(orderFollowersBonus({ helps: 1, hinders: 1 })).toEqual({ bonus: 1, rollMode: "dis" });
		// Disadvantage can coexist with the +2 bonus.
		expect(orderFollowersBonus({ helps: 1, hinders: 1, exceptional: true })).toEqual({ bonus: 2, rollMode: "dis" });
	});

	it("honors the optional advantage toggle, but a hindering tag overrides it", () => {
		expect(orderFollowersBonus({ helps: 1, advantage: true }).rollMode).toBe("adv");
		expect(orderFollowersBonus({ helps: 1, hinders: 1, advantage: true }).rollMode).toBe("dis");
	});

	it("defaults to a clean +0/normal with no arguments", () => {
		expect(orderFollowersBonus()).toEqual({ bonus: 0, rollMode: "normal" });
	});
});

describe("parseFollowerArmor", () => {
	it("passes clean numbers through, floored at 0 and truncated", () => {
		expect(parseFollowerArmor(2)).toBe(2);
		expect(parseFollowerArmor(0)).toBe(0);
		expect(parseFollowerArmor(-3)).toBe(0);
		expect(parseFollowerArmor(2.9)).toBe(2);
	});

	it("extracts the leading number from book-format conditional armor", () => {
		// "Armor 2 (0 vs. iron)" → 2 (the conditional remainder isn't modeled).
		expect(parseFollowerArmor("2 (0 vs. iron)")).toBe(2);
		expect(parseFollowerArmor("3")).toBe(3);
	});

	it("returns 0 for placeholders and non-numeric junk", () => {
		expect(parseFollowerArmor("—")).toBe(0);
		expect(parseFollowerArmor("")).toBe(0);
		expect(parseFollowerArmor(null)).toBe(0);
		expect(parseFollowerArmor(undefined)).toBe(0);
		expect(parseFollowerArmor(NaN)).toBe(0);
	});
});

describe("normalizeTags", () => {
	it("splits comma strings, trims, and drops blanks", () => {
		expect(normalizeTags("archer, observant ,, eager")).toEqual(["archer", "observant", "eager"]);
	});

	it("de-dupes case-insensitively, first spelling wins", () => {
		expect(normalizeTags(["Archer", "archer", "ARCHER"])).toEqual(["Archer"]);
	});
});

describe("buildCustomFollower", () => {
	it("normalizes a walkthrough result into the stored shape", () => {
		const f = buildCustomFollower({
			name: "  Andras ", pronoun: "he", typeLabel: "apprentice hunter",
			tags: ["archer", "observant", "eager", "rookie"],
			hp: 6, armor: 0, damage: "d6 (near, low ammo)",
			instinct: "to try to impress Rhianna", cost: "recognition",
			moves: "Moon over Blodwen\nMake a rookie mistake",
			gear: ["Bow & iron arrows", { label: "", checked: false }],
		});
		expect(f.name).toBe("Andras");
		expect(f.typeLabel).toBe("apprentice hunter");
		expect(f.tags).toEqual(["archer", "observant", "eager", "rookie"]);
		expect(f.hpMax).toBe(6);
		expect(f.hpCurrent).toBe(6); // defaults to full
		expect(f.armor).toBe(0);
		expect(f.damage).toBe("d6 (near, low ammo)");
		expect(f.cost).toBe("recognition");
		expect(f.loyalty).toBe(0);
		// Blank gear rows are dropped; strings become {label, checked}.
		expect(f.gear).toEqual([{ label: "Bow & iron arrows", checked: false }]);
	});

	it("defaults the type label and portrait, and clamps a given hpCurrent to max", () => {
		const f = buildCustomFollower({ name: "X", hp: 6, hpCurrent: 99 });
		expect(f.typeLabel).toBe("follower");
		expect(f.portraitIcon).toBe("fas fa-user");
		expect(f.hpCurrent).toBe(6);
	});

	it("keeps the leading number from book-format conditional armor (not 0)", () => {
		const f = buildCustomFollower({ name: "X", hp: 6, armor: "2 (0 vs. iron)" });
		expect(f.armor).toBe(2);
	});

	it("honors a starting loyalty (e.g. summoned spirits), flooring at 0", () => {
		expect(buildCustomFollower({ name: "X", loyalty: 3 }).loyalty).toBe(3);
		expect(buildCustomFollower({ name: "X", loyalty: -2 }).loyalty).toBe(0);
		expect(buildCustomFollower({ name: "X" }).loyalty).toBe(0);
	});
});

describe("monsterFollowerTags", () => {
	it("drops the organization and size, keeping flavor tags", () => {
		const tags = monsterFollowerTags({
			organization: "group", size: "", tags: "group, organized, cautious",
		});
		expect(tags).toEqual(["organized", "cautious"]);
	});

	it("drops a size tag too", () => {
		const tags = monsterFollowerTags({
			organization: "solitary", size: "large", tags: "solitary, large, fierce, cunning",
		});
		expect(tags).toEqual(["fierce", "cunning"]);
	});
});

describe("followerFromMonster", () => {
	const wolf = {
		name: "Wolf",
		uuid: "Actor.abc123",
		system: {
			organization: "group",
			size: "",
			creatureType: "natural-beast",
			tags: "group, organized, cautious",
			attributes: {
				hp: { value: 4, max: 6 },
				armor: { value: 0 },
				damage: { value: "bite d8 (hand, grabby)", rollFormula: "d8" },
				instinct: { value: "to bring down the weakest prey" },
			},
		},
		items: [
			{ type: "monsterMove", name: "Follow prey for miles on end" },
			{ type: "monsterMove", name: "Surround, flank, and harry" },
		],
	};

	it("keeps the monster's stats as-is (p.475)", () => {
		const f = followerFromMonster(
			{ name: wolf.name, system: wolf.system, moves: wolf.items.map(i => i.name), uuid: wolf.uuid },
			{ tags: [], cost: "", pronoun: "it" },
		);
		expect(f.name).toBe("Wolf");
		expect(f.hpMax).toBe(6);
		expect(f.hpCurrent).toBe(4); // current HP carried over
		expect(f.armor).toBe(0);
		expect(f.damage).toBe("bite d8 (hand, grabby)");
		expect(f.instinct).toBe("to bring down the weakest prey");
		expect(f.pronoun).toBe("it");
		expect(f.portraitIcon).toBe("fas fa-paw"); // a beast keeps the paw
		expect(f.sourceUuid).toBe("Actor.abc123");
		expect(f.loyalty).toBe(0); // gains a Loyalty track at 0
	});

	it("uses the monster's creature-type glyph, not the generic paw (e.g. an Adept is human)", () => {
		const f = followerFromMonster(
			{ name: "Rime Adept", system: { creatureType: "human-individual", attributes: { hp: { max: 6 } } }, moves: [] },
			{},
		);
		expect(f.portraitIcon).toBe("fas fa-user");
	});

	it("falls back to a generic monster glyph when no creature type is set", () => {
		const f = followerFromMonster(
			{ name: "Mystery", system: { attributes: { hp: { max: 6 } } }, moves: [] },
			{},
		);
		expect(f.portraitIcon).toBe("fas fa-dragon");
	});

	it("keeps flavor tags and appends the player's added tags", () => {
		const f = followerFromMonster(
			{ name: wolf.name, system: wolf.system, moves: [] },
			{ tags: ["keen-nosed"], cost: "training", pronoun: "" },
		);
		expect(f.tags).toEqual(["organized", "cautious", "keen-nosed"]);
		expect(f.cost).toBe("training");
	});

	it("keeps a monster's leading armor when its value is a conditional string", () => {
		const f = followerFromMonster(
			{ name: "Iron Golem", system: { attributes: { armor: { value: "2 (0 vs. iron)" }, hp: { max: 12 } } }, moves: [] },
			{},
		);
		expect(f.armor).toBe(2);
	});

	it("carries the monster moves as newline-joined text", () => {
		const f = followerFromMonster(
			{ name: wolf.name, system: wolf.system, moves: wolf.items.map(i => i.name) },
			{},
		);
		expect(f.moves).toBe("Follow prey for miles on end\nSurround, flank, and harry");
	});
});
