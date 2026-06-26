import {describe, expect, it} from "vitest";
import {CharacterSnapshot} from "../../../module/model/CharacterSnapshot.js";
import {OutfitItemBuilder} from "../../../module/model/OutfitItem.js";
import {FakePlaybookRepository} from "../../fakes/FakePlaybookRepository.js";
import {FakeInventoryRepository} from "../../fakes/FakeInventoryRepository.js";
import {TestCharacterBuilder} from "../../fakes/TestCharacterBuilder.js";
import {FakeMoveRepository} from "../../fakes/FakeMoveRepository.js";
import {FakePostDeathInsertRepository} from "../../fakes/FakePostDeathInsertRepository.js";
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
	img: "systems/stonetop/assets/playbooks/the-heavy.svg",
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
			markableActions: {
				label: "Mark 1 at 1st level, then 3rd/5th/7th/9th.",
				levels: [1, 3, 5, 7, 9],
				options: [
					{slug: "act-a", label: "Action A"},
					{slug: "act-b", label: "Action B"},
					{slug: "act-c", label: "Action C"},
				],
			},
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
		expect(snap.playbook.img).toBe("systems/stonetop/assets/playbooks/the-heavy.svg");
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

	it("background.options[n].markableActions is null when none defined", async () => {
		const snap = await buildSnap();
		expect(snap.playbook.background.options[1].markableActions).toBeNull();
	});

	async function buildSnapAtLevel(level, flags = {}) {
		const actor = new FakeActorBuilder()
			.withPlaybook("the-heavy", "The Heavy")
			.withLevel(level)
			.withFlags(flags)
			.build();
		return new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(HEAVY_PLAYBOOK)).build().buildSnapshot();
	}

	it("markableActions allows 1 mark at 1st level, with nothing marked", async () => {
		const snap = await buildSnapAtLevel(1);
		const veteran = snap.playbook.background.options[0];
		expect(veteran.markableActions.allowed).toBe(1);
		expect(veteran.markableActions.markedCount).toBe(0);
		expect(veteran.markableActions.options.map(o => o.checked)).toEqual([false, false, false]);
	});

	it("markableActions reflects a saved mark and locks the rest at the limit", async () => {
		const snap = await buildSnapAtLevel(1, {"background.markedActions": ["act-b"]});
		const opts = snap.playbook.background.options[0].markableActions.options;
		expect(snap.playbook.background.options[0].markableActions.markedCount).toBe(1);
		expect(opts.find(o => o.slug === "act-b").checked).toBe(true);
		// At the level-1 limit, the unmarked options are disabled (but the marked one is not).
		expect(opts.find(o => o.slug === "act-a").disabled).toBe(true);
		expect(opts.find(o => o.slug === "act-b").disabled).toBe(false);
	});

	it("markableActions unlocks a second mark at 3rd level", async () => {
		const snap = await buildSnapAtLevel(3, {"background.markedActions": ["act-a"]});
		const markable = snap.playbook.background.options[0].markableActions;
		expect(markable.allowed).toBe(2);
		// One marked, one slot left → remaining option still selectable.
		expect(markable.options.find(o => o.slug === "act-b").disabled).toBe(false);
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
		expect(snap.playbook.origin.options[0].names.map(n => n.name)).toContain("Brakken");
	});

	it("origin.options includes setting overview descriptions", async () => {
		const snap = await buildSnap({"origin.selected": "Barrier Pass"});
		const origin = snap.playbook.origin.selectedOption;
		expect(origin.region).toBe("Barrier Pass");
		expect(origin.description).toContain("<p>");
		expect(origin.description).toContain("massive wall and gate");
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
		return {_id: id, name, system: {moveType: "basic", rollType}};
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

	it("labels basic move roll chips by stat, using ANY for ask-roll moves", async () => {
		const askMove = makeBasicMove("b1", "Defy Danger", "ask");
		const wisMove = makeBasicMove("b2", "Seek Insight", "wis");
		const noRollMove = makeBasicMove("b3", "Aid", null);
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.addBasicMove(askMove)
			.addBasicMove(wisMove)
			.addBasicMove(noRollMove)
			.build()
			.buildSnapshot();
		const labels = Object.fromEntries(snap.moves
			.find(c => c.key === "basic")
			.moves
			.map(move => [move.name, move.rollLabel]));

		expect(labels).toMatchObject({
			"Defy Danger": "ANY",
			"Seek Insight": "WIS",
			"Aid": null,
		});
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

	it("owned playbook moves are listed before unowned playbook moves", async () => {
		const actor =  new FakeActorBuilder()
			.withPlaybook("the-heavy", "The Heavy")
			.addItem({_id: "o1", type: "move", name: "Bravo", system: {moveType: "playbook"}})
			.build();
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(HEAVY_PLAYBOOK))
			.addPlaybookMove(makeMove("pm1", "Alpha"))
			.addPlaybookMove(makeMove("pm2", "Bravo"))
			.addPlaybookMove(makeMove("pm3", "Charlie"))
			.build().buildSnapshot();

		const names = snap.moves.find(c => c.key === "playbook").moves.map(m => m.name);
		expect(names).toEqual(["Bravo", "Alpha", "Charlie"]);
	});

	it("owned basic moves are listed before unowned basic moves", async () => {
		const actor =  new FakeActorBuilder()
			.addItem({_id: "o1", type: "move", name: "Defy Danger", system: {moveType: "basic"}})
			.build();
		const snap = await new TestCharacterBuilder(actor)
			.addBasicMove(makeBasicMove("b1", "Aid"))
			.addBasicMove(makeBasicMove("b2", "Defy Danger"))
			.build().buildSnapshot();

		const names = snap.moves.find(c => c.key === "basic").moves.map(m => m.name);
		expect(names).toEqual(["Defy Danger", "Aid"]);
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
	it("load.selected is derived from the marked ◇ (here the undefined pool)", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.regularPool", 7).build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.inventory.outfit.load.selected).toBe("heavy");
		expect(snap.inventory.outfit.load.totalMarks).toBe(7);
	});

	it("load.selected is derived from checked item weight", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.checked", {"big-load": true}).build();
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({slug: "big-load", weight: 5})]))
			.build().buildSnapshot();
		expect(snap.inventory.outfit.load.selected).toBe("normal");
		expect(snap.inventory.outfit.load.totalMarks).toBe(5);
	});

	it("load.selected is null when nothing is marked", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.build().buildSnapshot();
		expect(snap.inventory.outfit.load.selected).toBeNull();
		expect(snap.inventory.outfit.load.totalMarks).toBe(0);
	});

	it("flags an overloaded load when checked weight exceeds the heavy cap", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.checked", {"anvil": true}).build();
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({slug: "anvil", weight: 11})]))
			.build().buildSnapshot();
		expect(snap.inventory.outfit.load.selected).toBe("overloaded");
		expect(snap.inventory.outfit.load.loadLevelOverloaded).toBe(true);
		expect(snap.inventory.outfit.load.loadLevelHeavy).toBe(true);
	});

	it("regularPool current reflects the stored undefined ◇ pool, capped to the heavy cap", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.regularPool", 5).build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.inventory.outfit.regularPool).toMatchObject({current: 5, max: 9, title: null, labels: []});
	});

	it("regularPool always shows the full heavy cap of slots, regardless of checked item weight", async () => {
		const actor = new FakeActorBuilder()
			.withFlag("inventory.checked", {"big-load": true})
			.withFlag("inventory.regularPool", 7)
			.build();
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({slug: "big-load", weight: 6})]))
			.build().buildSnapshot();
		// The 9-◇ track never collapses: only 3 fit under the cap (so 3 stay filled), but
		// the row still shows all 9 — the rest render as empty ◇ rather than vanishing.
		expect(snap.inventory.outfit.regularPool).toMatchObject({current: 3, max: 9});
	});

	it("regularPool reserve drawn into an item shows as empty ◇, not a collapsed track", async () => {
		// Reserve was 7; checking a weight-4 item drew all 4 from it, leaving 3 stored.
		// The 4 drawn ◇ moved onto the item; the track still shows the full cap, so they
		// read as empty slots instead of disappearing.
		const actor = new FakeActorBuilder()
			.withFlag("inventory.checked", {"big-load": true})
			.withFlag("inventory.drawn", {"big-load": 4})
			.withFlag("inventory.regularPool", 3)
			.build();
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({slug: "big-load", weight: 4})]))
			.build().buildSnapshot();
		expect(snap.inventory.outfit.regularPool).toMatchObject({current: 3, max: 9});
	});

	it("regularPool keeps the full track as loot fills it, with the cap reporting room left", async () => {
		// Weight-6 item leaves only 3 ◇ of room under the cap. The track still shows all 9
		// (current 3 filled, the rest empty); the reservable ceiling (cap) is the room left.
		const actor = new FakeActorBuilder()
			.withFlag("inventory.checked", {"big-load": true})
			.withFlag("inventory.regularPool", 3)
			.build();
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({slug: "big-load", weight: 6})]))
			.build().buildSnapshot();
		expect(snap.inventory.outfit.regularPool).toMatchObject({current: 3, max: 9});
		// The cap is the room left under the load limit (3) — clicking an empty slot past
		// it is what the "at your limit" toast guards.
		expect(snap.inventory.outfit.regularPoolCap).toBe(3);
	});

	it("regularPool stays at the heavy cap when overloaded (no 10th ◇ without Pack Horse)", async () => {
		// Overloaded by a heavy item: no room for any reserve (current 0), but the track
		// still shows the full 9-◇ capacity — all empty — rather than collapsing or growing.
		const actor = new FakeActorBuilder()
			.withFlag("inventory.checked", {"anvil": true})
			.build();
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({slug: "anvil", weight: 11})]))
			.build().buildSnapshot();
		expect(snap.inventory.outfit.load.selected).toBe("overloaded");
		expect(snap.inventory.outfit.regularPool).toMatchObject({current: 0, max: 9});
	});

	it("Pack Horse raises the ◇ track to 10", async () => {
		const actor = new FakeActorBuilder()
			.addItem({type: "move", name: "Pack Horse", system: {moveType: "playbook", loadBonus: 1}})
			.build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.inventory.outfit.regularPool.max).toBe(10);
	});

	it("smallPool always shows exactly the 4+Prosperity allotment of boxes", async () => {
		// Marking small items never collapses the track: it stays at the full allotment,
		// with marked items' boxes rendering as empties rather than vanishing.
		const actor = new FakeActorBuilder()
			.withFlag("inventory.checked", {"trinket": true})
			.build();
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({slug: "trinket", inventoryColumn: "small"})]))
			.build().buildSnapshot();
		expect(snap.inventory.outfit.smallPool.max).toBe(9); // default 4+Prosperity allotment
	});

	it("pool caps report the room left under the load limit for the at-limit toast", async () => {
		const actor = new FakeActorBuilder()
			.withFlag("inventory.checked", {"big-load": true})
			.withFlag("inventory.smallPool", 2)
			.build();
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({slug: "big-load", weight: 6})]))
			.build().buildSnapshot();
		expect(snap.inventory.outfit.regularPoolCap).toBe(3); // 9 heavy − 6 marked weight
		expect(snap.inventory.outfit.smallPoolCap).toBe(9);   // no small items marked
	});

	it("smallPool has unified resource shape", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.smallPool", 0).build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.inventory.outfit.smallPool).toMatchObject({current: 0, max: 9, title: null, labels: []});
	});

	it("uses base load caps and hasPackHorse=false when the Pack Horse move isn't owned", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build()).build().buildSnapshot();
		expect(snap.inventory.outfit.hasPackHorse).toBe(false);
		expect(snap.inventory.outfit.loadLimits).toEqual({light: 3, normal: 6, heavy: 9});
		expect(snap.inventory.outfit.regularPool.max).toBe(9);
	});

	it("raises the load caps by one when the Pack Horse move is owned", async () => {
		const actor = new FakeActorBuilder()
			.addItem({type: "move", name: "Pack Horse", system: {moveType: "playbook", loadBonus: 1}})
			.build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.inventory.outfit.hasPackHorse).toBe(true);
		expect(snap.inventory.outfit.loadLimits).toEqual({light: 4, normal: 7, heavy: 10});
		expect(snap.inventory.outfit.regularPool.max).toBe(10);
	});

	it("with Pack Horse, 4 marked ◇ still reads as a light load", async () => {
		const actor = new FakeActorBuilder()
			.withFlag("inventory.regularPool", 4)
			.addItem({type: "move", name: "Pack Horse", system: {moveType: "playbook", loadBonus: 1}})
			.build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.inventory.outfit.regularPool.current).toBe(4);
		expect(snap.inventory.outfit.load.selected).toBe("light");
	});

	it("a shield costs its full 2 ◇ without the Armored move", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.withInventoryRepo(new FakeInventoryRepository([
				makeOutfitItem({ slug: "shield", name: "Shield", weight: 2 }),
			]))
			.build().buildSnapshot();
		const shield = snap.inventory.outfit.regularItems.find(i => i.slug === "shield");
		expect(shield.weight).toBe(2);
	});

	it("Armored drops a carried shield from 2 ◇ to 1 ◇", async () => {
		const actor = new FakeActorBuilder()
			.addItem({type: "move", name: "Armored", system: {moveType: "playbook", shieldLoadReduction: 1}})
			.build();
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([
				makeOutfitItem({ slug: "shield", name: "Shield", weight: 2 }),
			]))
			.build().buildSnapshot();
		const shield = snap.inventory.outfit.regularItems.find(i => i.slug === "shield");
		expect(shield.weight).toBe(1);
	});

	it("Armored only reduces the shield, not other carried items", async () => {
		const actor = new FakeActorBuilder()
			.addItem({type: "move", name: "Armored", system: {moveType: "playbook", shieldLoadReduction: 1}})
			.build();
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([
				makeOutfitItem({ slug: "cart", name: "Cart", weight: 2 }),
			]))
			.build().buildSnapshot();
		const cart = snap.inventory.outfit.regularItems.find(i => i.slug === "cart");
		expect(cart.weight).toBe(2);
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
		// The title is rendered as the italic `usesLabel` in the possessions block,
		// so it's left off the resource to avoid the resource-track partial drawing
		// a duplicate label next to it.
		expect(pouch.resource.title).toBeNull();
		expect(pouch.usesLabel).toBe("Stock");
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

	it("resolves a possession's \"x piercing\" against the steading's Prosperity", async () => {
		// The composite bow's piercing scales with Stonetop's Prosperity (Book I p.94):
		// the sheet shows the resolved value (capped at 2), while a null steading keeps
		// the literal "x" — onboarding renders that raw playbook description directly.
		const char = new TestCharacterBuilder(makeHeavyActor()).build();
		const sp = {
			pickNote: "Pick 1", pickCount: 1, preselected: ["composite-bow"],
			options: [{
				slug: "composite-bow", label: "Composite bow",
				description: "<em>far</em>, +1 damage, x <em>piercing</em>",
			}],
		};
		const descFor = (prosperity) =>
			char._buildPossessionsSnapshot(sp, {}, prosperity).items[0].description;
		expect(descFor(1)).toBe("<em>far</em>, +1 damage, 1 <em>piercing</em>");
		expect(descFor(5)).toBe("<em>far</em>, +1 damage, 2 <em>piercing</em>"); // capped at 2
		expect(descFor(null)).toBe("<em>far</em>, +1 damage, x <em>piercing</em>"); // no steading
	});

	it("appends write-in custom possessions as selected, removable items", async () => {
		const actor = makeHeavyActor({
			flags: {"possessions.custom": [{slug: "custom-1", label: "A locket"}]}
		});
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository({
				...HEAVY_PLAYBOOK,
				specialPossessions: SP
			})).build().buildSnapshot();
		const custom = snap.inventory.possessions.items.find(i => i.slug === "custom-1");
		expect(custom.label).toBe("A locket");
		expect(custom.isCustom).toBe(true);
		expect(custom.selected).toBe(true);
		expect(custom.checked).toBe(true);
		// Disabled so it can't be unchecked — it's removed via the × button instead.
		expect(custom.disabled).toBe(true);
	});

	it("listed possessions report isCustom false", async () => {
		const actor = makeHeavyActor({flags: {"possessions.selected": ["apiary"]}});
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository({
				...HEAVY_PLAYBOOK,
				specialPossessions: SP
			})).build().buildSnapshot();
		expect(snap.inventory.possessions.items.find(i => i.slug === "apiary").isCustom).toBe(false);
	});

	it("write-in possessions count toward the pick budget", async () => {
		// SP needs 2 non-preselected picks; one listed + one write-in fills it.
		const actor = makeHeavyActor({
			flags: {
				"possessions.selected": ["apiary"],
				"possessions.custom": [{slug: "custom-1", label: "A locket"}],
			}
		});
		const snap = await new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository({
				...HEAVY_PLAYBOOK,
				specialPossessions: SP
			})).build().buildSnapshot();
		expect(snap.inventory.possessions.isIncomplete).toBe(false);
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

	it("lore.hasSelection is false when no lore options are selected", async () => {
		const snap = await buildSnap();
		expect(snap.playbook.lore.hasSelection).toBe(false);
	});

	it("lore.hasSelection is true when any lore option is selected", async () => {
		const snap = await buildSnap({ "lore.counts": { "the-earth-mother:shrine-loved": 1 } });
		expect(snap.playbook.lore.hasSelection).toBe(true);
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

	const CHRONICLE_LORE_PLAYBOOK = {
		...HEAVY_PLAYBOOK,
		lore: [
			{
				slug: "chronicle",
				title: "The Chronicle",
				description: "<p>The Chronicle is a physical place. On the plus side, it\u2026 <em>(choose 3)</em></p>",
				options: [
					{ slug: "vast",   description: "\u2026 is vast.",   max: 1 },
					{ slug: "secure", description: "\u2026 is secure.", max: 1 },
					{ slug: "known",  description: "\u2026 is known.",  max: 1 },
				],
			},
			{
				slug: "chronicle-alas",
				title: "But Alas, It\u2026",
				description: "<p><em>(choose 2)</em></p>",
				options: [
					{ slug: "damp", description: "... is damp.", max: 1 },
					{ slug: "dark", description: "... is dark.", max: 1 },
				],
			},
		],
	};

	async function buildChronicleSnap(flags = {}) {
		const actor = new FakeActorBuilder()
			.withPlaybook("the-heavy", "The Heavy")
			.withFlags(flags)
			.build();
		return new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(CHRONICLE_LORE_PLAYBOOK))
			.build().buildSnapshot();
	}

	it("completed lore entries expose readonly descriptions without choose prompts", async () => {
		const snap = await buildChronicleSnap({
			"lore.counts": {
				"chronicle:vast": 1,
				"chronicle:secure": 1,
				"chronicle:known": 1,
				"chronicle-alas:damp": 1,
				"chronicle-alas:dark": 1,
			},
		});
		const [positive, negative] = snap.playbook.lore.entries;
		expect(positive.readonlyDescription).toBe("<p>The Chronicle is a physical place. On the plus side, it\u2026</p>");
		expect(negative.readonlyDescription).toBe("");
	});

	it("readonly lore descriptions omit choose prompts even before all picks are made", async () => {
		const snap = await buildChronicleSnap({
			"lore.counts": {
				"chronicle:vast": 1,
			},
		});
		expect(snap.playbook.lore.entries[0].isAnswered).toBe(false);
		expect(snap.playbook.lore.entries[0].readonlyDescription).toBe("<p>The Chronicle is a physical place. On the plus side, it\u2026</p>");
	});

	it("readonly lore options strip leading ellipses and mark positive and negative entries", async () => {
		const snap = await buildChronicleSnap({
			"lore.counts": {
				"chronicle:vast": 1,
				"chronicle-alas:damp": 1,
			},
		});
		const [positive, negative] = snap.playbook.lore.entries;
		expect(positive.readonlyMarker).toBe("+");
		expect(positive.options[0].readonlyDescription).toBe("is vast.");
		expect(negative.readonlyMarker).toBe("-");
		expect(negative.options[0].readonlyDescription).toBe("is damp.");
	});

	it("uses the spiral marker for lore entries that are not plus or alas topics", async () => {
		const snap = await buildSnap({ "lore.counts": { "the-earth-mother:shrine-loved": 1 } });
		expect(snap.playbook.lore.entries[0].readonlyMarker).toBe("spiral");
	});

	it("marks alas lore entries as continuations of the previous topic", async () => {
		const snap = await buildChronicleSnap();
		const [positive, negative] = snap.playbook.lore.entries;
		expect(positive.isContinuation).toBe(false);
		expect(negative.isContinuation).toBe(true);
	});

	const LAWKEEPER_LORE_PLAYBOOK = {
		...HEAVY_PLAYBOOK,
		lore: [
			{
				slug: "lawkeeper-shrine",
				title: "The Lawkeeper",
				description: "<p>Aratis's shrine is... <em>(pick 1)</em></p>",
				options: [
					{ slug: "shrine-hub", description: "... a hub of the community.", max: 1 },
				],
			},
			{
				slug: "lawkeeper-demands",
				title: "Of Her True Disciples, Aratis Demands...",
				description: "<p><em>(choose 3)</em></p>",
				options: [
					{ slug: "truth", description: "... truth, honesty, and forthrightness.", max: 1 },
				],
			},
		],
	};

	async function buildLoreSnap(lorePlaybook, flags = {}) {
		const actor = new FakeActorBuilder()
			.withPlaybook("the-heavy", "The Heavy")
			.withFlags(flags)
			.build();
		return new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(lorePlaybook))
			.build().buildSnapshot();
	}

	it("marks Aratis demands lore entries as continuations of the Lawkeeper topic", async () => {
		const snap = await buildLoreSnap(LAWKEEPER_LORE_PLAYBOOK);
		const [lawkeeper, demands] = snap.playbook.lore.entries;
		expect(lawkeeper.isContinuation).toBe(false);
		expect(demands.isContinuation).toBe(true);
		expect(demands.readonlyMarker).toBe("spiral");
	});

	const PDF_CONTINUATION_LORE_PLAYBOOK = {
		...HEAVY_PLAYBOOK,
		lore: [
			{
				slug: "earth-mother",
				title: "The Earth Mother",
				description: "<p>Danu's shrine is... <em>(choose 1)</em></p>",
				options: [{ slug: "loved", description: "... loved.", max: 1 }],
			},
			{
				slug: "offerings",
				title: "Offerings to Danu",
				description: "<p><em>(choose 2-3)</em></p>",
				options: [{ slug: "fruit", description: "Fruits of harvest.", max: 1 }],
			},
			{
				slug: "tall-tale-end",
				title: "And You Ended Up...",
				description: "<p><em>(choose 1 or 2 per tale)</em></p>",
				options: [{ slug: "running", description: "... running for your life.", max: 1 }],
			},
			{
				slug: "tall-tale-left",
				title: "But All You've Got Left to Show for It Is...",
				description: "",
				options: [{ slug: "scar", description: "... a nasty scar.", max: 1 }],
			},
			{
				slug: "violence-shadow",
				title: "But Folks Are Less Keen to Discuss...",
				description: "<p><em>(pick 1 or 2)</em></p>",
				options: [{ slug: "look", description: "... the look in your eye.", max: 1 }],
			},
			{
				slug: "violence-fears",
				title: "What Keeps You Up at Night?",
				description: "<p><em>(pick 1 or 2)</em></p>",
				options: [{ slug: "temper", description: "That temper.", max: 1 }],
			},
			{
				slug: "helior-practice",
				title: "He Is Worshipped Through...",
				description: "<p><em>(choose 1 or 2)</em></p>",
				options: [{ slug: "hymns", description: "... solemn hymns.", max: 1 }],
			},
			{
				slug: "helior-shrine",
				title: "In Stonetop's Pavilion of the Gods, Helior's Shrine Has...",
				description: "<p><em>(choose 1)</em></p>",
				options: [{ slug: "honor", description: "... the place of highest honor.", max: 1 }],
			},
			{
				slug: "lightbearer-predecessor",
				title: "Your Predecessor, the Previous Lightbearer...",
				description: "<p><em>(choose 2 or 3)</em></p>",
				options: [{ slug: "legend", description: "... lived long ago.", max: 1 }],
			},
			{
				slug: "lightbearer-powers",
				title: "You Came Into Your Powers...",
				description: "<p><em>(choose 1)</em></p>",
				options: [{ slug: "study", description: "... through years of study.", max: 1 }],
			},
			{
				slug: "war-questions",
				title: "Answer At Least 3 of the Following",
				description: "",
				options: [{ slug: "when", description: "When did it happen?", max: 1 }],
			},
			{
				slug: "anger",
				title: "What Makes You Burn with Righteous Anger?",
				description: "<p><em>(choose 2, maybe 3)</em></p>",
				options: [{ slug: "injustice", description: "Injustice.", max: 1 }],
			},
			{
				slug: "fear-story",
				title: "When Did Your Fear or Anger Last Cause You Trouble?",
				description: "",
				options: [{ slug: "when", description: "When did it happen?", max: 1 }],
			},
		],
	};

	it("marks other PDF subprompts as continuations of their playbook topic", async () => {
		const snap = await buildLoreSnap(PDF_CONTINUATION_LORE_PLAYBOOK);
		const entries = snap.playbook.lore.entries;
		expect(entries[0].isContinuation).toBe(false);
		expect(entries.slice(1).every(e => e.isContinuation)).toBe(true);
	});

	// Mirrors the Marshal/Ranger "War Stories" shape: a (choose 1) entry followed by
	// an "Answer at least 3…" text-question entry flagged readonlyMerge.
	const READONLY_MERGE_LORE_PLAYBOOK = {
		...HEAVY_PLAYBOOK,
		lore: [
			{ slug: "war-stories", title: "War Stories", description: "", options: [] },
			{
				slug: "war-stories-action",
				continuation: true,
				title: "The Last Time the Militia Saw Serious Action, It Was…",
				description: "<p><em>(pick 1)</em></p>",
				options: [{ slug: "bandits", description: "… to drive off bandits.", max: 1 }],
			},
			{
				slug: "war-stories-questions",
				continuation: true,
				columnBreak: true,
				readonlyMerge: true,
				title: "Answer At Least 3 of the Following",
				description: "",
				options: [{ slug: "when", description: "When did it happen?", type: "text" }],
			},
		],
	};

	it("readonlyMerge entry keeps its edit-mode column break but collapses it read-only", async () => {
		const snap = await buildLoreSnap(READONLY_MERGE_LORE_PLAYBOOK);
		const questions = snap.playbook.lore.entries[2];
		expect(questions.readonlyMerge).toBe(true);
		expect(questions.columnBreak).toBe(true);        // edit mode still two-column
		expect(questions.readonlyColumnBreak).toBe(false); // read-only merges in
	});

	it("a section whose only break is merged renders single-column read-only", async () => {
		const snap = await buildLoreSnap(READONLY_MERGE_LORE_PLAYBOOK);
		expect(snap.playbook.lore.hasColumnBreak).toBe(true);
		expect(snap.playbook.lore.hasReadonlyColumnBreak).toBe(false);
	});

	it("a subheader column break is preserved read-only (not merged)", async () => {
		const snap = await buildLoreSnap({
			...HEAVY_PLAYBOOK,
			lore: [
				{ slug: "collection", title: "Collection", description: "", options: [] },
				{
					slug: "arcana-minor",
					continuation: true,
					columnBreak: true,
					subheader: true,
					title: "Minor Arcana",
					description: "",
					options: [{ slug: "where", description: "Where?", type: "text" }],
				},
			],
		});
		const minor = snap.playbook.lore.entries[1];
		expect(minor.readonlyColumnBreak).toBe(true);
		expect(snap.playbook.lore.hasReadonlyColumnBreak).toBe(true);
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

	it("normalizes legacy default rollMode to normal", async () => {
		const actor = new FakeActorBuilder().withRollMode("def").build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.rollMode).toBe("normal");
	});
});
describe("buildSnapshot - homefront moves", () => {
	it("normalizes object rollType values before rendering", async () => {
		const actor = new FakeActorBuilder()
			.addItem({
				_id: "h1",
				type: "move",
				name: "Pull Together",
				system: { moveType: "homefront", rollType: { value: "ask", label: "Ask" } },
			})
			.build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		const homefront = snap.moves.find(category => category.key === "homefront");

		expect(homefront.moves[0].rollType).toBe("ask");
		expect(homefront.moves[0].rollLabel).toBe("Population");
	});
});

// ── manual overrides (Classic-sheet parity with Taylor's editable vitals / load) ──
// A non-null flags.stonetop.overrides.* value wins over the fork's computed default; null/absent
// falls back to compute. These guard the override layer that makes the Classic sheet's max-HP / armor /
// damage / load EDITABLE and the edit the EFFECTIVE value (used everywhere the snapshot is read).

describe("buildSnapshot — manual overrides", () => {
	it("maxHp override beats the computed playbook max", async () => {
		const actor = new FakeActorBuilder()
			.withPlaybook("the-heavy", "The Heavy").withHp(12, 99)
			.withFlag("overrides", {maxHp: 7})
			.build();
		const snap = await new TestCharacterBuilder(actor).addPlaybook(HEAVY_PLAYBOOK).build().buildSnapshot();
		expect(snap.vitals.hp.max).toBe(7);   // not the computed 20
		expect(snap.vitals.hp.value).toBe(12);
	});

	it("maxHp override surfaces even with no playbook (hp.value preserved)", async () => {
		const actor = new FakeActorBuilder().withHp(3, 0).withFlag("overrides", {maxHp: 8}).build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.vitals.hp).toMatchObject({value: 3, max: 8});
	});

	it("armor override beats the computed worn-item armor", async () => {
		const actor = new FakeActorBuilder()
			.withFlag("inventory.checked", {"thick-hides": true})
			.withFlag("overrides", {armor: 5})
			.build();
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({slug: "thick-hides", armor: {base: 1}})]))
			.build().buildSnapshot();
		expect(snap.vitals.armor).toBe(5);   // not the computed 1
	});

	it("armor override of 0 is honored (distinct from absent)", async () => {
		const actor = new FakeActorBuilder()
			.withFlag("inventory.checked", {"thick-hides": true})
			.withFlag("overrides", {armor: 0})
			.build();
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({slug: "thick-hides", armor: {base: 2}})]))
			.build().buildSnapshot();
		expect(snap.vitals.armor).toBe(0);   // not the computed 2
	});

	it("damage override beats the computed playbook die", async () => {
		const actor = new FakeActorBuilder()
			.withPlaybook("the-heavy", "The Heavy").withFlag("overrides", {damage: "d4"}).build();
		const snap = await new TestCharacterBuilder(actor).addPlaybook(HEAVY_PLAYBOOK).build().buildSnapshot();
		expect(snap.vitals.damage).toBe("d4");   // not the playbook d10
	});

	it("damage override surfaces even with no playbook", async () => {
		const actor = new FakeActorBuilder().withFlag("overrides", {damage: "d6"}).build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.vitals.damage).toBe("d6");   // computed would be null
	});

	it("loadLevel override beats the weight-derived level (real marks preserved)", async () => {
		const actor = new FakeActorBuilder()
			.withFlag("inventory.checked", {"big-load": true})   // 5 weight => derives "normal"
			.withFlag("overrides", {loadLevel: "heavy"})
			.build();
		const snap = await new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({slug: "big-load", weight: 5})]))
			.build().buildSnapshot();
		expect(snap.inventory.outfit.load.selected).toBe("heavy");
		expect(snap.inventory.outfit.load.loadLevelHeavy).toBe(true);
		expect(snap.inventory.outfit.load.loadLevelNormal).toBe(false);
		expect(snap.inventory.outfit.load.totalMarks).toBe(5);   // the diamonds still show the real marks
	});

	it("absent overrides fall back to the computed defaults", async () => {
		const actor = new FakeActorBuilder()
			.withPlaybook("the-heavy", "The Heavy").withHp(12, 0)
			.withFlag("inventory.checked", {"shield": true})
			.build();
		const snap = await new TestCharacterBuilder(actor).addPlaybook(HEAVY_PLAYBOOK)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({slug: "shield", armor: {modifier: 1}})]))
			.build().buildSnapshot();
		expect(snap.vitals.hp.max).toBe(20);   // computed playbook max
		expect(snap.vitals.armor).toBe(1);     // computed item armor
		expect(snap.vitals.damage).toBe("d10");// computed playbook die
	});
});
