import {describe, expect, it} from "vitest";
import {CharacterSnapshot} from "../../../module/model/CharacterSnapshot.js";
import {OutfitItemBuilder} from "../../../module/model/OutfitItem.js";
import {FakePlaybookRepository} from "../../fakes/FakePlaybookRepository.js";
import {FakeInventoryRepository} from "../../fakes/FakeInventoryRepository.js";
import {TestCharacterBuilder} from "../../fakes/TestCharacterBuilder.js";
import {FakeMoveRepository} from "../../fakes/FakeMoveRepository.js";
import {FakePostDeathInsertRepository} from "../../fakes/FakePostDeathInsertRepository.js";
import {MoveDefinition} from "../../../module/model/MoveDefinition.js";
import {FakeActorBuilder, FakeStatBuilder} from "../../fakes/FakeActorBuilder.js";

function makeOutfitItem(overrides = {}) {
	return new OutfitItemBuilder()
		.withSlug(overrides.slug ?? "test-item")
		.withName(overrides.name ?? "Test Item")
		.withWeight(overrides.weight ?? 1)
		.withNote(overrides.note ?? null)
		.withInventoryColumn(overrides.inventoryColumn ?? "regular")
		.withResource(overrides.resource ?? null)
		.withTwoCol(overrides.twoCol ?? false)
		.withSmallGrid(overrides.smallGrid ?? false)
		.withBreakBefore(overrides.breakBefore ?? false)
		.withArmor(overrides.armor ?? null)
		.build();
}

// -- Playbook fixture ---------------------------------------------------------

const HEAVY_PLAYBOOK = {
	slug: "the-heavy",
	name: "The Heavy",
	img: "modules/stonetop/assets/playbooks/the-heavy.svg",
	description: "<p>You are the muscle.</p>",
	statsNote: "Put your highest stat in STR or CON.",
	hp: 20,
	damage: "d10",
	startingMovesNote: "Choose 2 to start.",
	specialPossessions: null,
	backgrounds: [
		{
			slug: "veteran",
			label: "Veteran",
			description: "<p>You fought in a war.</p>",
			moves: ["Harden"],
			choices: null,
		},
		{
			slug: "mercenary",
			label: "Mercenary",
			description: "<p>You sold your sword.</p>",
			moves: ["Overcome"],
			choices: {
				label: "Choose one",
				count: [1, 1],
				options: [{slug: "iron-will", label: "Iron Will"}],
			},
		},
	],
	instincts: [
		{word: "Paranoia", description: "You see threats everywhere."},
		{word: "Protection", description: "You guard those who can't guard themselves."},
	],
	appearance: [
		["tall and broad", "lean and wiry", "slight"],
		["scarred", "unmarked", "tattooed"],
	],
	origin: [
		{region: "Stonetop", names: ["Brakken", "Corvin"]},
		{region: "Barrier Pass", names: ["Alagh", "Bora"]},
	],
};

function makeHeavyActor({items = [], flags = {}} = {}) {
	return new FakeActorBuilder()
		.withPlaybook("the-heavy", "The Heavy")
		.withItems(items)
		.withFlags(flags)
		.build();
}

// ── CharacterSnapshot class ───────────────────────────────────────────────────

describe("buildSnapshot — type", () => {
	it("returns a CharacterSnapshot instance", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.build().buildSnapshot();
		expect(snap).toBeInstanceOf(CharacterSnapshot);
	});
});

// ── name ─────────────────────────────────────────────────────────────────────

describe("buildSnapshot — name", () => {
	it("uses actor.name", async () => {
		const actor = new FakeActorBuilder().withName("Jorvik").build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.name).toBe("Jorvik");
	});
});

// ── playbook (null when no playbook) ─────────────────────────────────────────

describe("buildSnapshot — playbook: null when no playbook selected", () => {
	it("playbook is null", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.build().buildSnapshot();
		expect(snap.playbook).toBeNull();
	});
});

// ── playbook (populated) ─────────────────────────────────────────────────────

describe("buildSnapshot — playbook section", () => {
	async function buildSnap(flags = {}) {
		const actor = new FakeActorBuilder()
			.withPlaybook("the-heavy", "The Heavy")
			.withFlags(flags)
			.build();
		return new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(HEAVY_PLAYBOOK)).build().buildSnapshot();
	}

	it("includes slug, name, img, description, statsNote", async () => {
		const snap = await buildSnap();
		expect(snap.playbook.slug).toBe("the-heavy");
		expect(snap.playbook.name).toBe("The Heavy");
		expect(snap.playbook.img).toBe("modules/stonetop/assets/playbooks/the-heavy.svg");
		expect(snap.playbook.description).toBe("<p>You are the muscle.</p>");
		expect(snap.playbook.statsNote).toBe("Put your highest stat in STR or CON.");
	});

	it("background.selected is null when none saved", async () => {
		const snap = await buildSnap();
		expect(snap.playbook.background.selected).toBeNull();
	});

	it("background.selected reflects saved slug", async () => {
		const snap = await buildSnap({"background.selected": "veteran"});
		expect(snap.playbook.background.selected).toBe("veteran");
	});

	it("background.options has correct length and marks selected", async () => {
		const snap = await buildSnap({"background.selected": "mercenary"});
		expect(snap.playbook.background.options).toHaveLength(2);
		expect(snap.playbook.background.options[0].selected).toBe(false);
		expect(snap.playbook.background.options[1].selected).toBe(true);
	});

	it("background.options[n].moves is an array of slugs", async () => {
		const snap = await buildSnap();
		expect(snap.playbook.background.options[0].moves).toEqual(["harden"]);
		expect(snap.playbook.background.options[1].moves).toEqual(["overcome"]);
	});

	it("background.options[n].choices is null when none defined", async () => {
		const snap = await buildSnap();
		expect(snap.playbook.background.options[0].choices).toBeNull();
	});

	it("background.options[n].choices includes saved state", async () => {
		const snap = await buildSnap({"background.choices": {"iron-will": true}});
		const mercenary = snap.playbook.background.options[1];
		expect(mercenary.choices.saved).toEqual({"iron-will": true});
		expect(mercenary.choices.options[0].slug).toBe("iron-will");
	});

	it("instinct.selected is null when none saved", async () => {
		const snap = await buildSnap();
		expect(snap.playbook.instinct.selected).toBeNull();
	});

	it("instinct.selected reflects saved value", async () => {
		const snap = await buildSnap({"instinct.selected": "Paranoia — You see threats everywhere."});
		expect(snap.playbook.instinct.selected).toBe("Paranoia — You see threats everywhere.");
	});

	it("instinct.options has word, description, value, and selected", async () => {
		const snap = await buildSnap();
		const opt = snap.playbook.instinct.options[0];
		expect(opt.word).toBe("Paranoia");
		expect(opt.description).toBe("You see threats everywhere.");
		expect(opt.value).toBe("Paranoia — You see threats everywhere.");
		expect(opt.selected).toBe(false);
	});

	it("instinct.options[n].selected is true when instinct matches saved", async () => {
		const snap = await buildSnap({"instinct.selected": "Paranoia — You see threats everywhere."});
		expect(snap.playbook.instinct.options[0].selected).toBe(true);
		expect(snap.playbook.instinct.options[1].selected).toBe(false);
	});

	it("appearance.options is array of {lineIdx, options} objects", async () => {
		const snap = await buildSnap();
		expect(snap.playbook.appearance.options).toHaveLength(2);
		expect(snap.playbook.appearance.options[0].lineIdx).toBe(0);
		expect(snap.playbook.appearance.options[1].lineIdx).toBe(1);
		expect(snap.playbook.appearance.options[0].options[0]).toMatchObject({value: "tall and broad", selected: false});
	});

	it("appearance.options[n].options[n].selected is true when saved", async () => {
		const snap = await buildSnap({"appearance.selected": {0: "tall and broad", 1: "scarred"}});
		expect(snap.playbook.appearance.options[0].options.find(o => o.value === "tall and broad").selected).toBe(true);
		expect(snap.playbook.appearance.options[1].options.find(o => o.value === "scarred").selected).toBe(true);
	});

	it("origin.selected is null when none saved", async () => {
		const snap = await buildSnap();
		expect(snap.playbook.origin.selected).toBeNull();
	});

	it("origin.selected reflects saved region", async () => {
		const snap = await buildSnap({"origin.selected": "Stonetop"});
		expect(snap.playbook.origin.selected).toBe("Stonetop");
	});

	it("origin.options has region and names", async () => {
		const snap = await buildSnap();
		expect(snap.playbook.origin.options[0].region).toBe("Stonetop");
		expect(snap.playbook.origin.options[0].names).toContain("Brakken");
	});
});

// ── debilities ────────────────────────────────────────────────────────────────

describe("buildSnapshot — debilities", () => {
	it("returns array of 3 debilities", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.build().buildSnapshot();
		expect(snap.debilities).toHaveLength(3);
	});

	it("each debility has key, name, active, stats fields", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.build().buildSnapshot();
		const w = snap.debilities[0];
		expect(w.key).toBe("weakened");
		expect(w.name).toBe("Weakened");
		expect(w.active).toBe(false);
		expect(w.stats).toEqual(["str", "dex"]);
	});

	it("weakened active=true when actor flag is set", async () => {
		const actor = new FakeActorBuilder().withDebility("weakened", true).build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		const weakened = snap.debilities.find(d => d.key === "weakened");
		expect(weakened.active).toBe(true);
	});

	it("dazed maps to int and wis", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.build().buildSnapshot();
		const dazed = snap.debilities.find(d => d.key === "dazed");
		expect(dazed.stats).toEqual(["int", "wis"]);
	});

	it("miserable maps to con and cha", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.build().buildSnapshot();
		const miserable = snap.debilities.find(d => d.key === "miserable");
		expect(miserable.stats).toEqual(["con", "cha"]);
	});
});

// ── stats ─────────────────────────────────────────────────────────────────────

describe("buildSnapshot — stats", () => {
	it("includes all six stats with value, name, abbr", async () => {
		const actor = new FakeActorBuilder().withStats(new FakeStatBuilder()
			.withStr(2)
			.withDex(1)
			.withCon(0)
			.withInt(-1)
			.withWis(1)
			.withCha(0))
			.build();

		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.stats.str.value).toBe(2);
		expect(snap.stats.str.name).toBe("Strength");
		expect(snap.stats.str.abbr).toBe("STR");
		expect(snap.stats.dex.name).toBe("Dexterity");
		expect(snap.stats.dex.abbr).toBe("DEX");
		expect(snap.stats.con.abbr).toBe("CON");
		expect(snap.stats.int.abbr).toBe("INT");
		expect(snap.stats.wis.abbr).toBe("WIS");
		expect(snap.stats.cha.abbr).toBe("CHA");
	});

	it("stats have no debilityKey field", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build()).build().buildSnapshot();
		expect(snap.stats.str).not.toHaveProperty("debilityKey");
	});
});

// ── vitals ────────────────────────────────────────────────────────────────────

describe("buildSnapshot — vitals", () => {
	it("hp.max comes from playbook.hp (not system.attributes.hp.max)", async () => {
		const actor = new FakeActorBuilder()
			.withPlaybook("the-heavy", "The Heavy")
			.withHp(15, 99)
			.build();

		const snap = await new TestCharacterBuilder(actor).addPlaybook(HEAVY_PLAYBOOK).build().buildSnapshot();
		expect(snap.vitals.hp.max).toBe(20);
	});

	it("hp.value from system.attributes.hp.value", async () => {
		const actor = new FakeActorBuilder().withPlaybook("the-heavy", "The Heavy").withHp(12, 20).build();
		const snap = await new TestCharacterBuilder(actor).addPlaybook(HEAVY_PLAYBOOK).build().buildSnapshot();

		expect(snap.vitals.hp.value).toBe(12);
	});

	it("hp is {value:0, max:0} when no playbook", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.build().buildSnapshot();
		expect(snap.vitals.hp).toMatchObject({value: 0, max: 0});
	});

	it("damage from playbook when playbook present", async () => {
		const actor = new FakeActorBuilder().withPlaybook("the-heavy", "The Heavy").build();
		const snap = await new TestCharacterBuilder(actor).addPlaybook(HEAVY_PLAYBOOK).build().buildSnapshot();
		expect(snap.vitals.damage).toBe("d10");
	});

	it("damage is null when no playbook", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build()).build().buildSnapshot();
		expect(snap.vitals.damage).toBeNull();
	});

	it("armor is derived from checked inventory items", async () => {
		const actor = new FakeActorBuilder()
			.withFlag("inventory.checked", {"thick-hides": true, "shield": true})
			.build();
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([
				makeOutfitItem({ slug: "thick-hides", armor: { base: 1 } }),
				makeOutfitItem({ slug: "shield",      armor: { modifier: 1 } }),
			]))
			.build().buildSnapshot();
		expect(snap.vitals.armor).toBe(2);
	});

	it("level is a plain number", async () => {
		const actor = new FakeActorBuilder().withLevel(4).build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.vitals.level).toBe(4);
		expect(typeof snap.vitals.level).toBe("number");
	});

	it("xp.max = 6 + level * 2", async () => {
		const actor = new FakeActorBuilder().withLevel(6).withXp(5, 8).build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.vitals.xp.max).toBe(18);
	});

	it("xp.value from system.attributes.xp.value", async () => {
		const actor = new FakeActorBuilder().withXp(5, 8).build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.vitals.xp.value).toBe(5);
	});
});

// ── moves ─────────────────────────────────────────────────────────────────────

describe("buildSnapshot — moves", () => {
	function makeMove(id, name, overrides = {}) {
		return {
			_id: id, name,
			system: {moveType: "playbook", isStartingMove: false, rollType: null, ...overrides},
		};
	}

	function makeBasicMove(id, name, rollType = "ask") {
		return new MoveDefinition({_id: id, name, system: {moveType: "basic", rollType}});
	}

	it("moves is an empty array when no playbook and no basic moves", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build()).build().buildSnapshot();
		expect(snap.moves).toEqual([]);
	});

	it("basic moves appear as a category when present", async () => {
		const basic = makeBasicMove("b1", "Defy Danger", "ask");
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build()).addBasicMove(basic).build().buildSnapshot();
		const basicCat = snap.moves.find(c => c.key === "basic");
		expect(basicCat).toBeDefined();
		expect(basicCat.title).toBe("Basic Moves");
		expect(basicCat.note).toBeNull();
		expect(basicCat.moves[0].name).toBe("Defy Danger");
	});

	it("playbook moves category title is '{Playbook Name} Moves'", async () => {
		const actor = makeHeavyActor();
		const entry = makeMove("pm1", "Harden");
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(HEAVY_PLAYBOOK))
			.addPlaybookMove(entry)
			.build().buildSnapshot();
		const pbCat = snap.moves.find(c => c.key === "playbook");
		expect(pbCat.title).toBe("The Heavy Moves");
	});

	it("playbook moves category note comes from startingMovesNote", async () => {
		const actor = makeHeavyActor();
		const entry = makeMove("pm1", "Harden");
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(HEAVY_PLAYBOOK))
			.addPlaybookMove(entry)
			.build().buildSnapshot();
		expect(snap.moves.find(c => c.key === "playbook").note).toBe("Choose 2 to start.");
	});

	it("playbook move source is { type: 'playbook', slug }", async () => {
		const actor = makeHeavyActor();
		const entry = makeMove("pm1", "Harden");
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(HEAVY_PLAYBOOK))
			.addPlaybookMove(entry)
			.build().buildSnapshot();
		const move = snap.moves.find(c => c.key === "playbook").moves[0];
		expect(move.source).toEqual({type: "playbook", slug: "the-heavy"});
	});

	it("basic move source is { type: 'basic' }", async () => {
		const basic = makeBasicMove("b1", "Defy Danger");
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.addBasicMove(basic)
			.build().buildSnapshot();
		const move = snap.moves.find(c => c.key === "basic").moves[0];
		expect(move.source).toEqual({type: "basic"});
	});

	it("owned playbook move has owned=true and ownedIds populated", async () => {
		const actor =  new FakeActorBuilder()
			.withPlaybook("the-heavy", "The Heavy")
			.addItem({_id: "o1", type: "move", name: "Harden", system: {moveType: "playbook"}})
			.build();
		const entry = makeMove("pm1", "Harden");
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(HEAVY_PLAYBOOK))
			.addPlaybookMove(entry)
			.build().buildSnapshot();
		const move = snap.moves.find(c => c.key === "playbook").moves[0];
		expect(move.owned).toBe(true);
		expect(move.ownedIds).toContain("o1");
	});

	it("unowned move has owned=false and ownedIds=[]", async () => {
		const actor = makeHeavyActor();
		const entry = makeMove("pm1", "Harden");
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(HEAVY_PLAYBOOK))
			.addPlaybookMove(entry)
			.build().buildSnapshot();
		const move = snap.moves.find(c => c.key === "playbook").moves[0];
		expect(move.owned).toBe(false);
		expect(move.ownedIds).toEqual([]);
	});

	it("locked move (unmet move requirement) has locked=true and requirement.met=false", async () => {
		const actor = makeHeavyActor();
		const entry = makeMove("pm2", "Locked Move", {requirement: {moves: ["Harden"]}});
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(HEAVY_PLAYBOOK))
			.addPlaybookMove(entry)
			.build().buildSnapshot();
		const move = snap.moves.find(c => c.key === "playbook").moves[0];
		expect(move.locked).toBe(true);
		expect(move.requirement.met).toBe(false);
	});

	it("move with resource has unified resource shape", async () => {
		const actor = makeHeavyActor();
		const entry = makeMove("pm1", "Resource Move", {resource: {max: 4, title: "Favor", labels: []}});
		const char = new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(HEAVY_PLAYBOOK))
			.addPlaybookMove(entry)
			.build();
		actor.flags.stonetop["moves.backgroundChoices"] = {"Resource Move": 2};
		const snap = await char.buildSnapshot();
		const move = snap.moves.find(c => c.key === "playbook").moves[0];
		expect(move.resource).toMatchObject({current: 2, max: 4, title: "Favor", labels: []});
	});

	it("move without resource has resource=null", async () => {
		const actor = makeHeavyActor();
		const entry = makeMove("pm1", "Simple Move");
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(HEAVY_PLAYBOOK))
			.addPlaybookMove(entry)
			.build().buildSnapshot();
		const move = snap.moves.find(c => c.key === "playbook").moves[0];
		expect(move.resource).toBeNull();
	});

	it("repeatable move has repeat: { max, current }", async () => {
		const actor = makeHeavyActor({
			items: [
				{_id: "r1", type: "move", name: "Big Move", system: {moveType: "playbook"}},
			]
		});
		const entry = makeMove("pm1", "Big Move", {repeatMax: 3});
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(HEAVY_PLAYBOOK))
			.addPlaybookMove(entry)
			.build().buildSnapshot();
		const move = snap.moves.find(c => c.key === "playbook").moves[0];
		expect(move.repeat).toEqual({max: 3, current: 1});
	});

	it("non-repeatable move has repeat=null", async () => {
		const actor = makeHeavyActor();
		const entry = makeMove("pm1", "Simple Move");
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(HEAVY_PLAYBOOK))
			.addPlaybookMove(entry)
			.addPlaybookMove(entry)
			.build().buildSnapshot();
		const move = snap.moves.find(c => c.key === "playbook").moves[0];
		expect(move.repeat).toBeNull();
	});

	it("categories with no moves are excluded", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.build().buildSnapshot();
		const keys = snap.moves.map(c => c.key);
		expect(keys).not.toContain("playbook");
		expect(keys).not.toContain("background");
	});
});

// ── inventory.outfit ─────────────────────────────────────────────────────────

describe("buildSnapshot — inventory.outfit", () => {
	it("load.selected reflects saved load level", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.loadLevel", "heavy").build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.inventory.outfit.load.selected).toBe("heavy");
	});

	it("load.selected is null when none set", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.build().buildSnapshot();
		expect(snap.inventory.outfit.load.selected).toBeNull();
	});

	it("load.options has 3 entries with slug and note", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.build().buildSnapshot();
		const opts = snap.inventory.outfit.load.options;
		expect(opts).toHaveLength(3);
		expect(opts[0].slug).toBe("light");
		expect(opts[1].slug).toBe("normal");
		expect(opts[2].slug).toBe("heavy");
		expect(typeof opts[0].note).toBe("string");
	});

	it("regularPool has unified resource shape with checked=current", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.regularPool", 3).build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.inventory.outfit.regularPool).toMatchObject({current: 3, max: 9, title: null, labels: []});
	});

	it("smallPool has unified resource shape", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.smallPool", 0).build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.inventory.outfit.smallPool).toMatchObject({current: 0, max: 9, title: null, labels: []});
	});

	it("regularItems from inventory repo have resource shape when defined", async () => {
		const item = makeOutfitItem({
			slug: "bow-arrows", name: "Bow & arrows", weight: 1,
			resource: {max: 2, title: null, labels: ["low ammo", "all out"]},
		});
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.withInventoryRepo(new FakeInventoryRepository([item]))
			.build().buildSnapshot();
		const ri = snap.inventory.outfit.regularItems[0];
		expect(ri.slug).toBe("bow-arrows");
		expect(ri.resource).toMatchObject({current: 0, max: 2, title: null, labels: ["low ammo", "all out"]});
	});

	it("inventory item with no resource has resource=null", async () => {
		const item = makeOutfitItem({slug: "cloak", name: "Cloak", weight: 0, resource: null});
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.withInventoryRepo(new FakeInventoryRepository([item]))
			.build().buildSnapshot();
		expect(snap.inventory.outfit.regularItems[0].resource).toBeNull();
	});

	it("checked inventory item has checked=true", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.checked", {"bow-arrows": true}).build();
		const item = makeOutfitItem({slug: "bow-arrows", name: "Bow", weight: 1});
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([item]))
			.build().buildSnapshot();
		expect(snap.inventory.outfit.regularItems[0].checked).toBe(true);
	});

	it("resource.current reflects inventory flag count", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.resources", {"bow-arrows": 1}).build();
		const item = makeOutfitItem({
			slug: "bow-arrows", name: "Bow", weight: 1,
			resource: {max: 2, title: null, labels: ["low ammo", "all out"]},
		});
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([item]))
			.build().buildSnapshot();
		expect(snap.inventory.outfit.regularItems[0].resource.current).toBe(1);
	});
});

// ── inventory.possessions ────────────────────────────────────────────────────

describe("buildSnapshot — inventory.possessions", () => {
	it("is null when no playbook", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.build().buildSnapshot();
		expect(snap.inventory.possessions).toBeNull();
	});

	it("is null when playbook has no specialPossessions", async () => {
		const actor = makeHeavyActor();
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository({
				...HEAVY_PLAYBOOK,
				specialPossessions: null
			})).build().buildSnapshot();
		expect(snap.inventory.possessions).toBeNull();
	});

	const SP = {
		pickNote: "Pick 2",
		pickCount: 2,
		preselected: ["pouch"],
		options: [
			{
				slug: "pouch",
				label: "Sacred Pouch",
				description: "<p>A pouch.</p>",
				resource: {max: 3, title: "Stock", labels: []}
			},
			{slug: "apiary", label: "Apiary", description: "<p>Bees.</p>"},
		],
	};

	it("has pickCount, pickNote, and items", async () => {
		const actor = makeHeavyActor();
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository({
				...HEAVY_PLAYBOOK,
				specialPossessions: SP
			})).build().buildSnapshot();
		expect(snap.inventory.possessions.pickCount).toBe(2);
		expect(snap.inventory.possessions.pickNote).toBe("Pick 2");
		expect(snap.inventory.possessions.items).toHaveLength(2);
	});

	it("possession has unified resource shape", async () => {
		const actor = makeHeavyActor({flags: {"possessions.selected": ["pouch"]}});
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository({
				...HEAVY_PLAYBOOK,
				specialPossessions: SP
			})).build().buildSnapshot();
		const pouch = snap.inventory.possessions.items.find(i => i.slug === "pouch");
		expect(pouch.resource.max).toBe(3);
		expect(pouch.resource.title).toBe("Stock");
		expect(pouch.resource.labels).toEqual([]);
	});

	it("possession resource.current reflects uses flag", async () => {
		const actor = makeHeavyActor({
			flags: {
				"possessions.selected": ["pouch"],
				"possessions.uses": {pouch: 2},
			}
		});
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository({
				...HEAVY_PLAYBOOK,
				specialPossessions: SP
			})).build().buildSnapshot();
		const pouch = snap.inventory.possessions.items.find(i => i.slug === "pouch");
		expect(pouch.resource.current).toBe(2);
	});
});

// ── inventory.other ───────────────────────────────────────────────────────────

describe("buildSnapshot — inventory.other", () => {
	it("other is empty array when no non-inventory items owned", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build()).build().buildSnapshot();
		expect(snap.inventory.other).toEqual([]);
	});

	it("other contains owned items that are not inventory-type moves", async () => {
		const actor = new FakeActorBuilder()
			.addItem({
				_id: "x1",
				type: "move",
				name: "Custom Sword",
				system: {moveType: "other", description: "<p>A sword.</p>", rollType: null}
			})
			.build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.inventory.other).toHaveLength(1);
		expect(snap.inventory.other[0].name).toBe("Custom Sword");
		expect(snap.inventory.other[0].id).toBe("x1");
	});

	it("inventory-type moves do not appear in other", async () => {
		const actor = new FakeActorBuilder()
			.addItem({_id: "i1", type: "move", name: "Bow", system: {moveType: "inventory", slug: "bow"}})
			.build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.inventory.other).toHaveLength(0);
	});
});

// ── lore ──────────────────────────────────────────────────────────────────────

describe("buildSnapshot — lore section", () => {
	const LORE_PLAYBOOK = {
		...HEAVY_PLAYBOOK,
		lore: [
			{
				slug: "the-earth-mother",
				title: "The Earth Mother",
				description: "<p>Danu text</p>",
				options: [
					{ slug: "shrine-loved",  description: "... loved.",    max: 1 },
					{ slug: "shrine-berth",  description: "... berth.",    max: 1 },
				],
			},
			{
				slug: "danu-offerings",
				title: "Offerings to Danu",
				description: "<p>Offerings text</p>",
				options: [
					{ slug: "fruits", description: "Fruits of harvest", max: 3 },
				],
			},
		],
	};

	async function buildSnap(flags = {}) {
		const actor = new FakeActorBuilder()
			.withPlaybook("the-heavy", "The Heavy")
			.withFlags(flags)
			.build();
		return new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(LORE_PLAYBOOK))
			.build().buildSnapshot();
	}

	it("lore.hasEntries is true when playbook has lore", async () => {
		const snap = await buildSnap();
		expect(snap.playbook.lore.hasEntries).toBe(true);
	});

	it("lore.hasEntries is false when playbook has no lore", async () => {
		const actor = new FakeActorBuilder().withPlaybook("the-heavy", "The Heavy").build();
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(HEAVY_PLAYBOOK))
			.build().buildSnapshot();
		expect(snap.playbook.lore.hasEntries).toBe(false);
	});

	it("lore.entries has correct length", async () => {
		const snap = await buildSnap();
		expect(snap.playbook.lore.entries).toHaveLength(2);
	});

	it("lore entry has slug, title, description", async () => {
		const snap = await buildSnap();
		const entry = snap.playbook.lore.entries[0];
		expect(entry.slug).toBe("the-earth-mother");
		expect(entry.title).toBe("The Earth Mother");
		expect(entry.description).toBe("<p>Danu text</p>");
	});

	it("lore entry options have slug, description, max", async () => {
		const snap = await buildSnap();
		const opt = snap.playbook.lore.entries[0].options[0];
		expect(opt.slug).toBe("shrine-loved");
		expect(opt.description).toBe("... loved.");
		expect(opt.max).toBe(1);
	});

	it("lore option count is 0 when no flag saved", async () => {
		const snap = await buildSnap();
		expect(snap.playbook.lore.entries[0].options[0].count).toBe(0);
	});

	it("lore option count reflects saved flag", async () => {
		const snap = await buildSnap({ "lore.counts": { "the-earth-mother:shrine-loved": 1 } });
		expect(snap.playbook.lore.entries[0].options[0].count).toBe(1);
	});

	it("lore option checks has length equal to max", async () => {
		const snap = await buildSnap();
		const opt = snap.playbook.lore.entries[1].options[0];
		expect(opt.checks).toHaveLength(3);
	});

	it("lore option checks are all false when count is 0", async () => {
		const snap = await buildSnap();
		const opt = snap.playbook.lore.entries[0].options[0];
		expect(opt.checks).toEqual([false]);
	});

	it("lore option checks reflect count correctly", async () => {
		const snap = await buildSnap({ "lore.counts": { "danu-offerings:fruits": 2 } });
		const opt = snap.playbook.lore.entries[1].options[0];
		expect(opt.checks).toEqual([true, true, false]);
	});

	const TEXT_LORE_PLAYBOOK = {
		...HEAVY_PLAYBOOK,
		lore: [
			{
				slug: "questions",
				title: "Questions",
				description: "",
				options: [
					{ slug: "q-one", description: "What happened?", type: "text" },
				],
			},
		],
	};

	async function buildSnapWithText(flags = {}) {
		const actor = new FakeActorBuilder()
			.withPlaybook("the-heavy", "The Heavy")
			.withFlags(flags)
			.build();
		return new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(TEXT_LORE_PLAYBOOK))
			.build().buildSnapshot();
	}

	it("text-type option has type === 'text'", async () => {
		const snap = await buildSnapWithText();
		expect(snap.playbook.lore.entries[0].options[0].type).toBe("text");
	});

	it("text-type option has checks === []", async () => {
		const snap = await buildSnapWithText();
		expect(snap.playbook.lore.entries[0].options[0].checks).toEqual([]);
	});

	it("text-type option textValue is empty string when no flag saved", async () => {
		const snap = await buildSnapWithText();
		expect(snap.playbook.lore.entries[0].options[0].textValue).toBe("");
	});

	it("text-type option textValue reflects saved flag", async () => {
		const snap = await buildSnapWithText({ "lore.texts": { "questions:q-one": "it was chaos" } });
		expect(snap.playbook.lore.entries[0].options[0].textValue).toBe("it was chaos");
	});
});

// ── movelist: post-death moves ────────────────────────────────────────────────

const REVENANT_INSERT = {
	_id: "pDiRevenant00001",
	name: "Revenant",
	img: null,
	system: { slug: "revenant", description: "<p>When you die…</p>" },
	flags: { stonetop: { instincts: [], lore: [] } },
};

const REVENANT_MOVE = {
	_id: "pdMove001",
	name: "Undying",
	system: { rollType: "str", description: "You refuse to stay down." },
};

const REVENANT_ACTOR_MOVE = {
	_id: "pdMove001Own",
	name: "Undying",
	type: "move",
	system: { moveType: "post-death", rollType: "str", description: "You refuse to stay down." },
};

describe("buildSnapshot — movelist / post-death moves", () => {
	it("postDeathGroup is null when no active insert", async () => {
		const actor = new FakeActorBuilder().build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.movelist.postDeathGroup).toBeNull();
		expect(snap.movelist.otherGroups.find(g => g.key === "post-death")).toBeUndefined();
	});

	it("postDeathGroup is set to insert name and owned PDI moves", async () => {
		const actor = new FakeActorBuilder()
			.withFlag("postDeathInsert.slug", "revenant")
			.addItem(REVENANT_ACTOR_MOVE)
			.build();
		const pdiRepo = new FakePostDeathInsertRepository([REVENANT_INSERT]);
		const snap = await new TestCharacterBuilder(actor)
			.withPostDeathInsertRepo(pdiRepo)
			.build()
			.buildSnapshot();
		expect(snap.movelist.postDeathGroup).not.toBeNull();
		expect(snap.movelist.postDeathGroup.label).toBe("Revenant");
		expect(snap.movelist.postDeathGroup.moves).toHaveLength(1);
	});

	it("PDI group moves have source.type 'post-death', real ownedId, owned and isStarting true", async () => {
		const actor = new FakeActorBuilder()
			.withFlag("postDeathInsert.slug", "revenant")
			.addItem(REVENANT_ACTOR_MOVE)
			.build();
		const pdiRepo = new FakePostDeathInsertRepository([REVENANT_INSERT]);
		const snap = await new TestCharacterBuilder(actor)
			.withPostDeathInsertRepo(pdiRepo)
			.build()
			.buildSnapshot();
		const move = snap.movelist.postDeathGroup.moves[0];
		expect(move.source.type).toBe("post-death");
		expect(move.ownedId).toBe("pdMove001Own");
		expect(move.owned).toBe(true);
		expect(move.isStarting).toBe(true);
		expect(move.name).toBe("Undying");
	});
});

// ── rollMode ──────────────────────────────────────────────────────────────────

describe("buildSnapshot — rollMode", () => {
	it("defaults to 'normal' when no flag set", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build()).build().buildSnapshot();
		expect(snap.rollMode).toBe("normal");
	});

	it("reflects pbta rollMode flag", async () => {
		const actor = new FakeActorBuilder().withRollMode("adv").build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.rollMode).toBe("adv");
	});
});
