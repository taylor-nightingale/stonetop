import { describe, it, expect } from "vitest";
import { CharacterFollowers } from "../../../src/actors/character/CharacterFollowers.js";
import { ChoiceGroupFactory } from "../../../src/actors/character/ChoiceGroupFactory.js";
import { ResourceController } from "../../../src/actors/character/ResourceController.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { FakeFollowerRepository } from "../../fakes/FakeFollowerRepository.js";
import { Follower } from "../../../src/model/data/character/Follower.js";

// -- Helpers ------------------------------------------------------------------

function makeActor() {
	return new FakeActorBuilder().build();
}

function makeResourceController() {
	return new ResourceController(new FakeActorBuilder().build());
}

function makeCf(repo = null, resourceCtrl = null) {
	const actor = makeActor();
	return new CharacterFollowers(
		actor,
		repo ?? new FakeFollowerRepository(),
		resourceCtrl ?? makeResourceController(),
		new ChoiceGroupFactory(actor),
	);
}

function makeFollowerItem(data, overrides = {}) {
	return {
		_id: (data.slug ?? "unknown") + "-item",
		type: "npc",
		name: data.name ?? data.slug,
		system: {
			slug:             data.slug,
			owned:            overrides.owned ?? false,
			tags:             data.tags ?? "",
			hp:               { value: data.hp?.value ?? 0, max: data.hp?.max ?? 0 },
			armor:            data.armor ?? "",
			damage:           data.damage ?? "",
			instinct:         data.instinct ?? "",
			moves:            data.moves ?? "",
			cost:             data.cost ?? "",
			loyalty:          { value: 0, max: data.loyalty?.max ?? 3 },
			choices:          data.choices ?? null,
			arcanaSlug:       data.arcanaSlug ?? null,
			playbookSlug:     data.playbookSlug ?? null,
			specialQuality:   data.specialQuality ?? "",
			notes:            data.notes ?? "",
			choiceValues:     {},
		},
	};
}

// -- Fixtures -----------------------------------------------------------------

const ENFYS_DATA = {
	slug:    "enfys",
	name:    "Enfys, the Acolyte",
	tags:    "Bird-wise, innocent",
	hp:      { value: 6, max: 6 },
	armor:   "",
	damage:  "bronze knife d4 (hand)",
	instinct: "to get distracted",
	moves:   "- Speak with birds\n- Ask a difficult question\n- Wander off",
	cost:    "knowledge, secret lore; Loyalty",
	loyalty: { value: 0, max: 3 },
	choices: [{
		slug: "choices",
		list: [
			{ type: "heading", content: { title: "Pick 1 on each line" } },
			{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "he", text: "he" }, { slug: "she", text: "she" }, { slug: "they", text: "they" }] },
			{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "just-a-child", text: "just a child" }, { slug: "on-the-cusp", text: "on the cusp" }] },
		],
	}],
};

const ENFYS = new Follower(ENFYS_DATA);

const PICKER_DATA = {
	slug:    "test-picker",
	name:    "Test Picker",
	tags:    null,
	hp:      { value: 4, max: 4 },
	armor:   "",
	damage:  "",
	instinct: "",
	loyalty: { value: 0, max: 2 },
	choices: [{
		slug: "choices",
		list: [
			{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "bully", text: "to bully" }, { slug: "scheme", text: "to scheme" }] },
		],
	}],
};

const PICKER = new Follower(PICKER_DATA);

const CUSTOM_DATA = {
	slug:    "test-custom",
	name:    "Test Custom",
	tags:    null,
	hp:      { value: 3, max: 3 },
	armor:   "",
	damage:  "",
	instinct: "",
	loyalty: { value: 0, max: 2 },
};

const CUSTOM = new Follower(CUSTOM_DATA);

// -- Tests: ownership ---------------------------------------------------------

describe("CharacterFollowers — ownership", () => {
	it("ownedSlugs returns empty array by default", () => {
		expect(makeCf().ownedSlugs).toEqual([]);
	});

	it("addFollower stores slug in ownedSlugs", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		expect(cf.ownedSlugs).toContain("enfys");
	});

	it("addFollower does not duplicate slugs", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.addFollower("enfys");
		expect(cf.ownedSlugs.filter(s => s === "enfys").length).toBe(1);
	});

	it("removeFollower removes slug from ownedSlugs", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.removeFollower("enfys");
		expect(cf.ownedSlugs).not.toContain("enfys");
	});

	it("removeFollower cleans up associated state", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setHp("enfys", 3);
		await cf.removeFollower("enfys");
		// After removal and re-add, HP should revert to pack default
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.hp).toBe(6);
	});
});

// -- Tests: state mutations ---------------------------------------------------

describe("CharacterFollowers — state mutations", () => {
	it("setHp is reflected in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setHp("enfys", 4);
		const [snap] = await cf.buildSnapshot();
		expect(snap.hp).toBe(4);
	});

	it("setHpMax is reflected in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setHpMax("enfys", 8);
		const [snap] = await cf.buildSnapshot();
		expect(snap.hpMax).toBe(8);
	});

	it("setName is reflected in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setName("enfys", "Enfys the Brave");
		const [snap] = await cf.buildSnapshot();
		expect(snap.name).toBe("Enfys the Brave");
	});

	it("setTags is reflected in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setTags("enfys", "Updated tags");
		const [snap] = await cf.buildSnapshot();
		expect(snap.tags).toBe("Updated tags");
	});

	it("setLoyalty is reflected in buildSnapshot as loyalty.current", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setLoyalty("enfys", 2);
		const [snap] = await cf.buildSnapshot();
		expect(snap.loyalty.current).toBe(2);
	});

	it("setChoiceValue marks option as checked in snapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setChoiceValue("enfys", "choices", "she", null);
		const [snap] = await cf.buildSnapshot();
		const pickRow = snap.choices.list.find(r => r.type === "choice");
		expect(pickRow.options.find(o => o.slug === "she").checked).toBe(true);
	});

	it("setChoiceValue clears sibling slugs before setting the chosen option", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setChoiceValue("enfys", "choices", "she", "he,she,they");
		const [snap] = await cf.buildSnapshot();
		const pickRow = snap.choices.list.filter(r => r.type === "choice")[0];
		expect(pickRow.options.find(o => o.slug === "she").checked).toBe(true);
		expect(pickRow.options.find(o => o.slug === "he").checked).toBe(false);
		expect(pickRow.options.find(o => o.slug === "they").checked).toBe(false);
	});


	it("setArmor is reflected in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setArmor("enfys", "2 (resilience), 0 vs. bronze");
		const [snap] = await cf.buildSnapshot();
		expect(snap.armor).toBe("2 (resilience), 0 vs. bronze");
	});

	it("exposes enriched instinct and a moves list rendered as a <ul>", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setInstinct("enfys", "to **protect**");
		await cf.setMoves("enfys", "- Bite d6\n- Lash out (d8+1)");
		const [snap] = await cf.buildSnapshot();
		expect(snap.instinctHtml).toBe("to <strong>protect</strong>");
		expect(snap.movesHtml).toBe("<ul><li>Bite [[/r d6]]</li><li>Lash out ([[/r d8+1]])</li></ul>");
	});

	it("exposes enriched damage and armor HTML alongside the raw strings", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setDamage("enfys", "**bronze knife** d4 (hand)");
		await cf.setArmor("enfys", "*tough* hide");
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage).toBe("**bronze knife** d4 (hand)");
		expect(snap.damageHtml).toBe("<strong>bronze knife</strong> [[/r d4]] (hand)");
		expect(snap.armorHtml).toBe("<em>tough</em> hide");
	});

	it("setDamage is reflected in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setDamage("enfys", "d6");
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage).toBe("d6");
	});
});

// -- Tests: buildSnapshot -----------------------------------------------------

describe("CharacterFollowers.buildSnapshot", () => {
	it("returns empty array when no slugs owned and no extra slugs", async () => {
		expect(await makeCf().buildSnapshot()).toEqual([]);
	});

	it("returns one snapshot per owned follower", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const snap = await cf.buildSnapshot();
		expect(snap).toHaveLength(1);
	});

	it("snapshot has correct slug and name", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.slug).toBe("enfys");
		expect(snap.name).toBe("Enfys, the Acolyte");
	});

	it("name defaults to pack data", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.name).toBe("Enfys, the Acolyte");
	});

	it("tags reflects pack data", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.tags).toBe("Bird-wise, innocent");
	});

	it("hp defaults to hp.value when no state", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.hp).toBe(6);
		expect(snap.hpMax).toBe(6);
	});

	it("loyalty defaults to current=0 and max from pack", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.loyalty.current).toBe(0);
		expect(snap.loyalty.max).toBe(3);
	});

	it("loyalty.current reflects saved loyalty", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setLoyalty("enfys", 1);
		const [snap] = await cf.buildSnapshot();
		expect(snap.loyalty.current).toBe(1);
	});

	it("armor defaults to pack value when no state", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.armor).toBe("");
	});

	it("damage defaults to pack die when no state", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage).toBe("bronze knife d4 (hand)");
	});

	it("instinct comes from pack data", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.instinct).toBe("to get distracted");
	});

	it("damage is empty string when pack damage is null", async () => {
		const cf = makeCf(new FakeFollowerRepository([PICKER]));
		await cf.addFollower("test-picker");
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage).toBe("");
	});
});

// -- Tests: extraSlugs (arcana-linked followers) -------------------------------

describe("CharacterFollowers.buildSnapshot with extraSlugs", () => {
	it("returns static snapshot for extra slug pre-embedded with owned=false", async () => {
		const actor = makeActor();
		actor.items.push(makeFollowerItem(ENFYS_DATA));
		const cf = new CharacterFollowers(actor, new FakeFollowerRepository(), makeResourceController());
		const snaps = await cf.buildSnapshot(["enfys"]);
		expect(snaps).toHaveLength(1);
		expect(snaps[0].slug).toBe("enfys");
	});

	it("static snapshot uses embedded data for HP and loyalty", async () => {
		const actor = makeActor();
		actor.items.push(makeFollowerItem(ENFYS_DATA));
		const cf = new CharacterFollowers(actor, new FakeFollowerRepository(), makeResourceController());
		const [snap] = await cf.buildSnapshot(["enfys"]);
		expect(snap.hp).toBe(6);
		expect(snap.loyalty.current).toBe(0);
	});

	it("does not duplicate when extra slug is already owned", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const snaps = await cf.buildSnapshot(["enfys"]);
		expect(snaps).toHaveLength(1);
	});

	it("owned followers appear before extra static snapshots", async () => {
		const actor = makeActor();
		actor.items.push(makeFollowerItem(ENFYS_DATA));
		const cf = new CharacterFollowers(actor, new FakeFollowerRepository([PICKER]), makeResourceController());
		await cf.addFollower("test-picker");
		const snaps = await cf.buildSnapshot(["enfys"]);
		expect(snaps).toHaveLength(2);
		expect(snaps[0].slug).toBe("test-picker");
		expect(snaps[1].slug).toBe("enfys");
	});

	it("silently omits extra slug not pre-embedded in actor.items", async () => {
		const cf = makeCf(new FakeFollowerRepository());
		const snaps = await cf.buildSnapshot(["nonexistent"]);
		expect(snaps).toEqual([]);
	});
});

// -- Tests: choices snapshot --------------------------------------------------

describe("CharacterFollowers — choices snapshot", () => {
	it("choices is null when follower has no choices", async () => {
		const cf = makeCf(new FakeFollowerRepository([CUSTOM]));
		await cf.addFollower("test-custom");
		const [snap] = await cf.buildSnapshot();
		expect(snap.choices).toBeNull();
	});

	it("choices has heading row with title", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		const heading = snap.choices.list.find(r => r.type === "entry" && r.content.title);
		expect(heading.content.title).toBe("Pick 1 on each line");
	});

	it("filters promoted entries (weapon/damage/cost/notes) out of the pick rows", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.choices.list.find(r => r.slug === "weapon")).toBeUndefined();
		expect(snap.choices.list.find(r => r.slug === "cost")).toBeUndefined();
	});

	it("pick rows have correct options and are unchecked by default", async () => {
		const cf = makeCf(new FakeFollowerRepository([PICKER]));
		await cf.addFollower("test-picker");
		const [snap] = await cf.buildSnapshot();
		const pickRow = snap.choices.list[0];
		expect(pickRow.type).toBe("choice");
		expect(pickRow.inline).toBe(true);
		expect(pickRow.options.every(o => !o.checked)).toBe(true);
		expect(pickRow.options[0].slug).toBe("bully");
	});

	it("saved pick value marks option as checked", async () => {
		const cf = makeCf(new FakeFollowerRepository([PICKER]));
		await cf.addFollower("test-picker");
		await cf.setChoiceValue("test-picker", "choices", "bully", "bully,scheme");
		const [snap] = await cf.buildSnapshot();
		const pickRow = snap.choices.list[0];
		expect(pickRow.options.find(o => o.slug === "bully").checked).toBe(true);
		expect(pickRow.options.find(o => o.slug === "scheme").checked).toBe(false);
	});

	it("enfys pick rows include he/she/they options", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		const pickRows = snap.choices.list.filter(r => r.type === "choice");
		const pronounRow = pickRows[0];
		expect(pronounRow.options.map(o => o.slug)).toEqual(["he", "she", "they"]);
	});

	it("saved pronoun choice is reflected in choices", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setChoiceValue("enfys", "choices", "she", "he,she,they");
		const [snap] = await cf.buildSnapshot();
		const pickRows = snap.choices.list.filter(r => r.type === "choice");
		const pronounRow = pickRows[0];
		expect(pronounRow.options.find(o => o.slug === "she").checked).toBe(true);
		expect(pronounRow.options.find(o => o.slug === "he").checked).toBe(false);
	});

	it("instinct row is not in choices (it is a separate field)", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.choices.list.find(r => r.slug === "instinct")).toBeUndefined();
	});
});

// -- Fixtures: blank follower -------------------------------------------------

const BLANK_DATA = {
	slug:    "blank",
	name:    "New Follower",
	tags:    null,
	hp:      { value: 6, max: 6 },
	armor:   "",
	damage:  "",
	instinct: "",
	loyalty: { value: 0, max: 3 },
	choices: [{ slug: "choices", list: [] }],
};

const BLANK = new Follower(BLANK_DATA);

// -- Tests: addCustomFollower -------------------------------------------------

describe("CharacterFollowers — addCustomFollower", () => {
	it("does not throw if blank follower not in repo", async () => {
		const cf = makeCf(new FakeFollowerRepository());
		await expect(cf.addCustomFollower()).resolves.not.toThrow();
	});

	it("adds a custom- slug to ownedSlugs", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		expect(cf.ownedSlugs).toHaveLength(1);
		expect(cf.ownedSlugs[0]).toMatch(/^custom-/);
	});

	it("custom follower appears in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		const [snap] = await cf.buildSnapshot();
		expect(snap.name).toBe("New Follower");
		expect(snap.hp).toBe(6);
		expect(snap.hpMax).toBe(6);
		expect(snap.armor).toBe("");
	});
});

// -- Tests: custom follower snapshot ------------------------------------------

describe("CharacterFollowers — custom follower snapshot", () => {
	it("buildSnapshot returns a snapshot for a custom slug", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		const snaps = await cf.buildSnapshot();
		expect(snaps).toHaveLength(1);
		expect(snaps[0].slug).toMatch(/^custom-/);
	});

	it("custom snapshot from blank has its promoted entries filtered out of pick rows", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		const [snap] = await cf.buildSnapshot();
		expect(snap.choices).not.toBeNull();
		expect(snap.choices.list.find(r => r.slug === "cost")).toBeUndefined();
	});

	it("custom snapshot has null choices when blank not available", async () => {
		const cf = makeCf(new FakeFollowerRepository());
		await cf.addCustomFollower();
		const [snap] = await cf.buildSnapshot();
		expect(snap.choices).toBeNull();
	});

	it("loyalty.max is always 3 for custom followers", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		await cf.setLoyalty(cf.ownedSlugs[0], 1);
		const [snap] = await cf.buildSnapshot();
		expect(snap.loyalty.max).toBe(3);
	});

	it("loyalty.max reflects pack data for compendium followers", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.loyalty.max).toBe(3);
	});

	it("custom armor snapshot is the prose string", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		const slug = cf.ownedSlugs[0];
		await cf.setArmor(slug, "2 (shield)");
		const [snap] = await cf.buildSnapshot();
		expect(snap.armor).toBe("2 (shield)");
	});

	it("custom damage snapshot is the prose string", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		const slug = cf.ownedSlugs[0];
		await cf.setDamage(slug, "bronze knife d8 (hand)");
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage).toBe("bronze knife d8 (hand)");
	});
});

// -- Tests: arcanaSlug propagation --------------------------------------------

describe("CharacterFollowers — arcanaSlug", () => {
	const BRONZE_PROTECTOR_DATA = {
		slug:       "bronze-protector",
		name:       "Bronze protector",
		tags:       "Construct, spirit, durable",
		hp:         { value: 13, max: 13 },
		armor:      "3",
		damage:     "pummel d8 (band)",
		instinct:   "",
		loyalty:    { value: 0, max: 3 },
		arcanaSlug: "metal-man",
	};
	const BRONZE_PROTECTOR = new Follower(BRONZE_PROTECTOR_DATA);

	it("arcanaSlug is null for regular followers", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.arcanaSlug).toBeNull();
	});

	it("arcanaSlug is propagated from pack data to snapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([BRONZE_PROTECTOR]));
		await cf.addFollower("bronze-protector");
		const [snap] = await cf.buildSnapshot();
		expect(snap.arcanaSlug).toBe("metal-man");
	});
});

// -- Tests: addFromNpcActor (drag an NPC actor onto the sheet) -----------------

function makeNpcActor(overrides = {}) {
	return {
		name: overrides.name ?? "Garm the Guard",
		type: "npc",
		system: {
			hp:             overrides.hp             ?? { value: 8, max: 10 },
			armor:          overrides.armor          ?? "2 (resilience)",
			damage:         overrides.damage         ?? "claws d8 (hand)",
			specialQuality: overrides.specialQuality ?? "Fierce",
			instinct:       overrides.instinct       ?? "to protect the gate",
			description:    overrides.description    ?? "A grizzled guard.",
		},
	};
}

describe("CharacterFollowers — addFromNpcActor", () => {
	function makeCfWithActor(repo = null) {
		const actor = makeActor();
		const cf = new CharacterFollowers(
			actor,
			repo ?? new FakeFollowerRepository(),
			makeResourceController(),
			new ChoiceGroupFactory(actor),
		);
		return { actor, cf };
	}

	it("creates an owned custom- follower", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		expect(cf.ownedSlugs).toHaveLength(1);
		expect(cf.ownedSlugs[0]).toMatch(/^custom-/);
	});

	it("maps the NPC name to the item name", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		const [snap] = await cf.buildSnapshot();
		expect(snap.name).toBe("Garm the Guard");
	});

	it("maps hp and maxHp to hp value and max", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		const [snap] = await cf.buildSnapshot();
		expect(snap.hp).toBe(8);
		expect(snap.hpMax).toBe(10);
	});

	it("uses hp value for max when the NPC max is 0", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor({ hp: { value: 8, max: 0 } }));
		const [snap] = await cf.buildSnapshot();
		expect(snap.hpMax).toBe(8);
	});

	it("copies the NPC armor string", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		const [snap] = await cf.buildSnapshot();
		expect(snap.armor).toBe("2 (resilience)");
	});

	it("copies the NPC damage prose string", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage).toBe("claws d8 (hand)");
	});

	it("maps instinct", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		const [snap] = await cf.buildSnapshot();
		expect(snap.instinct).toBe("to protect the gate");
	});

	it("maps specialQuality to specialQuality", async () => {
		const { actor, cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		const created = actor.createdDocs.at(-1);
		expect(created.system.specialQuality).toBe("Fierce");
	});

	it("maps description", async () => {
		const { actor, cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		const created = actor.createdDocs.at(-1);
		expect(created.system.description).toBe("A grizzled guard.");
	});
});

// -- syncPlaybookFollowers ----------------------------------------------------

describe("CharacterFollowers.syncPlaybookFollowers", () => {
	function setup(repoFollowers = []) {
		const actor = makeActor();
		const cf = new CharacterFollowers(
			actor,
			new FakeFollowerRepository(repoFollowers),
			makeResourceController(),
			new ChoiceGroupFactory(actor),
		);
		return { actor, cf };
	}

	const CREW = new Follower({
		slug: "crew", name: "Crew", playbookSlug: "the-marshal",
		hp: { value: 6, max: 6 }, armor: "0", damage: "d6",
	});

	it("embeds the playbook's followers as owned, carrying playbookSlug", async () => {
		const { actor, cf } = setup([CREW]);
		await cf.syncPlaybookFollowers("the-marshal");
		const item = actor.createdDocs.find(d => d.system?.slug === "crew");
		expect(item).toBeDefined();
		expect(item.system.owned).toBe(true);
		expect(item.system.playbookSlug).toBe("the-marshal");
	});

	it("does not duplicate an already-embedded playbook follower", async () => {
		const { actor, cf } = setup([CREW]);
		actor.items.push(makeFollowerItem({ slug: "crew", playbookSlug: "the-marshal" }, { owned: true }));
		await cf.syncPlaybookFollowers("the-marshal");
		expect(actor.createdDocs.filter(d => d.system?.slug === "crew")).toHaveLength(0);
	});

	it("removes a follower tied to a different playbook (playbook swap)", async () => {
		const { actor, cf } = setup([]);
		actor.items.push(makeFollowerItem({ slug: "crew", playbookSlug: "the-marshal" }, { owned: true }));
		await cf.syncPlaybookFollowers("the-blessed");
		expect([...actor.items].some(i => i.system?.slug === "crew")).toBe(false);
	});

	it("leaves arcana/manual followers (no playbookSlug) untouched", async () => {
		const { actor, cf } = setup([]);
		actor.items.push(makeFollowerItem({ slug: "enfys" }, { owned: true }));
		await cf.syncPlaybookFollowers("the-marshal");
		expect([...actor.items].some(i => i.system?.slug === "enfys")).toBe(true);
	});
});

// -- toggleTag ----------------------------------------------------------------

describe("CharacterFollowers.toggleTag", () => {
	function setup(itemTags) {
		const cf = makeCf(new FakeFollowerRepository([]));
		cf._actor.items.push(makeFollowerItem({ slug: "crew" }, { owned: true }));
		cf._actor.items.get("crew-item").system.tags = itemTags;
		return cf;
	}

	it("adds a tag that isn't selected and reflects it as a selected chip", async () => {
		const cf = setup({ selected: ["group"], options: ["group", "archers"], multi: true, allowCustom: true });
		await cf.toggleTag("crew", "archers");
		const [snap] = await cf.buildSnapshot();
		expect(snap.tagSelection.has("archers")).toBe(true);
		expect(snap.isGroup).toBe(true);
	});

	it("removes a tag that is already selected", async () => {
		const cf = setup({ selected: ["group", "archers"], options: ["group", "archers"], multi: true, allowCustom: true });
		await cf.toggleTag("crew", "archers");
		const [snap] = await cf.buildSnapshot();
		expect(snap.tagSelection.has("archers")).toBe(false);
	});
});
