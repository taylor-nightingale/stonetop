import { describe, it, expect, vi } from "vitest";
import { CharacterArcana } from "../../../src/actors/character/CharacterArcana.js";
import { CharacterFollowers } from "../../../src/actors/character/CharacterFollowers.js";
import { ChoiceGroupControllerFactory } from "../../../src/actors/character/ChoiceGroupControllerFactory.js";
import { ContainerOutfitSync } from "../../../src/actors/character/ContainerOutfitSync.js";
import { FollowerSideEffectHandler } from "../../../src/actors/character/SideEffectHandler.js";
import { ResourceController } from "../../../src/actors/character/ResourceController.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeArcanaRepository } from "../../fakes/FakeArcanaRepository.js";
import { FakeFollowerRepository } from "../../fakes/FakeFollowerRepository.js";
import { FakeMoves } from "../../fakes/FakeMoves.js";
import { Stats } from "../../../src/model/data/character/Stats.js";
import {
	ArcanaSnapshot, ArcanaSectionSnapshot,
	ArcanumSnapshot, ArcanumSideSnapshot,
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
			choiceValues:     overrides.choiceValues ?? {},
		},
	};
}

function makeNpcItem(slug, overrides = {}) {
	return {
		_id: slug + "-npc",
		type: "follower",
		name: slug,
		system: {
			slug, owned: overrides.owned ?? false, tags: "",
			hp: { value: 6, max: 6 }, armor: "",
			damage: "",
			instinct: "", loyalty: { value: 0, max: 3 },
			choices: null, arcanaSlug: overrides.arcanaSlug ?? null, specialQuality: "", choiceValues: {},
		},
	};
}

function makeActor(items = []) {
	return new FakeCharacterActorBuilder().withItems(items).build();
}

// -- Fixtures ------------------------------------------------------------------

const FFYRNIG_SPHERE = {
	slug: "huge-wooden-sphere",
	front: {
		title: "A Huge Wooden Sphere",
		item: { name: "A Huge Wooden Sphere", weight: null, note: "immobile", inventoryColumn: null },
		choices: [{
			slug: "huge-wooden-sphere",
			list: [
				{ type: "heading", content: { text: "The pictograms depict some sort of recipe, which you can learn but you must…" } },
				{ type: "heading", content: { text: "Some context text." } },
				{ type: "heading", slug: "dig-sphere",   content: { text: "… first dig up and clean the sphere." }, track: { max: 1 } },
				{ type: "heading", slug: "study-glyphs", content: { text: "… spend weeks studying the glyphs." }, track: { max: 1 } },
				{ type: "heading", content: { text: "And then…" } },
				{ type: "heading", slug: "risk-recipe",  content: { text: "… risk getting the recipe wrong." }, track: { max: 3 } },
			],
		}],
	},
	back: {
		title: "Ffyrnig Tonic",
		item: { name: "Ffyrnig Tonic", weight: 1, note: "magical", inventoryColumn: "regular" },
		resource: { max: 3, maxStat: null, title: "Ffyrnig Tonic", labels: [] },
		choices: [],
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
	return new ResourceController(new FakeCharacterActorBuilder().build());
}

// Mirrors StonetopCharacter: granted outfit items are written by ContainerOutfitSync, so a
// CharacterArcana built without one grants nothing.
function makeOutfitSync(outfitItems) {
	return new ContainerOutfitSync(outfitItems).register("arcanum", CharacterArcana.outfitGrantFor);
}

function makeArcana(items = [], arcana = [FFYRNIG_SPHERE], fakeStats = null, outfitItems = null) {
	const actor  = makeActor(items);
	const outfit = outfitItems ?? makeActorOutfitItems();
	return new CharacterArcana(actor, new FakeArcanaRepository(arcana), fakeStats ?? makeFakeStats(), null, new ChoiceGroupControllerFactory(actor), null, makeOutfitSync(outfit));
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

		// The front's body is one choices group.
		const unlock = async (overrides = {}) => (await getItem(overrides)).front.choices[0];

		it("front is an ArcanumSideSnapshot", async () => {
			expect((await getItem()).front).toBeInstanceOf(ArcanumSideSnapshot);
		});

		it("front has correct title and item", async () => {
			const { front } = await getItem();
			expect(front.title.raw).toBe("A Huge Wooden Sphere");
			expect(front.item?.weight).toBeNull();
			expect(front.item?.note.raw).toBe("immobile");
		});

		it("the front group is a ChoiceGroup namespaced by the arcanum slug", async () => {
			const g = await unlock();
			expect(g).toBeInstanceOf(ChoiceGroup);
			expect(g.slug).toBe("huge-wooden-sphere");
		});

		it("the group's first item is an EntryRow with the recipe text", async () => {
			const row = (await unlock()).list[0];
			expect(row).toBeInstanceOf(EntryRow);
			expect(row.content.text.raw).toBe("The pictograms depict some sort of recipe, which you can learn but you must…");
			expect(row.track).toBeNull();
		});

		it("the group's list has all entry nodes", async () => {
			const { list } = await unlock();
			expect(list).toHaveLength(6);
			expect(list.every(r => r.type === "entry")).toBe(true);
		});

		it("a tracked entry has slug + checks (defaults false, max:3 → length 3, reflects saved values)", async () => {
			const row = (await unlock()).list[2];
			expect(row.track.slug).toBe("dig-sphere");
			expect(row.content.text.raw).toBe("… first dig up and clean the sphere.");
			expect(row.track.checks).toEqual([false]);
			expect((await unlock()).list[5].track.checks).toHaveLength(3);
			const saved = (await unlock({ choiceValues: { "huge-wooden-sphere": { "dig-sphere": 1 } } })).list[2];
			expect(saved.track.checks).toEqual([true]);
		});
	});

	describe("back snapshot", () => {
		async function getItem(overrides = {}) {
			return (await makeArcana([makeArcanumItem(FFYRNIG_SPHERE, overrides)]).buildSnapshot()).minor.items[0];
		}

		it("back is an ArcanumSideSnapshot", async () => {
			expect((await getItem()).back).toBeInstanceOf(ArcanumSideSnapshot);
		});

		it("back has correct title and item", async () => {
			const { back } = await getItem();
			expect(back.title.raw).toBe("Ffyrnig Tonic");
			expect(back.item?.weight).toBe(1);
			expect(back.item?.note.raw).toBe("magical");
		});

		it("back.resource is populated and defaults current to 0", async () => {
			expect((await getItem()).back.resource).toMatchObject({ current: 0, max: 3, title: "Ffyrnig Tonic" });
		});

		it("back.resource.current reflects resourceController", async () => {
			const ctrl = new ResourceController(new FakeCharacterActorBuilder().build());
			await ctrl.set("inventory", "huge-wooden-sphere", 2);
			const item = (await makeArcana([makeArcanumItem(FFYRNIG_SPHERE)])
				.buildSnapshot({}, ctrl)).minor.items[0];
			expect(item.back.resource.current).toBe(2);
		});

		it("back.resource is null when absent in JSON", async () => {
			const noResource = { ...FFYRNIG_SPHERE, back: { ...FFYRNIG_SPHERE.back, resource: undefined } };
			const arcana = new CharacterArcana(makeActor([makeArcanumItem(noResource)]), new FakeArcanaRepository());
			expect((await arcana.buildSnapshot()).minor.items[0].back.resource).toBeNull();
		});

		it("back.choices is an empty array when absent in JSON", async () => {
			expect((await getItem()).back.choices).toEqual([]);
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

		it("setChoiceCount on the front group is reflected in buildSnapshot check state", async () => {
			const arcana = makeArcana([makeArcanumItem(FFYRNIG_SPHERE)]);
			await arcana.setChoiceCount("huge-wooden-sphere", "huge-wooden-sphere", "dig-sphere", 1);
			const snap = await arcana.buildSnapshot();
			const row = snap.minor.items[0].front.choices[0].list[2];
			expect(row.track.checks).toEqual([true]);
		});

		it("setChoiceCount on the back-choices group is reflected in buildSnapshot back choices track", async () => {
			const arcana = makeArcana([makeArcanumItem(CRACKED_FLUTE)]);
			await arcana.setChoiceCount("cracked-flute", "cracked-flute", "andalau-of-the-flute", 1);
			const snap = await arcana.buildSnapshot();
			expect(snap.minor.items[0].back.choices[0].list[0].track.checks).toEqual([true]);
		});

		it("selectChoice writes the picked option under the group slug and clears its siblings", async () => {
			const item = makeArcanumItem({
				slug: "picky",
				front: { unlock: { slug: "picky", list: [{ type: "pick", options: [{ slug: "a" }, { slug: "b" }] }] } },
				back: {},
			});
			const arcana = makeArcana([item], [{ slug: "picky" }]);
			await arcana.selectChoice("picky", "picky", "a", "a,b");
			expect(item.system.choiceValues).toEqual({ picky: { a: 1, b: 0 } });
		});

		it("setChoiceText writes the input text under the group slug", async () => {
			const item = makeArcanumItem({ slug: "texty", front: { unlock: { slug: "texty", list: [] } }, back: {} });
			const arcana = makeArcana([item], [{ slug: "texty" }]);
			await arcana.setChoiceText("texty", "texty", "note-input", "hello");
			expect(item.system.choiceValues).toEqual({ texty: { "note-input": "hello" } });
		});

		it("setBlankValue writes a write-in field under the reserved 'blanks' namespace", async () => {
			const item = makeArcanumItem({ slug: "horn", front: {}, back: {} });
			const arcana = makeArcana([item], [{ slug: "horn" }]);
			await arcana.setBlankValue("horn", 0, "3");
			await arcana.setBlankValue("horn", "1", "2");
			expect(item.system.choiceValues).toEqual({ blanks: { "0": "3", "1": "2" } });
		});

		it("setBlankValue writes like any other choice value, dictating no render behaviour", async () => {
			const item = makeArcanumItem({ slug: "horn", front: {}, back: {} });
			const actor = makeActor([item]);
			const arcana = new CharacterArcana(actor, new FakeArcanaRepository([{slug: "horn"}]), makeFakeStats(), null, new ChoiceGroupControllerFactory(actor), null, makeOutfitSync(makeActorOutfitItems()));
			await arcana.setBlankValue("horn", 0, "3");
			await arcana.setChoiceText("horn", "horn", "note", "x");
			// Keeping focus while tabbing between blanks is the sheet's job (buildFocusSelector), not
			// something the write path suppresses.
			expect(actor.updateOps).toEqual([{}, {}]);
		});

		it("getBlanks returns the stored write-in map (empty object when none)", async () => {
			const withBlanks = makeArcanumItem({ slug: "horn", front: {}, back: {} }, { choiceValues: { blanks: { "0": "4" } } });
			expect(makeArcana([withBlanks], [{ slug: "horn" }]).getBlanks("horn")).toEqual({ "0": "4" });
			const empty = makeArcanumItem({ slug: "bare", front: {}, back: {} });
			expect(makeArcana([empty], [{ slug: "bare" }]).getBlanks("bare")).toEqual({});
			expect(makeArcana([], []).getBlanks("missing")).toEqual({});
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
		const ctrl = new ResourceController(new FakeCharacterActorBuilder().build());
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
		const ctrl = new ResourceController(new FakeCharacterActorBuilder().build());
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
		const arcana = new CharacterArcana(makeActor([makeArcanumItem(noResource)]), new FakeArcanaRepository());
		expect((await arcana.buildSnapshot()).minor.items[0].back.resource).toBeNull();
	});
});

describe("CharacterArcana.buildSnapshot() — maxStat resolution", () => {
	it("maxStat resolves to stat value from stats", async () => {
		const arcana = new CharacterArcana(makeActor([makeArcanumItem(CARVINGS_IN_A_CAVE)]), new FakeArcanaRepository(), makeFakeStats({con: 3}));
		const item = (await arcana.buildSnapshot()).minor.items[0];
		expect(item.back.resource.max).toBe(3);
	});

	it("maxStat resolves to 0 when stat is missing", async () => {
		const arcana = new CharacterArcana(makeActor([makeArcanumItem(CARVINGS_IN_A_CAVE)]), new FakeArcanaRepository(), makeFakeStats());
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
		choices: [{
			slug: "cracked-flute",
			list: [
				{ type: "entry", slug: "andalau-of-the-flute", grants: [{ type: "follower", slug: "andalau-of-the-flute", locations: ["inline", "tab"] }], content: {}, track: { max: 1 } },
			],
		}],
		item: null,
		description: "<p>The andalau manifests.</p>",
		resource: null,
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
		choices: [{
			slug: "stone-idol",
			list: [
				{ type: "entry", slug: "all-mighty-thistlewisk", grants: [{ type: "follower", slug: "all-mighty-thistlewisk", locations: ["inline", "tab"] }], content: {}, track: { max: 1 } },
			],
		}],
		item: null,
		description: "<p>It wakes.</p>",
		resource: null,
	},
};

function makeArcanaWithFollowers(items = [], arcana = [CRACKED_FLUTE]) {
	const actor = makeActor(items);
	const followerRepo = new FakeFollowerRepository();
	const factory = new ChoiceGroupControllerFactory(actor);
	const followers = new CharacterFollowers(actor, followerRepo, makeResourceController(), factory);
	factory.subscribe(new FollowerSideEffectHandler(followers));
	const charArcana = new CharacterArcana(actor, new FakeArcanaRepository(arcana), null, followers, factory);
	return { actor, charArcana, followers };
}

// -- Tests: follower sync ------------------------------------------------------

describe("CharacterArcana — follower sync", () => {
	it("flipArcanum does not change follower ownership", async () => {
		const { actor, charArcana } = makeArcanaWithFollowers([makeArcanumItem(CRACKED_FLUTE)]);
		// A stale, un-owned follower item must be left untouched by a flip — only the checkbox adds it.
		actor.items.push(makeNpcItem("andalau-of-the-flute", { owned: false }));
		await charArcana.flipArcanum("cracked-flute");
		const followerItem = [...actor.items].find(i => i.type === "follower" && i.system?.slug === "andalau-of-the-flute");
		expect(followerItem?.system?.owned).toBe(false);
	});

	it("unflipArcanum does not remove or alter the follower", async () => {
		const { actor, charArcana } = makeArcanaWithFollowers([
			makeArcanumItem(CRACKED_FLUTE, { flipped: true }),
			makeNpcItem("andalau-of-the-flute", { owned: true }),
		]);
		await charArcana.unflipArcanum("cracked-flute");
		const followerItem = [...actor.items].find(i => i.type === "follower" && i.system?.slug === "andalau-of-the-flute");
		expect(followerItem?.system?.owned).toBe(true);
	});

	it("removeArcanum removes a follower the arcanum added, even when owned via its checkbox", async () => {
		const { actor, charArcana } = makeArcanaWithFollowers([
			makeArcanumItem(CRACKED_FLUTE),
			makeNpcItem("andalau-of-the-flute", { owned: true, arcanaSlug: "cracked-flute" }),
		]);
		await charArcana.removeArcanum("cracked-flute");
		const followerItem = [...actor.items].find(i => i.type === "follower" && i.system?.slug === "andalau-of-the-flute");
		expect(followerItem).toBeUndefined();
	});

	it("removeArcanum preserves a follower belonging to a different arcanum", async () => {
		const { actor, charArcana } = makeArcanaWithFollowers([
			makeArcanumItem(CRACKED_FLUTE),
			makeNpcItem("all-mighty-thistlewisk", { owned: true, arcanaSlug: "stone-idol" }),
		]);
		await charArcana.removeArcanum("cracked-flute");
		const followerItem = [...actor.items].find(i => i.type === "follower" && i.system?.slug === "all-mighty-thistlewisk");
		expect(followerItem).toBeDefined();
	});

	it("removeArcanum preserves an independent follower with no arcanaSlug (playbook/custom)", async () => {
		const { actor, charArcana } = makeArcanaWithFollowers([
			makeArcanumItem(CRACKED_FLUTE),
			makeNpcItem("crew", { owned: true, arcanaSlug: null }),
		]);
		await charArcana.removeArcanum("cracked-flute");
		const followerItem = [...actor.items].find(i => i.type === "follower" && i.system?.slug === "crew");
		expect(followerItem).toBeDefined();
	});

	it("addArcanum owns the card's referenced followers, off the tab", async () => {
		const actor = makeActor();
		const followerRepo = new FakeFollowerRepository([{
			slug: "andalau-of-the-flute", name: "The Andalau", tags: null,
			hp: { value: 6, max: 6 }, armor: "", damage: "",
			instinct: "", loyalty: { value: 0, max: 3 }, choices: null,
		}]);
		const followers = new CharacterFollowers(actor, followerRepo, makeResourceController());
		const charArcana = new CharacterArcana(actor, new FakeArcanaRepository([CRACKED_FLUTE]), null, followers);
		await charArcana.addArcanum("cracked-flute");
		const f = [...actor.items].find(i => i.type === "follower" && i.system?.slug === "andalau-of-the-flute");
		expect(f?.system?.owned).toBe(true);
		expect(f?.system?.showOnTab).toBe(false);
	});

	it("does not embed follower when arcanum has no back.choices", async () => {
		const { actor, charArcana } = makeArcanaWithFollowers([makeArcanumItem(FFYRNIG_SPHERE)], [FFYRNIG_SPHERE]);
		await charArcana.flipArcanum("huge-wooden-sphere");
		expect([...actor.items].filter(i => i.type === "follower")).toHaveLength(0);
	});

	it("does not throw when _followers is null", async () => {
		const arcana = new CharacterArcana(makeActor([makeArcanumItem(CRACKED_FLUTE)]), new FakeArcanaRepository([CRACKED_FLUTE]));
		await expect(arcana.flipArcanum("cracked-flute")).resolves.not.toThrow();
	});

	it("setChoiceCount>0 on back-choices embeds follower as owned=true", async () => {
		const actor = makeActor();
		const followerRepo = new FakeFollowerRepository([{
			slug: "andalau-of-the-flute", name: "The Andalau", tags: null,
			hp: { value: 6, max: 6 }, armor: "", damage: "",
			instinct: "", loyalty: { value: 0, max: 3 }, choices: null,
		}]);
		const factory = new ChoiceGroupControllerFactory(actor);
		const followers = new CharacterFollowers(actor, followerRepo, makeResourceController(), factory);
		factory.subscribe(new FollowerSideEffectHandler(followers));
		const charArcana = new CharacterArcana(actor, new FakeArcanaRepository(), null, followers, factory);
		actor.items.push(makeArcanumItem(CRACKED_FLUTE));
		await charArcana.setChoiceCount("cracked-flute", "cracked-flute", "andalau-of-the-flute", 1);
		const followerItem = [...actor.items].find(i => i.type === "follower" && i.system?.slug === "andalau-of-the-flute");
		expect(followerItem?.system?.owned).toBe(true);
	});

	it("setChoiceCount=0 on back-choices toggles the follower off the tab, keeps it owned", async () => {
		const { actor, charArcana } = makeArcanaWithFollowers([makeArcanumItem(CRACKED_FLUTE)]);
		actor.items.push(makeNpcItem("andalau-of-the-flute", { owned: true }));
		await charArcana.setChoiceCount("cracked-flute", "cracked-flute", "andalau-of-the-flute", 0);
		const f = [...actor.items].find(i => i.type === "follower" && i.system?.slug === "andalau-of-the-flute");
		expect(f?.system?.owned).toBe(true);
		expect(f?.system?.showOnTab).toBe(false);
	});

	it("keeps the card's follower REFERENCE whether or not the follower is owned, and owns it when checked", async () => {
		const actor = makeActor([makeArcanumItem(CRACKED_FLUTE)]);
		const followerRepo = new FakeFollowerRepository([{
			slug: "andalau-of-the-flute", name: "The Andalau", tags: null,
			hp: { value: 6, max: 6 }, armor: "", damage: "",
			instinct: "", loyalty: { value: 0, max: 3 }, choices: null,
		}]);
		const factory = new ChoiceGroupControllerFactory(actor);
		const followers = new CharacterFollowers(actor, followerRepo, makeResourceController(), factory);
		factory.subscribe(new FollowerSideEffectHandler(followers));
		const charArcana = new CharacterArcana(actor, new FakeArcanaRepository([CRACKED_FLUTE]), null, followers, factory);

		// Unchecked: nothing embedded, but the card row still references the follower by slug (the card
		// resolves it against followers.bySlug at render — CharacterFollowers builds the preview there).
		let snap = await charArcana.buildSnapshot();
		let row = snap.minor.items[0].back.choices[0].list.find(r => r.slug === "andalau-of-the-flute");
		expect([...actor.items].filter(i => i.type === "follower")).toHaveLength(0);
		expect(row.followers.slugs).toEqual(["andalau-of-the-flute"]);

		// Checking the box owns the follower; the card still references it by slug.
		await charArcana.setChoiceCount("cracked-flute", "cracked-flute", "andalau-of-the-flute", 1);
		const owned = [...actor.items].find(i => i.type === "follower" && i.system?.slug === "andalau-of-the-flute");
		expect(owned?.system?.owned).toBe(true);
		snap = await charArcana.buildSnapshot();
		row = snap.minor.items[0].back.choices[0].list.find(r => r.slug === "andalau-of-the-flute");
		expect(row.followers.slugs).toEqual(["andalau-of-the-flute"]);
	});
});

// -- Tests: buildSnapshot — back.choices -------------------------------------

describe("CharacterArcana.buildSnapshot() — back.choices", () => {
	it("back.choices is null when arcanum has no back choices", async () => {
		const { charArcana } = makeArcanaWithFollowers([makeArcanumItem(FFYRNIG_SPHERE)], [FFYRNIG_SPHERE]);
		const snap = await charArcana.buildSnapshot();
		expect(snap.minor.items[0].back.choices).toEqual([]);
	});

	it("back.choices is a ChoiceGroup when arcanum has back.choices", async () => {
		const { charArcana } = makeArcanaWithFollowers([makeArcanumItem(CRACKED_FLUTE)]);
		const snap = await charArcana.buildSnapshot();
		expect(snap.minor.items[0].back.choices[0]).toBeInstanceOf(ChoiceGroup);
	});

	it("back.choices[0].list contains EntryRow instances for follower rows", async () => {
		const { charArcana } = makeArcanaWithFollowers([makeArcanumItem(CRACKED_FLUTE)]);
		const snap = await charArcana.buildSnapshot();
		const row = snap.minor.items[0].back.choices[0].list[0];
		expect(row).toBeInstanceOf(EntryRow);
		expect(row.slug).toBe("andalau-of-the-flute");
	});

	it("EntryRow.followers is null when the row carries no follower link", async () => {
		const { charArcana } = makeArcanaWithFollowers([makeArcanumItem(FFYRNIG_SPHERE)], [FFYRNIG_SPHERE]);
		const snap = await charArcana.buildSnapshot();
		// FFYRNIG_SPHERE has no back.choices at all; a link-carrying row would instead yield a reference.
		expect(snap.minor.items[0].back.choices).toEqual([]);
	});

	it("EntryRow.followers is a slug REFERENCE — resolution to a card is CharacterFollowers' job", async () => {
		const { charArcana } = makeArcanaWithFollowers([makeArcanumItem(CRACKED_FLUTE)]);
		const snap = await charArcana.buildSnapshot();
		// buildSnapshot emits only the reference; no card data lives on the choice tree.
		expect(snap.minor.items[0].back.choices[0].list[0].followers.slugs).toEqual(["andalau-of-the-flute"]);
		expect(snap.minor.items[0].back.choices[0].list[0].followers.cards).toBeUndefined();
	});

	it("EntryRow.track.checks is [false] when backChoices count is 0", async () => {
		const { charArcana } = makeArcanaWithFollowers([makeArcanumItem(CRACKED_FLUTE)]);
		const snap = await charArcana.buildSnapshot();
		expect(snap.minor.items[0].back.choices[0].list[0].track.checks).toEqual([false]);
	});

	it("EntryRow.track.checks is [true] when backChoices count is 1", async () => {
		const { charArcana } = makeArcanaWithFollowers([
			makeArcanumItem(CRACKED_FLUTE, { choiceValues: { "cracked-flute": { "andalau-of-the-flute": 1 } } }),
		]);
		const snap = await charArcana.buildSnapshot();
		expect(snap.minor.items[0].back.choices[0].list[0].track.checks).toEqual([true]);
	});
});

// ── onArcanumCreated ──────────────────────────────────────────────────────────

describe("CharacterArcana.onArcanumCreated", () => {
	it("owns the card's referenced followers off the tab", async () => {
		const actor = makeActor([makeArcanumItem(CRACKED_FLUTE)]);
		const followerRepo = new FakeFollowerRepository([{
			slug: "andalau-of-the-flute", name: "The Andalau", tags: null,
			hp: { value: 6, max: 6 }, armor: "", damage: "",
			instinct: "", loyalty: { value: 0, max: 3 }, choices: null,
		}]);
		const followers = new CharacterFollowers(actor, followerRepo, makeResourceController());
		const charArcana = new CharacterArcana(actor, new FakeArcanaRepository(), null, followers);
		await charArcana.onArcanumCreated(makeArcanumItem(CRACKED_FLUTE));
		const f = [...actor.items].find(i => i.type === "follower" && i.system?.slug === "andalau-of-the-flute");
		expect(f?.system?.owned).toBe(true);
		expect(f?.system?.showOnTab).toBe(false);
	});

	it("does not embed follower when arcanum has no back choices", async () => {
		const actor = makeActor([makeArcanumItem(FFYRNIG_SPHERE)]);
		const followers = new CharacterFollowers(actor, new FakeFollowerRepository(), makeResourceController());
		const charArcana = new CharacterArcana(actor, new FakeArcanaRepository(), null, followers);
		await charArcana.onArcanumCreated(makeArcanumItem(FFYRNIG_SPHERE));
		expect([...actor.items].filter(i => i.type === "follower")).toHaveLength(0);
	});

	it("syncs outfit items when front item has inventoryColumn", async () => {
		const outfitItems = makeActorOutfitItems();
		const actor = makeActor([makeArcanumItem(BOW_WITH_NO_STRING)]);
		const charArcana = new CharacterArcana(actor, new FakeArcanaRepository(), null, null, null, null, makeOutfitSync(outfitItems));
		await charArcana.onArcanumCreated(makeArcanumItem(BOW_WITH_NO_STRING));
		expect(outfitItems.sync).toHaveBeenCalledWith("arcana:bow-with-no-string", expect.any(Array));
	});

	it("deletes outfit item source when front item has no inventoryColumn", async () => {
		const outfitItems = makeActorOutfitItems();
		const actor = makeActor([makeArcanumItem(FFYRNIG_SPHERE)]);
		const charArcana = new CharacterArcana(actor, new FakeArcanaRepository(), null, null, null, null, makeOutfitSync(outfitItems));
		await charArcana.onArcanumCreated(makeArcanumItem(FFYRNIG_SPHERE));
		expect(outfitItems.deleteBySource).toHaveBeenCalledWith("arcana:huge-wooden-sphere");
	});

	it("does nothing when slug is null", async () => {
		const outfitItems = makeActorOutfitItems();
		const charArcana = new CharacterArcana(makeActor(), new FakeArcanaRepository(), null, null);
		await charArcana.onArcanumCreated({ system: { slug: null, front: null, back: null } });
		expect(outfitItems.sync).not.toHaveBeenCalled();
		expect(outfitItems.deleteBySource).not.toHaveBeenCalled();
	});
});

// -- Tests: moves granted by choice-group entries (major arcana) ---------------

const AZURE_HAND = {
	slug: "azure-hand", major: true, name: "Azure Hand",
	front: { title: "Azure Hand", item: null, description: "<p>A staff.</p>", unlock: { slug: "azure-hand", list: [] } },
	back: {
		title: "Mysteries", item: null, description: "<p>The back.</p>",
		choices: [{ slug: "moves", title: "Moves", list: [
			{ type: "entry", slug: "battery",   track: { max: 1 }, grants: [{ type: "move", slug: "battery",   locations: ["inline"] }] },
			{ type: "entry", slug: "resonance", track: { max: 1 }, grants: [{ type: "move", slug: "resonance", locations: ["inline"] }] },
		] }],
	},
};

function makeArcanaWithMoves(items = [], moves = new FakeMoves(), arcana = [AZURE_HAND]) {
	const actor = makeActor(items);
	const charArcana = new CharacterArcana(actor, new FakeArcanaRepository(arcana), makeFakeStats(), null, null, moves);
	return { actor, charArcana, moves };
}

describe("CharacterArcana — granted moves", () => {
	it("onArcanumCreated registers an arcana-<slug> move category from the card's move grants", async () => {
		const { charArcana, moves } = makeArcanaWithMoves();
		await charArcana.onArcanumCreated(makeArcanumItem(AZURE_HAND));
		expect(moves.addedCategories).toEqual([
			{ type: "arcana-azure-hand", name: "Azure Hand", moveSlugs: ["battery", "resonance"] },
		]);
	});

	it("onArcanumCreated registers nothing for an arcanum that grants no moves (minor/custom)", async () => {
		const { charArcana, moves } = makeArcanaWithMoves();
		await charArcana.onArcanumCreated(makeArcanumItem(FFYRNIG_SPHERE));
		expect(moves.addedCategories).toEqual([]);
	});

	it("removeArcanum removes the arcana-<slug> move category", async () => {
		const { charArcana, moves } = makeArcanaWithMoves([makeArcanumItem(AZURE_HAND)]);
		await charArcana.removeArcanum("azure-hand");
		expect(moves.removedCategories).toContain("arcana-azure-hand");
	});
});

// ── sendArcanumMoveToChat ─────────────────────────────────────────────────────

describe("CharacterArcana.sendArcanumMoveToChat", () => {
	function arcanumWithInlineMove() {
		return makeArcanumItem({
			slug: "silvery-ring",
			front: { title: "Ring", description: "a ring", item: null, unlock: null },
			back:  { title: "Sigil", description: "the back", moves: [
				{ id: "move-abc12345", name: "Whispered Command", text: "Will someone to obey." },
			] },
		});
	}

	it("posts the inline move's name + text through the actor's chat surface", async () => {
		const actor = makeActor([arcanumWithInlineMove()]);
		const arcana = new CharacterArcana(actor, new FakeArcanaRepository([]));
		expect(await arcana.sendArcanumMoveToChat("move-abc12345")).toBe(true);
		expect(actor.chatDescriptions).toEqual([
			{ label: "Whispered Command", description: "Will someone to obey." },
		]);
	});

	it("returns false (and posts nothing) when no owned arcanum carries the id", async () => {
		const actor = makeActor([arcanumWithInlineMove()]);
		const arcana = new CharacterArcana(actor, new FakeArcanaRepository([]));
		expect(await arcana.sendArcanumMoveToChat("move-unknown")).toBe(false);
		expect(actor.chatDescriptions).toHaveLength(0);
	});
});
