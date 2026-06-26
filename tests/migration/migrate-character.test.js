import { describe, it, expect } from "vitest";
import {
	isTaylorOriginCharacter,
	buildCharacterScalarMigration,
	buildLoreMigration,
	buildPlaybookLoreMigration,
	buildResourcesMigration,
	buildInstinctMigration,
	buildAppearanceMigration,
	buildArcanaMigration,
	buildPossessionsMigration,
	buildOutfitMigration,
	buildFollowersMigration,
	buildInsertMigration,
	buildCharacterMigration,
	remapTaylorPortrait,
} from "../../module/migration/migrate-character.js";
import { taylorCharacter } from "./fixtures/taylor-character.js";
import { composeInstinct } from "../../module/utils/strings.js";

const fakeActor = ({ type = "character", system = {}, items = [] } = {}) => ({ type, _source: { system }, items });

describe("isTaylorOriginCharacter", () => {
	it("detects a Taylor character by his system fields (from raw source)", () => {
		expect(isTaylorOriginCharacter(fakeActor({ system: { background: { selected: "shepherd" } } }))).toBe(true);
		expect(isTaylorOriginCharacter(fakeActor({ system: { playbookSlug: "the-blessed" } }))).toBe(true);
		expect(isTaylorOriginCharacter(fakeActor({ system: { instinct: { custom: "protect" } } }))).toBe(true);
		expect(isTaylorOriginCharacter(fakeActor({ system: { inventory: { checked: { spear: true } } } }))).toBe(true);
		expect(isTaylorOriginCharacter(fakeActor({ system: { choices: { values: { x: 1 } } } }))).toBe(true);
	});

	it("detects a Taylor character by his embedded item types", () => {
		expect(isTaylorOriginCharacter(fakeActor({ items: [{ type: "arcanum" }] }))).toBe(true);
		expect(isTaylorOriginCharacter(fakeActor({ items: [{ type: "possession" }] }))).toBe(true);
	});

	it("returns false for a fork-origin character (no telltales) and non-characters", () => {
		expect(isTaylorOriginCharacter(fakeActor({ system: { stats: { str: { value: 1 } }, attributes: {} }, items: [{ type: "move" }] }))).toBe(false);
		expect(isTaylorOriginCharacter(fakeActor({ type: "npc", system: { background: { selected: "x" } } }))).toBe(false);
	});
});

describe("buildCharacterScalarMigration", () => {
	it("maps his scalars to fork flags + the playbook ref", () => {
		const u = buildCharacterScalarMigration({
			background: { selected: "shepherd" },
			origin: { selected: "marshedge" },
			instinct: { custom: "protect the grove" },
			inventory: { checked: { spear: true }, regularPool: 3, smallPool: 1, loadLevel: "heavy", otherItems: "rope" },
			playbookSlug: "the-blessed",
		}, "stonetop");
		expect(u).toEqual({
			"flags.stonetop.background.selected": "shepherd",
			"flags.stonetop.origin.selected": "marshedge",
			"flags.stonetop.instinct.selected": "protect the grove", // his .custom → fork .selected
			"flags.stonetop.inventory.checked": { spear: true },
			"flags.stonetop.inventory.regularPool": 3,
			"flags.stonetop.inventory.smallPool": 1,
			"flags.stonetop.inventory.otherItems": "rope",
			"system.playbook.slug": "the-blessed",
		});
	});

	it("omits empty/absent fields (no noise, no clobbering)", () => {
		expect(buildCharacterScalarMigration({}, "stonetop")).toEqual({});
		expect(buildCharacterScalarMigration({ background: { selected: "" }, inventory: { checked: {} } }, "stonetop")).toEqual({});
	});

	it("includes a zero pool (a real value) but not a missing one", () => {
		const u = buildCharacterScalarMigration({ inventory: { regularPool: 0 } }, "stonetop");
		expect(u).toEqual({ "flags.stonetop.inventory.regularPool": 0 });
	});
});

describe("buildLoreMigration", () => {
	it("splits his lore.values into counts (numbers) and texts (strings), keyed group:option", () => {
		const u = buildLoreMigration(taylorCharacter._source.system, "stonetop");
		expect(u["flags.stonetop.lore.counts"]).toEqual({
			"the-earth-mother:shrine-loved": 1,
			"danu-offerings:figurines": 1,
			"danu-offerings:salt": 1,
		});
		expect(u["flags.stonetop.lore.texts"]).toEqual({
			"the-relic:where-acquired": "From a barrow under the Steplands.", // `-input` suffix stripped
		});
	});

	it("drops zero/deselected counts and blank text", () => {
		const u = buildLoreMigration({ lore: { values: {
			g: { picked: 1, deselected: 0 },
			h: { blank: "   ", real: "x" },
		} } }, "stonetop");
		expect(u["flags.stonetop.lore.counts"]).toEqual({ "g:picked": 1 });
		expect(u["flags.stonetop.lore.texts"]).toEqual({ "h:real": "x" });
	});

	it("returns {} when there's no lore", () => {
		expect(buildLoreMigration({}, "stonetop")).toEqual({});
		expect(buildLoreMigration({ lore: { values: {} } }, "stonetop")).toEqual({});
	});

	it("applies the per-playbook crosswalk (his the-earth-mother offerings → fork danu-offerings)", () => {
		const u = buildLoreMigration({
			playbookSlug: "the-blessed",
			lore: { values: { "the-earth-mother": { "shrine-loved": 1, figurines: 1 } } },
		}, "stonetop");
		expect(u["flags.stonetop.lore.counts"]).toEqual({
			"the-earth-mother:shrine-loved": 1,   // shrine opt — aligned (identity)
			"danu-offerings:figurines": 1,        // offering — group-renamed via the crosswalk
		});
	});
});

describe("buildPlaybookLoreMigration (current-form lore on the playbook item)", () => {
	it("routes the playbook item's lore choiceValues to lore.counts, crosswalk-translated", () => {
		const u = buildPlaybookLoreMigration(taylorCharacter.items, "stonetop");
		expect(u["flags.stonetop.lore.counts"]).toEqual({
			"the-earth-mother:shrine-loved": 1,   // shrine opt aligned
			"danu-offerings:figurines": 1,        // offering crosswalked
			"danu-offerings:salt": 1,
		});
	});

	it("returns {} when the playbook has no mapped lore groups / no choiceValues", () => {
		expect(buildPlaybookLoreMigration([{ type: "playbook", _source: { system: { slug: "the-unmapped", choiceValues: { "x": { a: 1 } } } } }], "stonetop")).toEqual({});
		expect(buildPlaybookLoreMigration([{ type: "move" }], "stonetop")).toEqual({});
	});
});

describe("buildResourcesMigration", () => {
	it("maps the inventory resource namespace verbatim (item + arcana slugs; keeps a deliberate 0 track)", () => {
		const u = buildResourcesMigration(taylorCharacter._source.system, "stonetop");
		expect(u["flags.stonetop.inventory.resources"]).toEqual({ "sacred-pouch": 2, "torches": 0 });
	});

	it("does NOT map the deferred backgrounds / move-resource namespaces", () => {
		const u = buildResourcesMigration(taylorCharacter._source.system, "stonetop");
		expect(u).not.toHaveProperty("flags.stonetop.background.setupResources");
		expect(u).not.toHaveProperty("flags.stonetop.moves.backgroundChoices");
	});

	it("returns {} when there are no inventory resources", () => {
		expect(buildResourcesMigration({}, "stonetop")).toEqual({});
		expect(buildResourcesMigration({ resources: { counts: { inventory: {} } } }, "stonetop")).toEqual({});
	});
});

describe("buildInstinctMigration", () => {
	const pbItem = (choiceInstinct) => ([{ type: "playbook", _source: { system: {
		instinct: { list: [{ type: "pick", pickCount: 1, options: [
			{ slug: "delight", text: "Delight", description: "To find beauty, in even the ugliest things." },
			{ slug: "nurture", text: "Nurture", description: "To help others grow, learn, or improve." },
		] }] },
		choiceValues: { instinct: choiceInstinct },
	} } }]);

	it("composes a selected preset slug into the fork's resolved instinct string (via composeInstinct)", () => {
		const u = buildInstinctMigration(pbItem({ nurture: 1, delight: 0 }), "stonetop");
		expect(u["flags.stonetop.instinct.selected"]).toBe(composeInstinct("Nurture", "To help others grow, learn, or improve."));
	});

	it("passes a __custom free-text instinct through verbatim (wins over presets, no oneWord truncation)", () => {
		const u = buildInstinctMigration(pbItem({ __custom: "to guard the last hearth", nurture: 0 }), "stonetop");
		expect(u["flags.stonetop.instinct.selected"]).toBe("to guard the last hearth");
	});

	it("returns {} with no current-form instinct selection", () => {
		expect(buildInstinctMigration(pbItem({}), "stonetop")).toEqual({});
		expect(buildInstinctMigration([{ type: "move" }], "stonetop")).toEqual({});
	});
});

describe("buildAppearanceMigration", () => {
	it("maps selected appearance slugs to { lineIndex: displayText } via the embedded def", () => {
		const u = buildAppearanceMigration(taylorCharacter.items, "stonetop");
		expect(u["flags.stonetop.appearance.selected"]).toEqual({
			0: "hale & hearty", 1: "raspy voice", 2: "curvy", 3: "work clothes",
		});
	});

	it("returns {} with no appearance selection or def", () => {
		expect(buildAppearanceMigration([{ type: "playbook", _source: { system: {} } }], "stonetop")).toEqual({});
		expect(buildAppearanceMigration([{ type: "move" }], "stonetop")).toEqual({});
	});

	it("copies the option display text verbatim (rare cross-content cosmetic divergences ride along losslessly)", () => {
		// His def text is stored as-is; if it differs cosmetically from the fork's content (e.g. an
		// apostrophe, like the Fox's "like a whippin' stick"), the value is preserved but won't render
		// selected until the deferred normalization/crosswalk reconciles it.
		const items = [{ type: "playbook", _source: { system: {
			appearance: { list: [ { type: "pick", pickCount: 1, options: [ { slug: "whippin-stick", text: "like a whippin' stick" } ] } ] },
			choiceValues: { appearance: { "whippin-stick": 1 } },
		} } }];
		expect(buildAppearanceMigration(items, "stonetop")["flags.stonetop.appearance.selected"]).toEqual({ 0: "like a whippin' stick" });
	});
});

describe("buildArcanaMigration", () => {
	it("maps his arcanum items to fork arcana flags (flattening nested marks)", () => {
		const u = buildArcanaMigration(taylorCharacter.items, "stonetop");
		expect(u["flags.stonetop.arcana.owned"]).toEqual(["sacred-pouch", "a-folktale"]);
		expect(u["flags.stonetop.arcana.flipped"]).toEqual(["sacred-pouch"]);
		expect(u["flags.stonetop.arcana.major"]).toBe("sacred-pouch");
		expect(u["flags.stonetop.arcana.unlock"]).toEqual({ "sacred-pouch:more-uses": 2, "sacred-pouch:wider-array": 1 });
		expect(u["flags.stonetop.arcana.backOptions"]).toEqual({ "sacred-pouch:dark-bargain": 1 });
	});

	it("returns {} when there are no arcanum items", () => {
		expect(buildArcanaMigration([{ type: "move" }], "stonetop")).toEqual({});
	});
});

describe("buildPossessionsMigration", () => {
	it("maps selected/uses/choiceUses (re-prefixing choiceUses keys)", () => {
		const u = buildPossessionsMigration(taylorCharacter.items, "stonetop");
		expect(u["flags.stonetop.possessions.selected"]).toEqual(["sacred-pouch-poss"]);
		expect(u["flags.stonetop.possessions.uses"]).toEqual({ "sacred-pouch-poss": 3 });
		expect(u["flags.stonetop.possessions.choiceUses"]).toEqual({ "sacred-pouch-poss:healing-draught": 1 });
	});
});

describe("buildOutfitMigration", () => {
	it("maps his outfit items to inventory.checked", () => {
		const u = buildOutfitMigration(taylorCharacter.items, "stonetop");
		expect(u["flags.stonetop.inventory.checked"]).toEqual({ "healers-kit": true, "rations": true });
	});
});

describe("buildFollowersMigration", () => {
	it("maps owned npc items to customFollowers keyed by slug, flattening Selection fields", () => {
		const u = buildFollowersMigration(taylorCharacter.items, "stonetop");
		const map = u["flags.stonetop.customFollowers"];
		expect(Object.keys(map).sort()).toEqual(["loyal-hound", "old-sara"]); // not the un-owned "wild-wolf"

		expect(map["loyal-hound"]).toMatchObject({
			name:      "Loyal Hound",
			tags:      ["fierce", "tracker"],   // tagList.selected
			hpMax:     6,                        // hp.max
			hpCurrent: 4,                        // hp.value (≤ max)
			armor:     1,                        // parsed from "1"
			damage:    "d6",
			instinct:  "to protect the pack",    // instinct.selected[0]
			cost:      "affection",              // cost.selected[0]
			moves:     "- Sniff out danger\n- Stand guard",
			notes:     "Brannan's faithful companion.",
			loyalty:   2,                        // loyalty.value
			order:     0,
		});
	});

	it("parses prose armor and tolerates empty single-selects; preserves item order", () => {
		const map = buildFollowersMigration(taylorCharacter.items, "stonetop")["flags.stonetop.customFollowers"];
		expect(map["old-sara"]).toMatchObject({
			armor:    2,    // leading int from "2 (leather)"
			instinct: "",   // empty selection → ""
			cost:     "",
			loyalty:  0,
			order:    1,    // after loyal-hound
		});
	});

	it("returns {} when there are no owned followers", () => {
		expect(buildFollowersMigration([{ type: "npc", system: { slug: "x", owned: false } }], "stonetop")).toEqual({});
		expect(buildFollowersMigration([{ type: "move" }], "stonetop")).toEqual({});
	});
});

describe("buildInsertMigration", () => {
	it("maps a post-death insert: pointer + lore-mark counts (verbatim, incl. content-divergent slugs)", () => {
		const u = buildInsertMigration(taylorCharacter.items, "stonetop");
		expect(u["flags.stonetop.postDeathInsert.slug"]).toBe("ghost");
		expect(u["flags.stonetop.postDeathLore.counts"]).toEqual({
			"terrible-purpose:longing": 1,
			"consequences:breakdown": 1,
			"consequences:carrion-stench": 1, // copied verbatim; fork ignores option slugs it lacks
		});
	});

	it("defers the instinct group — not as an instinct flag, not leaked into lore counts", () => {
		const u = buildInsertMigration(taylorCharacter.items, "stonetop");
		expect(Object.keys(u).some(k => k.includes("postDeathInstinct"))).toBe(false);
		expect(u["flags.stonetop.postDeathLore.counts"]).not.toHaveProperty("instinct:denial");
	});

	it("maps the invocations insert to the selected slug array (count>0 only, deselected excluded)", () => {
		const u = buildInsertMigration(taylorCharacter.items, "stonetop");
		expect(u["flags.stonetop.invocations.selected"]).toEqual(["dancing-light", "warmth-of-the-sun"]);
	});

	it("returns {} when there are no insert items", () => {
		expect(buildInsertMigration([{ type: "move" }, { type: "npc", system: { owned: true } }], "stonetop")).toEqual({});
	});

	it("applies the Thrall insert crosswalk (slug renames) to its post-death lore", () => {
		const u = buildInsertMigration([
			{ type: "insert", system: { slug: "thrall", choiceValues: {
				"your-master": { name: 1 },          // → master-name
				impulse:       { "hide-bury": 1, "stoke-conflict": 1 }, // hide-bury → hide-smother; stoke-conflict aligned
				marks:         { "festering-rot": 1 }, // → a-festering-rot
			} } },
		], "stonetop");
		expect(u["flags.stonetop.postDeathInsert.slug"]).toBe("thrall");
		expect(u["flags.stonetop.postDeathLore.counts"]).toEqual({
			"your-master:master-name": 1,
			"impulse:hide-smother": 1,
			"impulse:stoke-conflict": 1,
			"marks:a-festering-rot": 1,
		});
	});

	it("with multiple post-death inserts, the pointer AND its lore take the last (no cross-merge)", () => {
		const u = buildInsertMigration([
			{ type: "insert", system: { slug: "ghost", choiceValues: { "terrible-purpose": { longing: 1 } } } },
			{ type: "insert", system: { slug: "revenant", choiceValues: { "terrible-purpose": { duty: 1 } } } },
		], "stonetop");
		expect(u["flags.stonetop.postDeathInsert.slug"]).toBe("revenant");
		expect(u["flags.stonetop.postDeathLore.counts"]).toEqual({ "terrible-purpose:duty": 1 }); // ghost's longing did NOT leak
	});
});

describe("remapTaylorPortrait", () => {
	it("remaps his playbook-portrait path to the fork's vendored classic art (scope-aware)", () => {
		expect(remapTaylorPortrait("systems/stonetop/assets/playbooks/the-blessed.png", "stonetop_pwd"))
			.toBe("systems/stonetop_pwd/assets/classic/playbooks/the-blessed.png");
		// Post-rename scope yields his original (now valid) id, still under the classic art dir.
		expect(remapTaylorPortrait("/systems/stonetop/assets/playbooks/the-fox.png", "stonetop"))
			.toBe("systems/stonetop/assets/classic/playbooks/the-fox.png");
	});

	it("leaves fork-native / core / null paths alone", () => {
		expect(remapTaylorPortrait("icons/svg/book.svg", "stonetop_pwd")).toBeNull();
		expect(remapTaylorPortrait("systems/stonetop_pwd/assets/classic/playbooks/the-blessed.png", "stonetop_pwd")).toBeNull();
		expect(remapTaylorPortrait("systems/stonetop/assets/post-death-inserts/ghost.png", "stonetop_pwd")).toBeNull();
		expect(remapTaylorPortrait(null, "stonetop_pwd")).toBeNull();
		expect(remapTaylorPortrait(undefined, "stonetop_pwd")).toBeNull();
	});
});

describe("buildCharacterMigration (combined, against the fixture)", () => {
	const u = buildCharacterMigration(taylorCharacter, "stonetop");

	it("reads his raw _source.system scalars", () => {
		expect(u["flags.stonetop.background.selected"]).toBe("devoted");
		expect(u["flags.stonetop.instinct.selected"]).toBe("to serve Tor and the people");
		expect(u["system.playbook.slug"]).toBe("the-blessed");
		expect(u["flags.stonetop.inventory.otherItems"]).toBe("a carved talisman");
	});

	it("merges inventory.checked from BOTH scalars and outfit items", () => {
		expect(u["flags.stonetop.inventory.checked"]).toEqual({
			spear: true, shield: true,          // from system.inventory.checked
			"healers-kit": true, rations: true, // from his outfit items
		});
	});

	it("includes the arcana + possessions mappings", () => {
		expect(u["flags.stonetop.arcana.owned"]).toEqual(["sacred-pouch", "a-folktale"]);
		expect(u["flags.stonetop.possessions.selected"]).toEqual(["sacred-pouch-poss"]);
	});

	it("includes the owned followers as customFollowers", () => {
		expect(Object.keys(u["flags.stonetop.customFollowers"]).sort()).toEqual(["loyal-hound", "old-sara"]);
		expect(u["flags.stonetop.customFollowers"]["loyal-hound"].name).toBe("Loyal Hound");
	});

	it("includes the inserts mapping (post-death pointer + invocations)", () => {
		expect(u["flags.stonetop.postDeathInsert.slug"]).toBe("ghost");
		expect(u["flags.stonetop.invocations.selected"]).toEqual(["dancing-light", "warmth-of-the-sun"]);
	});

	it("includes lore (actor-level + current-form) with the crosswalk applied", () => {
		expect(u["flags.stonetop.lore.counts"]).toMatchObject({
			"the-earth-mother:shrine-loved": 1,
			"danu-offerings:figurines": 1, // crosswalked (current-form playbook-item lore + actor-level)
		});
		expect(u["flags.stonetop.lore.texts"]).toMatchObject({ "the-relic:where-acquired": "From a barrow under the Steplands." });
	});

	it("includes appearance from the current-form playbook item, keeping the actor-level instinct", () => {
		expect(u["flags.stonetop.appearance.selected"]).toMatchObject({ 0: "hale & hearty", 3: "work clothes" });
		// No current-form choiceValues.instinct in the fixture, so the actor-level scalar instinct survives.
		expect(u["flags.stonetop.instinct.selected"]).toBe("to serve Tor and the people");
	});

	it("includes the inventory resource counts (backgrounds/move resources deferred)", () => {
		expect(u["flags.stonetop.inventory.resources"]).toEqual({ "sacred-pouch": 2, "torches": 0 });
		expect(u).not.toHaveProperty("flags.stonetop.background.setupResources");
	});

	it("remaps his playbook-portrait actor.img + token to the fork's vendored classic art", () => {
		expect(u.img).toBe("systems/stonetop/assets/classic/playbooks/the-blessed.png");
		expect(u["prototypeToken.texture.src"]).toBe("systems/stonetop/assets/classic/playbooks/the-blessed.png");
	});
});
