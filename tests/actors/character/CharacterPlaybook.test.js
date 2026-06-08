import { describe, it, expect } from "vitest";
import { CharacterPlaybook } from "../../../src/actors/character/CharacterPlaybook.js";
import { ChoiceGroup } from "../../../src/model/snapshot/character/ChoiceGroup.js";
import { PlaybookSnapshot } from "../../../src/model/snapshot/character/CharacterSnapshot.js";
import { IntroductionsSnapshot } from "../../../src/model/snapshot/character/PlaybookSnapshot.js";
import { ChoiceGroupFactory } from "../../../src/actors/character/ChoiceGroupFactory.js";
import { FakeMoves } from "../../fakes/FakeMoves.js";
import { FakeVitals } from "../../fakes/FakeVitals.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { TestPlaybookItemBuilder } from "../../fakes/TestPlaybookItemBuilder.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeActor(playbookSlug = "the-blessed", items = []) {
	return new FakeActorBuilder().withPlaybook(playbookSlug).withItems(items).build();
}

class FakeBackground {
	_selectedSlug;
	constructor(selectedSlug = "") { this._selectedSlug = selectedSlug; }
	get selectedSlug()              { return this._selectedSlug; }
	async selectBackground(slug)    { this._selectedSlug = slug; }
	async buildSnapshot()           { return null; }
}

class FakeOrigin {
	buildSnapshot(data) { return data; }
}

function makePlaybook(actor, { background = new FakeBackground() } = {}) {
	const factory = new ChoiceGroupFactory(actor);
	return new CharacterPlaybook(actor, background, factory, new FakeOrigin());
}

const INSTINCT_GROUP = { slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [
	{ slug: "delight", text: "Delight", description: "To find beauty." },
	{ slug: "nurture", text: "Nurture", description: "To help others." },
]}]};

const APPEARANCE_GROUP = { slug: "appearance", list: [
	{ type: "pick", pickCount: 1, inline: true, options: [
		{ slug: "fresh-faced", text: "fresh-faced" },
		{ slug: "wizened", text: "wizened" },
	]},
]};

const LORE_GROUP = { slug: "lore-1", list: [
	{ type: "entry", content: { title: "Lore", text: "Some lore." } },
	{ type: "entry", slug: "shrine-loved", content: { title: null, text: "Loved shrine." }, track: { max: 1 } },
]};

const NPC_GROUP = { slug: "intro-npc", list: [
	{ slug: "closest-kin", type: "entry", content: { title: null, text: "Who is your closest kin?" }, track: { max: 1 } },
	{ slug: "heart-soul",  type: "entry", content: { title: null, text: "Whose heart is entwined with yours?" }, track: { max: 1 } },
]};
const PC_GROUP = { slug: "intro-pc", list: [
	{ slug: "spirits", type: "entry", content: { title: null, text: "Which one of you do the spirits whisper of?" }, track: { max: 1 } },
]};
const INTRO = { step3: "On your third turn, describe your sacred pouch.", step4: NPC_GROUP, step6: PC_GROUP };

const PLAYBOOK_ITEM = new TestPlaybookItemBuilder()
	.withSlug("the-blessed")
	.withName("The Blessed")
	.withImg("img.webp")
	.withDescription("<p>A healer.</p>")
	.withStatsNote("Assign +2/+1/+1/0/0/-1")
	.withBackgrounds([
		{ slug: "herbalist", moves: ["healing-touch"] },
		{ slug: "vessel",    moves: ["channel"] },
	])
	.withInstinct(INSTINCT_GROUP)
	.withAppearance(APPEARANCE_GROUP)
	.withChoices([LORE_GROUP])
	.withOrigin([{ region: "The Reach", names: ["Aldric"] }])
	.build();

const PLAYBOOK_DATA = { ...PLAYBOOK_ITEM.system, name: PLAYBOOK_ITEM.name, img: PLAYBOOK_ITEM.img };

// ── getData ───────────────────────────────────────────────────────────────────

describe("CharacterPlaybook.getData", () => {
	it("returns null when actor has no playbook item in actor.items", async () => {
		const actor = new FakeActorBuilder().build();
		expect(await makePlaybook(actor).getData()).toBeNull();
	});

	it("returns playbook data from embedded item when present", async () => {
		const data = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM])).getData();
		expect(data).not.toBeNull();
		expect(data.slug).toBe("the-blessed");
	});

	it("includes name and img from item top-level fields", async () => {
		const data = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM])).getData();
		expect(data.name).toBe("The Blessed");
		expect(data.img).toBe("img.webp");
	});

	it("includes system fields like backgrounds, instinct, appearance and choices", async () => {
		const data = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM])).getData();
		expect(data.backgrounds).toEqual(PLAYBOOK_ITEM.system.backgrounds);
		expect(data.instinct).toEqual(PLAYBOOK_ITEM.system.instinct);
		expect(data.appearance).toEqual(PLAYBOOK_ITEM.system.appearance);
		expect(data.choices).toEqual(PLAYBOOK_ITEM.system.choices);
	});
});

// ── buildPlaybookSnapshot ─────────────────────────────────────────────────────

describe("CharacterPlaybook.buildPlaybookSnapshot", () => {
	it("returns null when no playbook item in actor.items", async () => {
		const actor = new FakeActorBuilder().build();
		expect(await makePlaybook(actor).buildPlaybookSnapshot()).toBeNull();
	});

	it("returns a PlaybookSnapshot", async () => {
		const snap = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM])).buildPlaybookSnapshot();
		expect(snap).toBeInstanceOf(PlaybookSnapshot);
	});

	it("snapshot has correct slug, name, img, description, statsNote", async () => {
		const snap = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM])).buildPlaybookSnapshot();
		expect(snap.slug).toBe("the-blessed");
		expect(snap.name).toBe("The Blessed");
		expect(snap.img).toBe("img.webp");
		expect(snap.description).toBe("<p>A healer.</p>");
		expect(snap.statsNote).toBe("Assign +2/+1/+1/0/0/-1");
	});

	it("snapshot.instinctGroup is a ChoiceGroup built from item.system.instinct", async () => {
		const snap = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM])).buildPlaybookSnapshot();
		expect(snap.instinctGroup).toBeInstanceOf(ChoiceGroup);
		expect(snap.instinctGroup.slug).toBe("instinct");
	});

	it("snapshot.choices contains lore ChoiceGroups from item.system.choices (not appearance)", async () => {
		const snap = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM])).buildPlaybookSnapshot();
		expect(snap.choices).toHaveLength(1);
		expect(snap.choices[0]).toBeInstanceOf(ChoiceGroup);
		expect(snap.choices[0].slug).toBe("lore-1");
	});

	it("snapshot.instinctSelected is null when no instinct value saved", async () => {
		const snap = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM])).buildPlaybookSnapshot();
		expect(snap.instinctSelected).toBeNull();
	});

	it("snapshot.instinctSelected reflects the checked option label", async () => {
		const item = new TestPlaybookItemBuilder()
			.withSlug("the-blessed").withName("The Blessed")
			.withInstinct(INSTINCT_GROUP)
			.withChoiceValues({ instinct: { delight: 1 } })
			.build();
		const snap = await makePlaybook(makeActor("the-blessed", [item])).buildPlaybookSnapshot();
		expect(snap.instinctSelected).toBe("Delight — To find beauty.");
	});

	it("snapshot.instinctSelected reflects custom text when stored under __custom", async () => {
		const item = new TestPlaybookItemBuilder()
			.withSlug("the-blessed").withName("The Blessed")
			.withInstinct(INSTINCT_GROUP)
			.withChoiceValues({ instinct: { __custom: "my custom instinct" } })
			.build();
		const snap = await makePlaybook(makeActor("the-blessed", [item])).buildPlaybookSnapshot();
		expect(snap.instinctSelected).toBe("my custom instinct");
	});

	it("snapshot.instinctGroup is null when playbook has no instinct definition", async () => {
		const item = new TestPlaybookItemBuilder().withSlug("the-blessed").withName("The Blessed").build();
		const snap = await makePlaybook(makeActor("the-blessed", [item])).buildPlaybookSnapshot();
		expect(snap.instinctGroup).toBeNull();
	});

	it("snapshot.choices is empty when playbook has no choices", async () => {
		const item = new TestPlaybookItemBuilder().withSlug("the-blessed").withName("The Blessed").build();
		const snap = await makePlaybook(makeActor("the-blessed", [item])).buildPlaybookSnapshot();
		expect(snap.choices).toHaveLength(0);
	});

	it("snapshot.appearanceGroup is built from system.appearance", async () => {
		const snap = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM])).buildPlaybookSnapshot();
		expect(snap.appearanceGroup).toBeInstanceOf(ChoiceGroup);
		expect(snap.appearanceGroup.slug).toBe("appearance");
	});

	it("snapshot.loreGroups contains all choices from system.choices", async () => {
		const snap = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM])).buildPlaybookSnapshot();
		expect(snap.loreGroups).toHaveLength(1);
		expect(snap.loreGroups[0].slug).toBe("lore-1");
	});

	it("snapshot.appearanceGroup is null when system.appearance is not defined", async () => {
		const item = new TestPlaybookItemBuilder()
			.withSlug("the-blessed").withName("The Blessed")
			.withChoices([LORE_GROUP])
			.build();
		const snap = await makePlaybook(makeActor("the-blessed", [item])).buildPlaybookSnapshot();
		expect(snap.appearanceGroup).toBeNull();
	});

	it("snapshot.loreGroups is empty when system.choices is empty", async () => {
		const item = new TestPlaybookItemBuilder()
			.withSlug("the-blessed").withName("The Blessed")
			.withAppearance(APPEARANCE_GROUP)
			.build();
		const snap = await makePlaybook(makeActor("the-blessed", [item])).buildPlaybookSnapshot();
		expect(snap.loreGroups).toHaveLength(0);
	});

	it("snapshot.introductions is null when no introductions defined", async () => {
		const item = new TestPlaybookItemBuilder().withSlug("the-blessed").withName("The Blessed").build();
		const snap = await makePlaybook(makeActor("the-blessed", [item])).buildPlaybookSnapshot();
		expect(snap.introductions).toBeNull();
	});

	it("snapshot.introductions is an IntroductionsSnapshot when defined", async () => {
		const item = new TestPlaybookItemBuilder().withIntroductions(INTRO).build();
		const snap = await makePlaybook(makeActor("the-blessed", [item])).buildPlaybookSnapshot();
		expect(snap.introductions).toBeInstanceOf(IntroductionsSnapshot);
	});

	it("snapshot.introductions.step3 holds the playbook-specific text", async () => {
		const item = new TestPlaybookItemBuilder().withIntroductions(INTRO).build();
		const snap = await makePlaybook(makeActor("the-blessed", [item])).buildPlaybookSnapshot();
		expect(snap.introductions.step3).toBe("On your third turn, describe your sacred pouch.");
	});

	it("snapshot.introductions.npcGroup is a ChoiceGroup with slug intro-npc", async () => {
		const item = new TestPlaybookItemBuilder().withIntroductions(INTRO).build();
		const snap = await makePlaybook(makeActor("the-blessed", [item])).buildPlaybookSnapshot();
		expect(snap.introductions.npcGroup).toBeInstanceOf(ChoiceGroup);
		expect(snap.introductions.npcGroup.slug).toBe("intro-npc");
	});

	it("snapshot.introductions.pcGroup is a ChoiceGroup with slug intro-pc", async () => {
		const item = new TestPlaybookItemBuilder().withIntroductions(INTRO).build();
		const snap = await makePlaybook(makeActor("the-blessed", [item])).buildPlaybookSnapshot();
		expect(snap.introductions.pcGroup).toBeInstanceOf(ChoiceGroup);
		expect(snap.introductions.pcGroup.slug).toBe("intro-pc");
	});

	it("snapshot.introductions.npcGroup reflects checked state from choiceValues", async () => {
		const item = new TestPlaybookItemBuilder()
			.withIntroductions(INTRO)
			.withChoiceValues({ "intro-npc": { "closest-kin": 1 } })
			.build();
		const snap = await makePlaybook(makeActor("the-blessed", [item])).buildPlaybookSnapshot();
		const row = snap.introductions.npcGroup.list.find(r => r.slug === "closest-kin");
		expect(row.track.checks[0]).toBe(true);
	});
});

// ── selectChoice ──────────────────────────────────────────────────────────────

describe("CharacterPlaybook.selectChoice", () => {
	it("persists the pick selection on the playbook item choiceValues", async () => {
		const actor = makeActor("the-blessed", [PLAYBOOK_ITEM]);
		const pb = makePlaybook(actor);
		await pb.selectChoice("instinct", "delight", "delight,nurture");
		const snap = await pb.buildPlaybookSnapshot();
		expect(snap.instinctGroup.list[0].options.find(o => o.slug === "delight").checked).toBe(true);
	});

	it("clears __custom text when an instinct option is selected", async () => {
		const item = new TestPlaybookItemBuilder()
			.withSlug("the-blessed").withName("The Blessed")
			.withInstinct(INSTINCT_GROUP)
			.withChoiceValues({ instinct: { __custom: "old custom" } })
			.build();
		const actor = makeActor("the-blessed", [item]);
		const pb = makePlaybook(actor);
		await pb.selectChoice("instinct", "delight", "delight,nurture");
		const snap = await pb.buildPlaybookSnapshot();
		expect(snap.instinctSelected).toBe("Delight — To find beauty.");
	});
});

// ── selectCustomInstinct ──────────────────────────────────────────────────────

describe("CharacterPlaybook.selectCustomInstinct", () => {
	it("stores custom text under instinct.__custom", async () => {
		const actor = makeActor("the-blessed", [PLAYBOOK_ITEM]);
		const pb = makePlaybook(actor);
		await pb.selectCustomInstinct("to protect the village");
		const snap = await pb.buildPlaybookSnapshot();
		expect(snap.instinctSelected).toBe("to protect the village");
	});

	it("clears any existing pick selection", async () => {
		const item = new TestPlaybookItemBuilder()
			.withSlug("the-blessed").withName("The Blessed")
			.withInstinct(INSTINCT_GROUP)
			.withChoiceValues({ instinct: { delight: 1 } })
			.build();
		const actor = makeActor("the-blessed", [item]);
		const pb = makePlaybook(actor);
		await pb.selectCustomInstinct("to protect");
		const snap = await pb.buildPlaybookSnapshot();
		const opts = snap.instinctGroup.list[0].options;
		expect(opts.every(o => !o.checked)).toBe(true);
	});
});

// ── setChoiceCount ────────────────────────────────────────────────────────────

describe("CharacterPlaybook.setChoiceCount", () => {
	it("persists count on the playbook item choiceValues", async () => {
		const actor = makeActor("the-blessed", [PLAYBOOK_ITEM]);
		const pb = makePlaybook(actor);
		await pb.setChoiceCount("lore-1", "shrine-loved", 1);
		const snap = await pb.buildPlaybookSnapshot();
		const loreGroup = snap.choices.find(c => c.slug === "lore-1");
		expect(loreGroup.list.find(r => r.slug === "shrine-loved").track.checks[0]).toBe(true);
	});
});

// ── selectPlaybook ────────────────────────────────────────────────────────────

describe("CharacterPlaybook.selectPlaybook", () => {
	it("updates vitals from the playbook data", async () => {
		const vitals = new FakeVitals();
		const moves  = new FakeMoves();
		const pb = makePlaybook(makeActor());
		pb.setVitals(vitals);
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK_DATA);
		expect(vitals.playbookUpdatedWith()).toBe(PLAYBOOK_DATA);
	});

	it("initializes the playbook move category", async () => {
		const vitals = new FakeVitals();
		const moves  = new FakeMoves();
		const pb = makePlaybook(makeActor());
		pb.setVitals(vitals);
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK_DATA);
		expect(moves.initializedWith()).toBe(PLAYBOOK_DATA);
	});

	it("increments bg moves after init when background is pre-selected", async () => {
		const vitals = new FakeVitals();
		const moves  = new FakeMoves();
		const bg     = new FakeBackground("herbalist");
		const pb = makePlaybook(makeActor(), { background: bg });
		pb.setVitals(vitals);
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK_DATA);
		expect(moves.wasIncremented("playbook-the-blessed", "healing-touch")).toBe(true);
	});

	it("does not increment moves when no background is selected", async () => {
		const vitals = new FakeVitals();
		const moves  = new FakeMoves();
		const pb = makePlaybook(makeActor());
		pb.setVitals(vitals);
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK_DATA);
		expect(moves.incrementedCount()).toBe(0);
	});
});

// ── getBackgroundMoveNames ────────────────────────────────────────────────────

describe("CharacterPlaybook.getBackgroundMoveNames", () => {
	it("returns the move slugs for the matching background slug", async () => {
		const pb = makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]));
		expect(await pb.getBackgroundMoveNames("vessel")).toEqual(new Set(["channel"]));
	});

	it("returns empty Set when slug does not match any background", async () => {
		const pb = makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]));
		expect(await pb.getBackgroundMoveNames("unknown-slug")).toEqual(new Set());
	});

	it("returns empty Set when no playbook item is in actor.items", async () => {
		const actor = new FakeActorBuilder().build();
		const pb = makePlaybook(actor);
		expect(await pb.getBackgroundMoveNames("herbalist")).toEqual(new Set());
	});
});

// ── selectBackground ──────────────────────────────────────────────────────────

describe("CharacterPlaybook.selectBackground", () => {
	it("persists the new background selection", async () => {
		const bg = new FakeBackground("");
		const pb = makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]), { background: bg });
		pb.setMoves(new FakeMoves());
		await pb.selectBackground("herbalist");
		expect(bg.selectedSlug).toBe("herbalist");
	});

	it("increments new bg moves not in the old bg", async () => {
		const bg    = new FakeBackground("");
		const moves = new FakeMoves();
		const pb = makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]), { background: bg });
		pb.setMoves(moves);
		await pb.selectBackground("herbalist");
		expect(moves.wasIncremented("playbook-the-blessed", "healing-touch")).toBe(true);
	});

	it("decrements old bg moves not in the new bg", async () => {
		const bg    = new FakeBackground("herbalist");
		const moves = new FakeMoves();
		const pb = makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]), { background: bg });
		pb.setMoves(moves);
		await pb.selectBackground("vessel");
		expect(moves.wasDecremented("playbook-the-blessed", "healing-touch")).toBe(true);
		expect(moves.wasIncremented("playbook-the-blessed", "channel")).toBe(true);
	});

	it("does not increment or decrement moves when no playbook item is in actor.items", async () => {
		const bg    = new FakeBackground("");
		const moves = new FakeMoves();
		const actor = new FakeActorBuilder().build();
		const pb = makePlaybook(actor, { background: bg });
		pb.setMoves(moves);
		await pb.selectBackground("herbalist");
		expect(moves.incrementedCount()).toBe(0);
	});
});
