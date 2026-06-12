import { describe, it, expect, vi } from "vitest";
import { CharacterArcana } from "../../../src/actors/character/CharacterArcana.js";
import { CharacterFollowers } from "../../../src/actors/character/CharacterFollowers.js";
import { ChoiceGroupFactory } from "../../../src/actors/character/ChoiceGroupFactory.js";
import { FollowerSideEffectHandler } from "../../../src/actors/character/SideEffectHandler.js";
import { ResourceController } from "../../../src/actors/character/ResourceController.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { FakeArcanaRepository } from "../../fakes/FakeArcanaRepository.js";
import { FakeFollowerRepository } from "../../fakes/FakeFollowerRepository.js";
import { Stats } from "../../../src/model/data/character/Stats.js";
import {
	ArcanaSnapshot, ArcanaSectionSnapshot,
	ArcanumSnapshot, ArcanumFrontSnapshot, ArcanumBackSnapshot,
	ChoiceGroup, EntryRow,
} from "../../../src/model/snapshot/character/CharacterSnapshot.js";

// -- Helpers ------------------------------------------------------------------

function makeArcanumItem(data, overrides = {}) {
	return {
		_id: data.slug,
		type: "arcanum",
		name: data.name ?? data.slug,
		img: null,
		system: {
			slug:             data.slug,
			major:            data.major ?? false,
			front:            data.front,
			back:             data.back,
			flipped:          overrides.flipped ?? false,
			unlockValues:     overrides.unlockValues ?? {},
			backChoiceValues: overrides.backChoices ?? {},
		},
	};
}

function makeNpcItem(slug, overrides = {}) {
	return {
		_id: slug + "-npc",
		type: "npc",
		name: slug,
		system: {
			slug, owned: overrides.owned ?? false, tags: "",
			hp: { value: 6, max: 6 }, armor: "",
			damage: "",
			instinct: "", loyalty: { value: 0, max: 3 },
			choices: null, arcanaSlug: null, specialQuality: "", choiceValues: {},
		},
	};
}

function makeActor(items = []) {
	return new FakeActorBuilder().withItems(items).build();
}

// -- Fixtures ------------------------------------------------------------------

const FFYRNIG_SPHERE = {
	slug: "huge-wooden-sphere",
	front: {
		title: "A Huge Wooden Sphere",
		item: { name: "A Huge Wooden Sphere", weight: null, note: "immobile", inventoryColumn: null },
		description: "<p>Half-buried and largely overgrown.</p>",
		unlock: {
			slug: "huge-wooden-sphere",
			list: [
				{ type: "heading", content: { text: "The pictograms depict some sort of recipe, which you can learn but you must…" } },
				{ type: "heading", content: { text: "Some context text." } },
				{ type: "heading", slug: "dig-sphere",   content: { text: "… first dig up and clean the sphere." }, track: { max: 1 } },
				{ type: "heading", slug: "study-glyphs", content: { text: "… spend weeks studying the glyphs." }, track: { max: 1 } },
				{ type: "heading", content: { text: "And then…" } },
				{ type: "heading", slug: "risk-recipe",  content: { text: "… risk getting the recipe wrong." }, track: { max: 3 } },
			],
		},
	},
	back: {
		title: "Ffyrnig Tonic",
		item: { name: "Ffyrnig Tonic", weight: 1, note: "magical", inventoryColumn: "regular" },
		description: "<p>When you pickle fresh ffyrnig root…</p>",
		resource: { max: 3, maxStat: null, title: "Ffyrnig Tonic", labels: [] },
		moves: [
			{ name: "When you take a draught of ffyrnig tonic", text: "<p>pick 1: regain HP or clear a debility.</p>" },
		],
	},
};

// -- Build helpers -------------------------------------------------------------

function makeFakeStats(values = {}) {
	return { getStats: () => new Stats(values) };
}

function makeActorOutfitItems() {
	return { sync: vi.fn(async () => {}), deleteBySource: vi.fn(async () => {}) };
}

function makeResourceController() {
	return new ResourceController(new FakeActorBuilder().build());
}

function makeArcana(items = [], arcana = [FFYRNIG_SPHERE], fakeStats = null, outfitItems = null) {
	const actor = makeActor(items);
	return new CharacterArcana(
		actor,
		new FakeArcanaRepository(arcana),
		fakeStats ?? makeFakeStats(),
		outfitItems ?? makeActorOutfitItems(),
		null,
		new ChoiceGroupFactory(actor),
	);
}

// -- Tests --------------------------------------------------------------------

describe("CharacterArcana.buildSnapshot()", () => {
	describe("structure", () => {
		it("returns an ArcanaSnapshot", async () => {
			const snap = await makeArcana().buildSnapshot();
			expect(snap).toBeInstanceOf(ArcanaSnapshot);
		});

		it("minor and major are ArcanaSectionSnapshot instances", async () => {
			const snap = await makeArcana().buildSnapshot();
			expect(snap.minor).toBeInstanceOf(ArcanaSectionSnapshot);
			expect(snap.major).toBeInstanceOf(ArcanaSectionSnapshot);
		});

		it("minor.title is always 'Minor Arcana'", async () => {
			const snap = await makeArcana().buildSnapshot();
			expect(snap.minor.title).toBe("Minor Arcana");
		});

		it("major.title is always 'Major Arcana'", async () => {
			const snap = await makeArcana().buildSnapshot();
			expect(snap.major.title).toBe("Major Arcana");
		});

		it("minor.items is [] when no owned slugs", async () => {
			const snap = await makeArcana().buildSnapshot();
			expect(snap.minor.items).toEqual([]);
		});

		it("major.items is always []", async () => {
			const snap = await makeArcana([makeArcanumItem(FFYRNIG_SPHERE)]).buildSnapshot();
			expect(snap.major.items).toEqual([]);
		});
	});

	describe("owned arcana", () => {
		it("arcanum item in actor.items appears in minor.items", async () => {
			const snap = await makeArcana([makeArcanumItem(FFYRNIG_SPHERE)]).buildSnapshot();
			expect(snap.minor.items).toHaveLength(1);
		});

		it("non-arcanum items in actor.items are excluded", async () => {
			const snap = await makeArcana([{ _id: "m1", type: "move", name: "Test", system: {} }]).buildSnapshot();
			expect(snap.minor.items).toHaveLength(0);
		});

		it("every item in minor.items has owned: true", async () => {
			const snap = await makeArcana([makeArcanumItem(FFYRNIG_SPHERE)]).buildSnapshot();
			expect(snap.minor.items[0].owned).toBe(true);
		});

		it("returns a ArcanumSnapshot", async () => {
			const snap = await makeArcana([makeArcanumItem(FFYRNIG_SPHERE)]).buildSnapshot();
			expect(snap.minor.items[0]).toBeInstanceOf(ArcanumSnapshot);
		});

		it("has correct slug", async () => {
			const snap = await makeArcana([makeArcanumItem(FFYRNIG_SPHERE)]).buildSnapshot();
			expect(snap.minor.items[0].slug).toBe("huge-wooden-sphere");
		});
	});

	describe("flipped state", () => {
		it("flipped is false by default", async () => {
			const snap = await makeArcana([makeArcanumItem(FFYRNIG_SPHERE)]).buildSnapshot();
			expect(snap.minor.items[0].flipped).toBe(false);
		});

		it("flipped is true when item has flipped=true", async () => {
			const snap = await makeArcana([makeArcanumItem(FFYRNIG_SPHERE, { flipped: true })]).buildSnapshot();
			expect(snap.minor.items[0].flipped).toBe(true);
		});
	});

	describe("front snapshot", () => {
		async function getItem(overrides = {}) {
			return (await makeArcana([makeArcanumItem(FFYRNIG_SPHERE, overrides)]).buildSnapshot()).minor.items[0];
		}

		it("front is a ArcanumFrontSnapshot", async () => {
			expect((await getItem()).front).toBeInstanceOf(ArcanumFrontSnapshot);
		});

		it("front has correct title, item, description", async () => {
			const { front } = await getItem();
			expect(front.title).toBe("A Huge Wooden Sphere");
			expect(front.item?.weight).toBeNull();
			expect(front.item?.note).toBe("immobile");
			expect(front.description).toContain("Half-buried");
		});

		it("front.unlock is a ChoiceGroup", async () => {
			expect((await getItem()).front.unlock).toBeInstanceOf(ChoiceGroup);
		});

		it("front.unlock.slug is the arcanum slug", async () => {
			expect((await getItem()).front.unlock.slug).toBe("huge-wooden-sphere");
		});

		it("front.unlock.list first item is an EntryRow with the unlock description", async () => {
			const row = (await getItem()).front.unlock.list[0];
			expect(row).toBeInstanceOf(EntryRow);
			expect(row.content.text).toBe("The pictograms depict some sort of recipe, which you can learn but you must…");
		});

		it("front.unlock.list has all entry nodes", async () => {
			const { list } = (await getItem()).front.unlock;
			expect(list).toHaveLength(6);
			expect(list.every(r => r.type === "entry")).toBe(true);
		});

		it("entry row without track has null track field", async () => {
			const row = (await getItem()).front.unlock.list[0];
			expect(row).toBeInstanceOf(EntryRow);
			expect(row.track).toBeNull();
		});

		it("entry row with track has slug and checks array", async () => {
			const row = (await getItem()).front.unlock.list[2];
			expect(row).toBeInstanceOf(EntryRow);
			expect(row.track).not.toBeNull();
			expect(row.track.slug).toBe("dig-sphere");
			expect(row.content.text).toBe("… first dig up and clean the sphere.");
		});

		it("heading+track defaults checks to all false when no count saved", async () => {
			const row = (await getItem()).front.unlock.list[2];
			expect(row.track.checks).toEqual([false]);
		});

		it("heading+track with max:3 has checks array of length 3", async () => {
			const row = (await getItem()).front.unlock.list[5];
			expect(row.track.checks).toHaveLength(3);
		});

		it("heading+track checks reflect saved unlock values", async () => {
			const row = (await getItem({ unlockValues: { "huge-wooden-sphere": { "dig-sphere": 1 } } })).front.unlock.list[2];
			expect(row.track.checks).toEqual([true]);
		});
	});

	describe("back snapshot", () => {
		async function getItem(overrides = {}) {
			return (await makeArcana([makeArcanumItem(FFYRNIG_SPHERE, overrides)]).buildSnapshot()).minor.items[0];
		}

		it("back is a ArcanumBackSnapshot", async () => {
			expect((await getItem()).back).toBeInstanceOf(ArcanumBackSnapshot);
		});

		it("back has correct title, item, description", async () => {
			const { back } = await getItem();
			expect(back.title).toBe("Ffyrnig Tonic");
			expect(back.item?.weight).toBe(1);
			expect(back.item?.note).toBe("magical");
			expect(back.description).toContain("pickle fresh ffyrnig root");
		});

		it("back.resource is populated and defaults current to 0", async () => {
			expect((await getItem()).back.resource).toMatchObject({ current: 0, max: 3, title: "Ffyrnig Tonic" });
		});

		it("back.resource.current reflects resourceController", async () => {
			const ctrl = new ResourceController(new FakeActorBuilder().build());
			await ctrl.set("inventory", "huge-wooden-sphere", 2);
			const item = (await makeArcana([makeArcanumItem(FFYRNIG_SPHERE)])
				.buildSnapshot({}, ctrl)).minor.items[0];
			expect(item.back.resource.current).toBe(2);
		});

		it("back.resource is null when absent in JSON", async () => {
			const noResource = { ...FFYRNIG_SPHERE, back: { ...FFYRNIG_SPHERE.back, resource: undefined } };
			const arcana = new CharacterArcana(
				makeActor([makeArcanumItem(noResource)]),
				new FakeArcanaRepository(),
			);
			expect((await arcana.buildSnapshot()).minor.items[0].back.resource).toBeNull();
		});

		it("back.moves[0] has correct name and text", async () => {
			const item = await getItem();
			expect(item.back.moves[0]).toMatchObject({
				name: "When you take a draught of ffyrnig tonic",
				text: "<p>pick 1: regain HP or clear a debility.</p>",
			});
		});

		it("back.moves is empty when absent in JSON", async () => {
			const noMoves = { ...FFYRNIG_SPHERE, back: { ...FFYRNIG_SPHERE.back, moves: undefined } };
			const arcana = new CharacterArcana(
				makeActor([makeArcanumItem(noMoves)]),
				new FakeArcanaRepository(),
			);
			expect((await arcana.buildSnapshot()).minor.items[0].back.moves).toEqual([]);
		});

		it("back.choices is null when absent in JSON", async () => {
			expect((await getItem()).back.choices).toBeNull();
		});
	});

	describe("mutation methods", () => {
		it("addArcanum embeds item and appears in ownedSlugs", async () => {
			const actor = makeActor();
			const arcana = new CharacterArcana(actor, new FakeArcanaRepository([FFYRNIG_SPHERE]));
			await arcana.addArcanum("huge-wooden-sphere");
			expect([...arcana.ownedSlugs]).toContain("huge-wooden-sphere");
		});

		it("addArcanum is idempotent when arcanum already owned", async () => {
			const actor = makeActor([makeArcanumItem(FFYRNIG_SPHERE)]);
			const arcana = new CharacterArcana(actor, new FakeArcanaRepository([FFYRNIG_SPHERE]));
			await arcana.addArcanum("huge-wooden-sphere");
			expect([...arcana.ownedSlugs]).toHaveLength(1);
		});

		it("removeArcanum removes item from actor.items", async () => {
			const actor = makeActor([makeArcanumItem(FFYRNIG_SPHERE), makeArcanumItem(CARVINGS_IN_A_CAVE)]);
			const arcana = new CharacterArcana(actor, new FakeArcanaRepository());
			await arcana.removeArcanum("huge-wooden-sphere");
			expect([...arcana.ownedSlugs]).not.toContain("huge-wooden-sphere");
			expect([...arcana.ownedSlugs]).toContain("carvings-in-a-cave");
		});

		it("flipArcanum is reflected in buildSnapshot flipped=true", async () => {
			const arcana = makeArcana([makeArcanumItem(FFYRNIG_SPHERE)], [FFYRNIG_SPHERE]);
			await arcana.flipArcanum("huge-wooden-sphere");
			const snap = await arcana.buildSnapshot();
			expect(snap.minor.items[0].flipped).toBe(true);
		});

		it("unflipArcanum is reflected in buildSnapshot flipped=false", async () => {
			const arcana = makeArcana([makeArcanumItem(FFYRNIG_SPHERE, { flipped: true })], [FFYRNIG_SPHERE]);
			await arcana.unflipArcanum("huge-wooden-sphere");
			const snap = await arcana.buildSnapshot();
			expect(snap.minor.items[0].flipped).toBe(false);
		});

		it("setUnlockCount is reflected in buildSnapshot unlock check state", async () => {
			const arcana = makeArcana([makeArcanumItem(FFYRNIG_SPHERE)]);
			await arcana.setUnlockCount("huge-wooden-sphere", "dig-sphere", 1);
			const snap = await arcana.buildSnapshot();
			const row = snap.minor.items[0].front.unlock.list[2];
			expect(row.track.checks).toEqual([true]);
		});

		it("setBackChoiceValue is reflected in buildSnapshot back choices track", async () => {
			const arcana = makeArcana([makeArcanumItem(CRACKED_FLUTE)]);
			await arcana.setBackChoiceValue("cracked-flute", "andalau-of-the-flute", 1);
			const snap = await arcana.buildSnapshot();
			expect(snap.minor.items[0].back.choices.list[0].track.checks).toEqual([true]);
		});
	});
});

// -- Additional fixtures -------------------------------------------------------

const CARVINGS_IN_A_CAVE = {
	slug: "carvings-in-a-cave",
	front: {
		title: "Carvings in a Cave",
		item: null,
		description: "<p>Strange carvings.</p>",
		unlock: { description: "Unlock by…", requirements: [] },
	},
	back: {
		title: "Shell Game of Souls",
		item: null,
		description: "<p>You may contain souls.</p>",
		resource: { max: null, maxStat: "con", title: "Souls", labels: [] },
		move: null,
		options: [],
	},
};

const BOW_WITH_NO_STRING = {
	slug: "bow-with-no-string",
	front: {
		title: "A Bow with No String",
		item: { name: "A Bow with No String", weight: 1, note: null, inventoryColumn: "regular" },
		description: "<p>An ancient bow.</p>",
		unlock: { description: "Unlock by…", requirements: [] },
	},
	back: {
		title: "Thunderbolt Bow",
		item: {
			name: "Thunderbolt Bow",
			weight: 1,
			note: "<em>magical</em>",
			inventoryColumn: "regular",
			resource: { max: 3, maxStat: null, title: "Ammo", labels: ["plenty left", "low ammo", "all out"] },
		},
		description: "<p>The bow crackles with lightning.</p>",
		resource: null,
		move: null,
		options: [],
	},
};

describe("CharacterArcana.buildSnapshot() — resourceController", () => {
	it("back.resource uses resourceController current for back.resource arcana", async () => {
		const ctrl = new ResourceController(new FakeActorBuilder().build());
		await ctrl.set("inventory", "huge-wooden-sphere", 2);
		const item = (await makeArcana([makeArcanumItem(FFYRNIG_SPHERE)])
			.buildSnapshot({}, ctrl)).minor.items[0];
		expect(item.back.resource.current).toBe(2);
	});

	it("back.resource defaults to current 0 when not in inventoryResources", async () => {
		const item = (await makeArcana([makeArcanumItem(FFYRNIG_SPHERE)]).buildSnapshot()).minor.items[0];
		expect(item.back.resource.current).toBe(0);
	});

	it("back.item.resource is a resolved Resource on the OutfitItem snapshot", async () => {
		const ctrl = new ResourceController(new FakeActorBuilder().build());
		await ctrl.set("inventory", "bow-with-no-string", 1);
		const item = (await makeArcana([makeArcanumItem(BOW_WITH_NO_STRING)], [BOW_WITH_NO_STRING])
			.buildSnapshot({}, ctrl)).minor.items[0];
		expect(item.back.item.resource).not.toBeNull();
		expect(item.back.item.resource.current).toBe(1);
		expect(item.back.item.resource.max).toBe(3);
		expect(item.back.item.resource.title).toBe("Ammo");
	});

	it("back.item.resource defaults to current 0 when not in inventoryResources", async () => {
		const item = (await makeArcana([makeArcanumItem(BOW_WITH_NO_STRING)], [BOW_WITH_NO_STRING]).buildSnapshot()).minor.items[0];
		expect(item.back.item.resource.current).toBe(0);
	});

	it("back.resource is null for arcana whose resource lives on the item", async () => {
		const item = (await makeArcana([makeArcanumItem(BOW_WITH_NO_STRING)], [BOW_WITH_NO_STRING]).buildSnapshot()).minor.items[0];
		expect(item.back.resource).toBeNull();
	});

	it("back.item.resource is null for arcana with a standalone resource", async () => {
		const item = (await makeArcana([makeArcanumItem(FFYRNIG_SPHERE)]).buildSnapshot()).minor.items[0];
		expect(item.back.item.resource).toBeNull();
	});

	it("back.resource is null when neither back.resource nor back.item.resource defined", async () => {
		const noResource = { ...FFYRNIG_SPHERE, back: { ...FFYRNIG_SPHERE.back, resource: null } };
		const arcana = new CharacterArcana(
			makeActor([makeArcanumItem(noResource)]),
			new FakeArcanaRepository(),
		);
		expect((await arcana.buildSnapshot()).minor.items[0].back.resource).toBeNull();
	});
});

describe("CharacterArcana.buildSnapshot() — maxStat resolution", () => {
	it("maxStat resolves to stat value from stats", async () => {
		const arcana = new CharacterArcana(
			makeActor([makeArcanumItem(CARVINGS_IN_A_CAVE)]),
			new FakeArcanaRepository(),
			makeFakeStats({ con: 3 }),
		);
		const item = (await arcana.buildSnapshot()).minor.items[0];
		expect(item.back.resource.max).toBe(3);
	});

	it("maxStat resolves to 0 when stat is missing", async () => {
		const arcana = new CharacterArcana(
			makeActor([makeArcanumItem(CARVINGS_IN_A_CAVE)]),
			new FakeArcanaRepository(),
			makeFakeStats(),
		);
		const item = (await arcana.buildSnapshot()).minor.items[0];
		expect(item.back.resource.max).toBe(0);
	});

	it("fixed max is used unchanged when maxStat is null", async () => {
		const item = (await makeArcana([makeArcanumItem(FFYRNIG_SPHERE)]).buildSnapshot()).minor.items[0];
		expect(item.back.resource.max).toBe(3);
	});
});

describe("CharacterArcana.buildSnapshot() — checked state", () => {
	it("checked defaults to false when not in checkedMap", async () => {
		const item = (await makeArcana([makeArcanumItem(FFYRNIG_SPHERE)]).buildSnapshot()).minor.items[0];
		expect(item.checked).toBe(false);
	});

	it("checked is true when slug is in checkedMap", async () => {
		const item = (await makeArcana([makeArcanumItem(FFYRNIG_SPHERE)])
			.buildSnapshot({ "huge-wooden-sphere": true })).minor.items[0];
		expect(item.checked).toBe(true);
	});

	it("checked is false when slug is not in checkedMap", async () => {
		const item = (await makeArcana([makeArcanumItem(FFYRNIG_SPHERE)])
			.buildSnapshot({ "other-slug": true })).minor.items[0];
		expect(item.checked).toBe(false);
	});
});

describe("CharacterArcana — outfitItems sync", () => {
	it("addArcanum syncs embedded item when arcanum has a front inventoryColumn", async () => {
		const outfitItems = makeActorOutfitItems();
		const arcana = makeArcana([], [BOW_WITH_NO_STRING], null, outfitItems);
		await arcana.addArcanum("bow-with-no-string");
		expect(outfitItems.sync).toHaveBeenCalledWith(
			"arcana:bow-with-no-string",
			expect.arrayContaining([expect.objectContaining({ system: expect.objectContaining({ source: "arcana:bow-with-no-string" }) })]),
		);
	});

	it("addArcanum deletes source when front item has no inventoryColumn", async () => {
		const outfitItems = makeActorOutfitItems();
		const arcana = makeArcana([], [FFYRNIG_SPHERE], null, outfitItems);
		await arcana.addArcanum("huge-wooden-sphere");
		expect(outfitItems.deleteBySource).toHaveBeenCalledWith("arcana:huge-wooden-sphere");
	});

	it("removeArcanum deletes embedded item by source", async () => {
		const outfitItems = makeActorOutfitItems();
		const arcana = makeArcana([makeArcanumItem(BOW_WITH_NO_STRING)], [BOW_WITH_NO_STRING], null, outfitItems);
		await arcana.removeArcanum("bow-with-no-string");
		expect(outfitItems.deleteBySource).toHaveBeenCalledWith("arcana:bow-with-no-string");
	});

	it("flipArcanum syncs to the back item", async () => {
		const outfitItems = makeActorOutfitItems();
		const arcana = makeArcana([makeArcanumItem(BOW_WITH_NO_STRING)], [BOW_WITH_NO_STRING], null, outfitItems);
		await arcana.flipArcanum("bow-with-no-string");
		expect(outfitItems.sync).toHaveBeenCalledWith("arcana:bow-with-no-string", expect.any(Array));
	});

	it("unflipArcanum syncs to the front item", async () => {
		const outfitItems = makeActorOutfitItems();
		const arcana = makeArcana(
			[makeArcanumItem(BOW_WITH_NO_STRING, { flipped: true })],
			[BOW_WITH_NO_STRING], null, outfitItems,
		);
		await arcana.unflipArcanum("bow-with-no-string");
		expect(outfitItems.sync).toHaveBeenCalledWith("arcana:bow-with-no-string", expect.any(Array));
	});

	it("does not throw when outfitItems is null", async () => {
		const arcana = new CharacterArcana(makeActor([makeArcanumItem(BOW_WITH_NO_STRING)]), new FakeArcanaRepository([BOW_WITH_NO_STRING]));
		await expect(arcana.addArcanum("bow-with-no-string")).resolves.not.toThrow();
	});
});

// -- Follower sync fixtures ----------------------------------------------------

const CRACKED_FLUTE = {
	slug: "cracked-flute",
	front: {
		title: "A cracked flute",
		item: null,
		description: "<p>A cracked flute.</p>",
		unlock: { slug: "cracked-flute", list: [] },
	},
	back: {
		title: "Dancing Wind Spirit",
		choices: {
			slug: "cracked-flute",
			list: [
				{ type: "entry", slug: "andalau-of-the-flute", followers: ["andalau-of-the-flute"], inlineDisplay: true, content: {}, track: { max: 1 } },
			],
		},
		item: null,
		description: "<p>The andalau manifests.</p>",
		resource: null,
		move: null,
	},
};

const STONE_IDOL = {
	slug: "stone-idol",
	front: {
		title: "A stone idol",
		item: null,
		description: "<p>A tiny Fae.</p>",
		unlock: { slug: "stone-idol", list: [] },
	},
	back: {
		title: "The Angry Little God",
		choices: {
			slug: "stone-idol",
			list: [
				{ type: "entry", slug: "all-mighty-thistlewisk", followers: ["all-mighty-thistlewisk"], inlineDisplay: true, content: {}, track: { max: 1 } },
			],
		},
		item: null,
		description: "<p>It wakes.</p>",
		resource: null,
		move: null,
	},
};

function makeArcanaWithFollowers(items = [], arcana = [CRACKED_FLUTE]) {
	const actor = makeActor(items);
	const followerRepo = new FakeFollowerRepository();
	const factory = new ChoiceGroupFactory(actor);
	const followers = new CharacterFollowers(actor, followerRepo, makeResourceController(), factory);
	factory.register(new FollowerSideEffectHandler(followers));
	const charArcana = new CharacterArcana(actor, new FakeArcanaRepository(arcana), null, null, followers, factory);
	return { actor, charArcana, followers };
}

// -- Tests: follower sync ------------------------------------------------------

describe("CharacterArcana — follower sync", () => {
	it("flipArcanum embeds linked follower as owned=true", async () => {
		const { actor, charArcana } = makeArcanaWithFollowers([makeArcanumItem(CRACKED_FLUTE)]);
		// Pre-embed andalau as owned=false (simulates addArcanum having been called)
		actor.items.push(makeNpcItem("andalau-of-the-flute", { owned: false }));
		await charArcana.flipArcanum("cracked-flute");
		const followerItem = [...actor.items].find(i => i.type === "npc" && i.system?.slug === "andalau-of-the-flute");
		expect(followerItem?.system?.owned).toBe(true);
	});

	it("unflipArcanum removes the owned follower", async () => {
		const { actor, charArcana } = makeArcanaWithFollowers([
			makeArcanumItem(CRACKED_FLUTE, { flipped: true }),
			makeNpcItem("andalau-of-the-flute", { owned: true }),
		]);
		await charArcana.unflipArcanum("cracked-flute");
		const followerItem = [...actor.items].find(i => i.type === "npc" && i.system?.slug === "andalau-of-the-flute");
		expect(followerItem).toBeUndefined();
	});

	it("removeArcanum removes linked follower that is still owned=false", async () => {
		const { actor, charArcana } = makeArcanaWithFollowers([
			makeArcanumItem(CRACKED_FLUTE),
			makeNpcItem("andalau-of-the-flute", { owned: false }),
		]);
		await charArcana.removeArcanum("cracked-flute");
		const followerItem = [...actor.items].find(i => i.type === "npc" && i.system?.slug === "andalau-of-the-flute");
		expect(followerItem).toBeUndefined();
	});

	it("removeArcanum does not remove independently owned follower", async () => {
		const { actor, charArcana } = makeArcanaWithFollowers([
			makeArcanumItem(CRACKED_FLUTE),
			makeNpcItem("andalau-of-the-flute", { owned: true }),
		]);
		await charArcana.removeArcanum("cracked-flute");
		const followerItem = [...actor.items].find(i => i.type === "npc" && i.system?.slug === "andalau-of-the-flute");
		expect(followerItem).toBeDefined();
	});

	it("addArcanum pre-embeds linked follower with owned=false", async () => {
		const actor = makeActor();
		const followerRepo = new FakeFollowerRepository([{
			slug: "andalau-of-the-flute", name: "The Andalau", tags: null,
			hp: { value: 6, max: 6 }, armor: "", damage: "",
			instinct: "", loyalty: { value: 0, max: 3 }, choices: null,
		}]);
		const followers = new CharacterFollowers(actor, followerRepo, makeResourceController());
		const charArcana = new CharacterArcana(actor, new FakeArcanaRepository([CRACKED_FLUTE]), null, null, followers);
		await charArcana.addArcanum("cracked-flute");
		const followerItem = [...actor.items].find(i => i.type === "npc" && i.system?.slug === "andalau-of-the-flute");
		expect(followerItem?.system?.owned).toBe(false);
	});

	it("does not embed follower when arcanum has no back.choices", async () => {
		const { actor, charArcana } = makeArcanaWithFollowers([makeArcanumItem(FFYRNIG_SPHERE)], [FFYRNIG_SPHERE]);
		await charArcana.flipArcanum("huge-wooden-sphere");
		expect([...actor.items].filter(i => i.type === "npc")).toHaveLength(0);
	});

	it("does not throw when _followers is null", async () => {
		const arcana = new CharacterArcana(makeActor([makeArcanumItem(CRACKED_FLUTE)]), new FakeArcanaRepository([CRACKED_FLUTE]));
		await expect(arcana.flipArcanum("cracked-flute")).resolves.not.toThrow();
	});

	it("setBackChoiceValue with count>0 embeds follower as owned=true", async () => {
		const actor = makeActor();
		const followerRepo = new FakeFollowerRepository([{
			slug: "andalau-of-the-flute", name: "The Andalau", tags: null,
			hp: { value: 6, max: 6 }, armor: "", damage: "",
			instinct: "", loyalty: { value: 0, max: 3 }, choices: null,
		}]);
		const factory = new ChoiceGroupFactory(actor);
		const followers = new CharacterFollowers(actor, followerRepo, makeResourceController(), factory);
		factory.register(new FollowerSideEffectHandler(followers));
		const charArcana = new CharacterArcana(actor, new FakeArcanaRepository(), null, null, followers, factory);
		actor.items.push(makeArcanumItem(CRACKED_FLUTE));
		await charArcana.setBackChoiceValue("cracked-flute", "andalau-of-the-flute", 1);
		const followerItem = [...actor.items].find(i => i.type === "npc" && i.system?.slug === "andalau-of-the-flute");
		expect(followerItem?.system?.owned).toBe(true);
	});

	it("setBackChoiceValue with count=0 removes follower", async () => {
		const { actor, charArcana, followers } = makeArcanaWithFollowers([makeArcanumItem(CRACKED_FLUTE)]);
		actor.items.push(makeNpcItem("andalau-of-the-flute", { owned: true }));
		await charArcana.setBackChoiceValue("cracked-flute", "andalau-of-the-flute", 0);
		const followerItem = [...actor.items].find(i => i.type === "npc" && i.system?.slug === "andalau-of-the-flute");
		expect(followerItem).toBeUndefined();
	});
});

// -- Tests: buildSnapshot — back.choices -------------------------------------

describe("CharacterArcana.buildSnapshot() — back.choices", () => {
	it("back.choices is null when arcanum has no back choices", async () => {
		const { charArcana } = makeArcanaWithFollowers([makeArcanumItem(FFYRNIG_SPHERE)], [FFYRNIG_SPHERE]);
		const snap = await charArcana.buildSnapshot();
		expect(snap.minor.items[0].back.choices).toBeNull();
	});

	it("back.choices is a ChoiceGroup when arcanum has back.choices", async () => {
		const { charArcana } = makeArcanaWithFollowers([makeArcanumItem(CRACKED_FLUTE)]);
		const snap = await charArcana.buildSnapshot();
		expect(snap.minor.items[0].back.choices).toBeInstanceOf(ChoiceGroup);
	});

	it("back.choices.list contains EntryRow instances for follower rows", async () => {
		const { charArcana } = makeArcanaWithFollowers([makeArcanumItem(CRACKED_FLUTE)]);
		const snap = await charArcana.buildSnapshot();
		const row = snap.minor.items[0].back.choices.list[0];
		expect(row).toBeInstanceOf(EntryRow);
		expect(row.slug).toBe("andalau-of-the-flute");
	});

	it("EntryRow.followers is empty when follower is not in actor.items", async () => {
		const { charArcana } = makeArcanaWithFollowers([makeArcanumItem(CRACKED_FLUTE)]);
		const snap = await charArcana.buildSnapshot();
		expect(snap.minor.items[0].back.choices.list[0].followers).toEqual([]);
	});

	it("EntryRow.followers resolves when follower is in actor.items", async () => {
		const { actor, charArcana } = makeArcanaWithFollowers([makeArcanumItem(CRACKED_FLUTE)]);
		actor.items.push(makeNpcItem("andalau-of-the-flute", { owned: false }));
		const snap = await charArcana.buildSnapshot();
		expect(snap.minor.items[0].back.choices.list[0].followers).toHaveLength(1);
		expect(snap.minor.items[0].back.choices.list[0].followers[0].slug).toBe("andalau-of-the-flute");
	});

	it("EntryRow.track.checks is [false] when backChoices count is 0", async () => {
		const { charArcana } = makeArcanaWithFollowers([makeArcanumItem(CRACKED_FLUTE)]);
		const snap = await charArcana.buildSnapshot();
		expect(snap.minor.items[0].back.choices.list[0].track.checks).toEqual([false]);
	});

	it("EntryRow.track.checks is [true] when backChoices count is 1", async () => {
		const { charArcana } = makeArcanaWithFollowers([
			makeArcanumItem(CRACKED_FLUTE, { backChoices: { "cracked-flute": { "andalau-of-the-flute": 1 } } }),
		]);
		const snap = await charArcana.buildSnapshot();
		expect(snap.minor.items[0].back.choices.list[0].track.checks).toEqual([true]);
	});
});

// ── onArcanumCreated ──────────────────────────────────────────────────────────

describe("CharacterArcana.onArcanumCreated", () => {
	it("pre-embeds linked follower with owned=false", async () => {
		const actor = makeActor([makeArcanumItem(CRACKED_FLUTE)]);
		const followerRepo = new FakeFollowerRepository([{
			slug: "andalau-of-the-flute", name: "The Andalau", tags: null,
			hp: { value: 6, max: 6 }, armor: "", damage: "",
			instinct: "", loyalty: { value: 0, max: 3 }, choices: null,
		}]);
		const followers = new CharacterFollowers(actor, followerRepo, makeResourceController());
		const charArcana = new CharacterArcana(actor, new FakeArcanaRepository(), null, null, followers);
		await charArcana.onArcanumCreated(makeArcanumItem(CRACKED_FLUTE));
		const followerItem = [...actor.items].find(i => i.type === "npc" && i.system?.slug === "andalau-of-the-flute");
		expect(followerItem?.system?.owned).toBe(false);
	});

	it("does not embed follower when arcanum has no back choices", async () => {
		const actor = makeActor([makeArcanumItem(FFYRNIG_SPHERE)]);
		const followers = new CharacterFollowers(actor, new FakeFollowerRepository(), makeResourceController());
		const charArcana = new CharacterArcana(actor, new FakeArcanaRepository(), null, null, followers);
		await charArcana.onArcanumCreated(makeArcanumItem(FFYRNIG_SPHERE));
		expect([...actor.items].filter(i => i.type === "npc")).toHaveLength(0);
	});

	it("syncs outfit items when front item has inventoryColumn", async () => {
		const outfitItems = makeActorOutfitItems();
		const actor = makeActor([makeArcanumItem(BOW_WITH_NO_STRING)]);
		const charArcana = new CharacterArcana(actor, new FakeArcanaRepository(), null, outfitItems, null);
		await charArcana.onArcanumCreated(makeArcanumItem(BOW_WITH_NO_STRING));
		expect(outfitItems.sync).toHaveBeenCalledWith("arcana:bow-with-no-string", expect.any(Array));
	});

	it("deletes outfit item source when front item has no inventoryColumn", async () => {
		const outfitItems = makeActorOutfitItems();
		const actor = makeActor([makeArcanumItem(FFYRNIG_SPHERE)]);
		const charArcana = new CharacterArcana(actor, new FakeArcanaRepository(), null, outfitItems, null);
		await charArcana.onArcanumCreated(makeArcanumItem(FFYRNIG_SPHERE));
		expect(outfitItems.deleteBySource).toHaveBeenCalledWith("arcana:huge-wooden-sphere");
	});

	it("does nothing when slug is null", async () => {
		const outfitItems = makeActorOutfitItems();
		const charArcana = new CharacterArcana(makeActor(), new FakeArcanaRepository(), null, outfitItems, null);
		await charArcana.onArcanumCreated({ system: { slug: null, front: null, back: null } });
		expect(outfitItems.sync).not.toHaveBeenCalled();
		expect(outfitItems.deleteBySource).not.toHaveBeenCalled();
	});
});
