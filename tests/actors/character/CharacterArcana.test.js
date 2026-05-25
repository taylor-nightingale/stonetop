import { describe, it, expect, vi } from "vitest";
import { CharacterArcana } from "../../../module/actors/character/CharacterArcana.js";
import { Stats } from "../../../module/model/data/character/Stats.js";
import {
	ArcanaSnapshot, ArcanaSectionSnapshot,
	MinorArcanumSnapshot, MinorArcanumFrontSnapshot, MinorArcanumBackSnapshot,
	ChoiceGroup, ChoiceRow, HeadingRow,
} from "../../../module/model/snapshot/character/CharacterSnapshot.js";
import {FakeArcanaRepository} from "../../fakes/FakeArcanaRepository.js";

// -- Helpers ------------------------------------------------------------------

function makeFlags(store = {}) {
	return {
		_store: { ...store },
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

// -- Fixture ------------------------------------------------------------------

const FFYRNIG_SPHERE = {
	slug: "huge-wooden-sphere",
	front: {
		title: "A Huge Wooden Sphere",
		item: { name: "A Huge Wooden Sphere", weight: null, note: "immobile", inventoryColumn: null },
		description: "<p>Half-buried and largely overgrown.</p>",
		unlock: {
			slug: "huge-wooden-sphere",
			list: [
				{ type: "heading", description: "The pictograms depict some sort of recipe, which you can learn but you must…" },
				{ type: "heading", description: "Some context text." },
				{ type: "track",   slug: "dig-sphere",   description: "… first dig up and clean the sphere.", max: 1 },
				{ type: "track",   slug: "study-glyphs", description: "… spend weeks studying the glyphs.", max: 1 },
				{ type: "heading", description: "And then…" },
				{ type: "track",   slug: "risk-recipe",  description: "… risk getting the recipe wrong.", max: 3 },
			],
		},
	},
	back: {
		title: "Ffyrnig Tonic",
		item: { name: "Ffyrnig Tonic", weight: 1, note: "magical", inventoryColumn: "regular" },
		description: "<p>When you pickle fresh ffyrnig root…</p>",
		resource: { max: 3, maxStat: null, title: "Ffyrnig Tonic", labels: [] },
		move: {
			name: "When you take a draught of ffyrnig tonic",
			rollType: null,
			description: "<p>pick 1: regain HP or clear a debility.</p>",
		},
	},
};

// -- Build helper -------------------------------------------------------------

function makeFakeStats(values = {}) {
	return { getStats: () => new Stats(values) };
}

function makeActorOutfitItems() {
	return { sync: vi.fn(async () => {}), deleteBySource: vi.fn(async () => {}) };
}

function makeArcana(flagStore = {}, arcana = [FFYRNIG_SPHERE], fakeStats = null, outfitItems = null) {
	return new CharacterArcana(
		makeFlags(flagStore),
		new FakeArcanaRepository(arcana),
		fakeStats ?? makeFakeStats(),
		outfitItems ?? makeActorOutfitItems(),
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
			const snap = await makeArcana({ owned: ["huge-wooden-sphere"] }).buildSnapshot();
			expect(snap.major.items).toEqual([]);
		});
	});

	describe("owned arcana", () => {
		it("owned slug present in repo appears in minor.items", async () => {
			const snap = await makeArcana({ owned: ["huge-wooden-sphere"] }).buildSnapshot();
			expect(snap.minor.items).toHaveLength(1);
		});

		it("owned slug missing from repo is omitted silently", async () => {
			const arcana = new CharacterArcana(
				makeFlags({ owned: ["nonexistent-slug"] }),
				new FakeArcanaRepository([FFYRNIG_SPHERE]),
			);
			const snap = await arcana.buildSnapshot();
			expect(snap.minor.items).toHaveLength(0);
		});

		it("every item in minor.items has owned: true", async () => {
			const snap = await makeArcana({ owned: ["huge-wooden-sphere"] }).buildSnapshot();
			expect(snap.minor.items[0].owned).toBe(true);
		});

		it("returns a MinorArcanumSnapshot", async () => {
			const snap = await makeArcana({ owned: ["huge-wooden-sphere"] }).buildSnapshot();
			expect(snap.minor.items[0]).toBeInstanceOf(MinorArcanumSnapshot);
		});

		it("has correct slug", async () => {
			const snap = await makeArcana({ owned: ["huge-wooden-sphere"] }).buildSnapshot();
			expect(snap.minor.items[0].slug).toBe("huge-wooden-sphere");
		});
	});

	describe("flipped state", () => {
		it("flipped is false by default", async () => {
			const snap = await makeArcana({ owned: ["huge-wooden-sphere"] }).buildSnapshot();
			expect(snap.minor.items[0].flipped).toBe(false);
		});

		it("flipped is true when slug is in flipped flag", async () => {
			const snap = await makeArcana({
				owned:   ["huge-wooden-sphere"],
				flipped: ["huge-wooden-sphere"],
			}).buildSnapshot();
			expect(snap.minor.items[0].flipped).toBe(true);
		});
	});

	describe("front snapshot", () => {
		async function getItem(flagStore = {}) {
			return (await makeArcana({ owned: ["huge-wooden-sphere"], ...flagStore }).buildSnapshot()).minor.items[0];
		}

		it("front is a MinorArcanumFrontSnapshot", async () => {
			expect((await getItem()).front).toBeInstanceOf(MinorArcanumFrontSnapshot);
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

		it("front.unlock.list first item is a HeadingRow with the unlock description", async () => {
			const row = (await getItem()).front.unlock.list[0];
			expect(row).toBeInstanceOf(HeadingRow);
			expect(row.description).toBe("The pictograms depict some sort of recipe, which you can learn but you must…");
		});

		it("front.unlock.list has heading and choice nodes in order", async () => {
			const { list } = (await getItem()).front.unlock;
			expect(list).toHaveLength(6);
			expect(list[0].type).toBe("heading");
			expect(list[1].type).toBe("heading");
			expect(list[2].type).toBe("choice");
			expect(list[3].type).toBe("choice");
			expect(list[4].type).toBe("heading");
			expect(list[5].type).toBe("choice");
		});

		it("choice row has correct option slug and description", async () => {
			const row = (await getItem()).front.unlock.list[2];
			expect(row).toBeInstanceOf(ChoiceRow);
			expect(row.options[0].slug).toBe("dig-sphere");
			expect(row.options[0].description).toBe("… first dig up and clean the sphere.");
		});

		it("choice row defaults checks to all false when no count saved", async () => {
			const row = (await getItem()).front.unlock.list[2];
			expect(row.options[0].checks).toEqual([false]);
		});

		it("choice row with explicit max has checks array of that length", async () => {
			const row = (await getItem()).front.unlock.list[5];
			expect(row.options[0].checks).toHaveLength(3);
		});

		it("choice row checks reflect saved flag values", async () => {
			const row = (await getItem({ unlock: { "huge-wooden-sphere": { "dig-sphere": 1 } } })).front.unlock.list[2];
			expect(row.options[0].checks).toEqual([true]);
		});
	});

	describe("back snapshot", () => {
		async function getItem(flagStore = {}) {
			return (await makeArcana({ owned: ["huge-wooden-sphere"], ...flagStore }).buildSnapshot()).minor.items[0];
		}

		it("back is a MinorArcanumBackSnapshot", async () => {
			expect((await getItem()).back).toBeInstanceOf(MinorArcanumBackSnapshot);
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

		it("back.resource.current reflects inventoryResources", async () => {
			const item = (await makeArcana({ owned: ["huge-wooden-sphere"] })
				.buildSnapshot({}, { "huge-wooden-sphere": 2 })).minor.items[0];
			expect(item.back.resource.current).toBe(2);
		});

		it("back.resource is null when absent in JSON", async () => {
			const noResource = { ...FFYRNIG_SPHERE, back: { ...FFYRNIG_SPHERE.back, resource: undefined } };
			const arcana = new CharacterArcana(
				makeFlags({ owned: ["huge-wooden-sphere"] }),
				new FakeArcanaRepository([noResource]),
			);
			expect((await arcana.buildSnapshot()).minor.items[0].back.resource).toBeNull();
		});

		it("back.move is populated with correct name and rollType", async () => {
			expect((await getItem()).back.move).toMatchObject({
				name: "When you take a draught of ffyrnig tonic",
				rollType: null,
			});
		});

		it("back.move is null when absent in JSON", async () => {
			const noMove = { ...FFYRNIG_SPHERE, back: { ...FFYRNIG_SPHERE.back, move: undefined } };
			const arcana = new CharacterArcana(
				makeFlags({ owned: ["huge-wooden-sphere"] }),
				new FakeArcanaRepository([noMove]),
			);
			expect((await arcana.buildSnapshot()).minor.items[0].back.move).toBeNull();
		});
	});

	describe("mutation methods", () => {
		it("addArcanum adds slug to owned flag", async () => {
			const flags = makeFlags();
			const arcana = new CharacterArcana(flags, new FakeArcanaRepository());
			await arcana.addArcanum("some-slug");
			expect(flags.setFlag).toHaveBeenCalledWith("owned", ["some-slug"]);
		});

		it("removeArcanum removes slug from owned flag", async () => {
			const flags = makeFlags({ owned: ["some-slug", "other-slug"] });
			const arcana = new CharacterArcana(flags, new FakeArcanaRepository());
			await arcana.removeArcanum("some-slug");
			expect(flags.setFlag).toHaveBeenCalledWith("owned", ["other-slug"]);
		});

		it("flipArcanum adds slug to flipped flag", async () => {
			const flags = makeFlags();
			const arcana = new CharacterArcana(flags, new FakeArcanaRepository());
			await arcana.flipArcanum("some-slug");
			expect(flags.setFlag).toHaveBeenCalledWith("flipped", ["some-slug"]);
		});

		it("unflipArcanum removes slug from flipped flag", async () => {
			const flags = makeFlags({ flipped: ["some-slug"] });
			const arcana = new CharacterArcana(flags, new FakeArcanaRepository());
			await arcana.unflipArcanum("some-slug");
			expect(flags.setFlag).toHaveBeenCalledWith("flipped", []);
		});

		it("setUnlockCount stores the count nested by arcanumSlug then optionSlug", async () => {
			const flags = makeFlags();
			const arcana = new CharacterArcana(flags, new FakeArcanaRepository());
			await arcana.setUnlockCount("huge-wooden-sphere", "dig-sphere", 1);
			expect(flags.setFlag).toHaveBeenCalledWith("unlock", { "huge-wooden-sphere": { "dig-sphere": 1 } });
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

describe("CharacterArcana.buildSnapshot() — inventoryResources", () => {
	it("back.resource uses inventoryResources current for back.resource arcana", async () => {
		const item = (await makeArcana({ owned: ["huge-wooden-sphere"] })
			.buildSnapshot({}, { "huge-wooden-sphere": 2 })).minor.items[0];
		expect(item.back.resource.current).toBe(2);
	});

	it("back.resource defaults to current 0 when not in inventoryResources", async () => {
		const item = (await makeArcana({ owned: ["huge-wooden-sphere"] }).buildSnapshot()).minor.items[0];
		expect(item.back.resource.current).toBe(0);
	});

	it("back.item.resource is a resolved Resource on the OutfitItem snapshot", async () => {
		const item = (await makeArcana({ owned: ["bow-with-no-string"] }, [BOW_WITH_NO_STRING])
			.buildSnapshot({}, { "bow-with-no-string": 1 })).minor.items[0];
		expect(item.back.item.resource).not.toBeNull();
		expect(item.back.item.resource.current).toBe(1);
		expect(item.back.item.resource.max).toBe(3);
		expect(item.back.item.resource.title).toBe("Ammo");
	});

	it("back.item.resource defaults to current 0 when not in inventoryResources", async () => {
		const item = (await makeArcana({ owned: ["bow-with-no-string"] }, [BOW_WITH_NO_STRING]).buildSnapshot()).minor.items[0];
		expect(item.back.item.resource.current).toBe(0);
	});

	it("back.resource is null for arcana whose resource lives on the item", async () => {
		const item = (await makeArcana({ owned: ["bow-with-no-string"] }, [BOW_WITH_NO_STRING]).buildSnapshot()).minor.items[0];
		expect(item.back.resource).toBeNull();
	});

	it("back.item.resource is null for arcana with a standalone resource", async () => {
		const item = (await makeArcana({ owned: ["huge-wooden-sphere"] }).buildSnapshot()).minor.items[0];
		expect(item.back.item.resource).toBeNull();
	});

	it("back.resource is null when neither back.resource nor back.item.resource defined", async () => {
		const noResource = { ...FFYRNIG_SPHERE, back: { ...FFYRNIG_SPHERE.back, resource: null } };
		const arcana = new CharacterArcana(
			makeFlags({ owned: ["huge-wooden-sphere"] }),
			new FakeArcanaRepository([noResource]),
		);
		expect((await arcana.buildSnapshot()).minor.items[0].back.resource).toBeNull();
	});
});

describe("CharacterArcana.buildSnapshot() — maxStat resolution", () => {
	it("maxStat resolves to stat value from stats", async () => {
		const arcana = new CharacterArcana(
			makeFlags({ owned: ["carvings-in-a-cave"] }),
			new FakeArcanaRepository([CARVINGS_IN_A_CAVE]),
			makeFakeStats({ con: 3 }),
		);
		const item = (await arcana.buildSnapshot()).minor.items[0];
		expect(item.back.resource.max).toBe(3);
	});

	it("maxStat resolves to 0 when stat is missing", async () => {
		const arcana = new CharacterArcana(
			makeFlags({ owned: ["carvings-in-a-cave"] }),
			new FakeArcanaRepository([CARVINGS_IN_A_CAVE]),
			makeFakeStats(),
		);
		const item = (await arcana.buildSnapshot()).minor.items[0];
		expect(item.back.resource.max).toBe(0);
	});

	it("fixed max is used unchanged when maxStat is null", async () => {
		const item = (await makeArcana({ owned: ["huge-wooden-sphere"] }).buildSnapshot()).minor.items[0];
		expect(item.back.resource.max).toBe(3);
	});
});

describe("CharacterArcana.buildSnapshot() — checked state", () => {
	it("checked defaults to false when not in checkedMap", async () => {
		const item = (await makeArcana({ owned: ["huge-wooden-sphere"] }).buildSnapshot()).minor.items[0];
		expect(item.checked).toBe(false);
	});

	it("checked is true when slug is in checkedMap", async () => {
		const item = (await makeArcana({ owned: ["huge-wooden-sphere"] })
			.buildSnapshot({ "huge-wooden-sphere": true }, {})).minor.items[0];
		expect(item.checked).toBe(true);
	});

	it("checked is false when slug is not in checkedMap", async () => {
		const item = (await makeArcana({ owned: ["huge-wooden-sphere"] })
			.buildSnapshot({ "other-slug": true }, {})).minor.items[0];
		expect(item.checked).toBe(false);
	});
});

describe("CharacterArcana — outfitItems sync", () => {
	it("addArcanum syncs embedded item when arcanum has a front inventoryColumn", async () => {
		const outfitItems = makeActorOutfitItems();
		const arcana = makeArcana({}, [BOW_WITH_NO_STRING], null, outfitItems);
		await arcana.addArcanum("bow-with-no-string");
		expect(outfitItems.sync).toHaveBeenCalledWith(
			"arcana:bow-with-no-string",
			expect.arrayContaining([expect.objectContaining({ flags: expect.objectContaining({ stonetop: expect.objectContaining({ source: "arcana:bow-with-no-string" }) }) })]),
		);
	});

	it("addArcanum deletes source when front item has no inventoryColumn", async () => {
		const outfitItems = makeActorOutfitItems();
		const arcana = makeArcana({}, [FFYRNIG_SPHERE], null, outfitItems);
		await arcana.addArcanum("huge-wooden-sphere");
		expect(outfitItems.deleteBySource).toHaveBeenCalledWith("arcana:huge-wooden-sphere");
	});

	it("removeArcanum deletes embedded item by source", async () => {
		const outfitItems = makeActorOutfitItems();
		const arcana = makeArcana({ owned: ["bow-with-no-string"] }, [BOW_WITH_NO_STRING], null, outfitItems);
		await arcana.removeArcanum("bow-with-no-string");
		expect(outfitItems.deleteBySource).toHaveBeenCalledWith("arcana:bow-with-no-string");
	});

	it("flipArcanum syncs to the back item", async () => {
		const outfitItems = makeActorOutfitItems();
		const arcana = makeArcana({ owned: ["bow-with-no-string"] }, [BOW_WITH_NO_STRING], null, outfitItems);
		await arcana.flipArcanum("bow-with-no-string");
		expect(outfitItems.sync).toHaveBeenCalledWith("arcana:bow-with-no-string", expect.any(Array));
	});

	it("unflipArcanum syncs to the front item", async () => {
		const outfitItems = makeActorOutfitItems();
		const arcana = makeArcana(
			{ owned: ["bow-with-no-string"], flipped: ["bow-with-no-string"] },
			[BOW_WITH_NO_STRING], null, outfitItems,
		);
		await arcana.unflipArcanum("bow-with-no-string");
		expect(outfitItems.sync).toHaveBeenCalledWith("arcana:bow-with-no-string", expect.any(Array));
	});

	it("does not throw when outfitItems is null", async () => {
		const arcana = new CharacterArcana(makeFlags({}), new FakeArcanaRepository([BOW_WITH_NO_STRING]));
		await expect(arcana.addArcanum("bow-with-no-string")).resolves.not.toThrow();
	});
});
