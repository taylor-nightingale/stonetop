import { describe, expect, it, vi } from "vitest";
import { CharacterInventory } from "../../../src/actors/character/CharacterInventory.js";
import { ResourceController } from "../../../src/actors/character/ResourceController.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { InventoryPage, InventoryColumn, PageSection } from "../../../src/model/data/character/InventoryPage.js";
import { OutfitItemBuilder } from "../../../src/model/data/character/OutfitItem.js";
import { FakeInventoryRepository } from "../../fakes/FakeInventoryRepository.js";
import { FakeSteadingRepository } from "../../fakes/FakeSteadingRepository.js";
import { fakeI18n } from "../../fakes/foundry/FakeI18n.js";
import { OutfitSnapshot } from "../../../src/model/snapshot/character/CharacterSnapshot.js";
import { ArmorBreakdown } from "../../../src/model/data/character/ArmorBreakdown.js";

// -- Fake helpers ---------------------------------------------------------------

function makeActor(inventoryState = {}) {
	const actor = new FakeCharacterActorBuilder().build();
	actor.system.inventory = {
		checked:     inventoryState.checked     ?? {},
		regularPool: inventoryState.regularPool ?? 0,
		smallPool:   inventoryState.smallPool   ?? 0,
		otherItems:  inventoryState.otherItems  ?? "",
	};
	return actor;
}

function makeOutfitItem(overrides = {}) {
	const labels = overrides.resourceLabels ?? null;
	return new OutfitItemBuilder()
		.withSlug(overrides.slug ?? "test-item")
		.withName(overrides.name ?? "Test Item")
		.withWeight(overrides.weight ?? 1)
		.withNote(overrides.note ?? null)
		.withInventoryColumn(overrides.inventoryColumn ?? "regular")
		.withResource(labels != null ? { max: labels.length, title: null, labels } : (overrides.resource ?? null))
		.withQualifier(overrides.qualifier ?? "")
		.withOwnedId(overrides.ownedId ?? null)
		.build();
}

function makeRepo(items = []) {
	return new FakeInventoryRepository(items);
}

function makeRawEmbeddedItem(overrides = {}) {
	return {
		_id:    overrides._id    ?? "emb-1",
		type:   "outfitItem",
		name:   overrides.name   ?? "Embedded Item",
		// A granted item carries the stamp of whatever granted it; gear the player added has none.
		...(overrides.source
			? { flags: { stonetop: { grant: { source: `outfit:${overrides.source}`, key: `outfitItem:${overrides.slug}` } } } }
			: {}),
		system: {
			slug:            overrides.slug            ?? null,
			inventoryColumn: overrides.inventoryColumn ?? "regular",
			weight:          overrides.weight          ?? 1,
			tagList:         overrides.tagList         ?? "",
			note:            overrides.note            ?? null,
			resource:        overrides.resource        ?? null,
			twoCol:          overrides.twoCol          ?? false,
		},
	};
}

function makeActorOutfitItems(items = []) {
	return {
		getAll:        () => items,
		create:        vi.fn(async () => []),
		deleteById:    vi.fn(async () => []),
		deleteBySource: vi.fn(async () => []),
		sync:          vi.fn(async () => []),
	};
}

function makeResourceController() {
	return new ResourceController(new FakeCharacterActorBuilder().build());
}

// Which of the three printed load lines the marked ◇ land in.
const activeLoad = snap => snap.load.options.find(o => o.active)?.slug ?? null;

// The page is what the sheet draws. The real one names Book I p. 142's rows by slug, so these
// fixtures bring their own — see pageOf: one section per column, listing exactly what the repo holds.
function makeCi(inventoryState = {}, repo = null, outfitItems = null, resourceCtrl = null, steadingRepo = null, page = null) {
	const inventoryRepo = repo ?? makeRepo();
	return new CharacterInventory(
		makeActor(inventoryState),
		inventoryRepo,
		outfitItems ?? makeActorOutfitItems(),
		resourceCtrl ?? makeResourceController(),
		steadingRepo,
		page ?? inventoryRepo.page,
	);
}

// A repository holding the world's primary steading (or none). The steading is the real typed
// actor, so these cases fail if StonetopSteading stops answering name/prosperity/isLacking.
function makeSteadingRepo({ name = "Stonetop", prosperity = 0, lacking = false } = {}) {
	return FakeSteadingRepository.withSteading({
		name,
		attributes: { prosperity },
		debilities: { lacking },
	});
}

// Flatten all items across sections for a column
// A section holds layout runs; the runs hold the rows (see OutfitSection).
const sectionItems = (sections) => sections.flatMap(s => s.runs.flatMap(r => r.items));
function regularItems(snap) { return sectionItems(snap.regularSections); }
function smallItems(snap)   { return sectionItems(snap.smallSections); }

// -- CharacterInventory -------------------------------------------------------

describe("CharacterInventory", () => {
	it("checked returns {} when no flags set", () => {
		expect(makeCi().checked).toEqual({});
	});

	it("setItemChecked stores true for a slug", async () => {
		const ci = makeCi();
		await ci.setItemChecked("supplies", true);
		expect(ci.checked).toEqual({ supplies: true });
	});

	it("setItemChecked stores false to uncheck", async () => {
		const ci = makeCi({ checked: { supplies: true } });
		await ci.setItemChecked("supplies", false);
		expect(ci.checked).toEqual({ supplies: false });
	});

	it("setResource persists count in the inventory namespace of ResourceController", async () => {
		const resourceCtrl = makeResourceController();
		const ci = makeCi({}, null, null, resourceCtrl);
		await ci.setResource("bow-arrows", 2);
		expect(resourceCtrl.getCurrent("inventory", "bow-arrows")).toBe(2);
	});
});

// -- CharacterInventory.calculateArmor ----------------------------------------

function makeArmorItem(slug, armor) {
	return new OutfitItemBuilder()
		.withSlug(slug)
		.withName(slug)
		.withWeight(1)
		.withNote(null)
		.withInventoryColumn("regular")
		.withResource(null)
		.withArmor(armor)
		.build();
}

describe("CharacterInventory.calculateArmor", () => {
	it("returns 0 when no items are checked", () => {
		expect(makeCi().calculateArmor([makeArmorItem("thick-hides", { base: 1 })])).toBe(0);
	});

	it("returns the base value of a single equipped base-armor item", () => {
		const ci = makeCi({ checked: { "thick-hides": true } });
		expect(ci.calculateArmor([makeArmorItem("thick-hides", { base: 1 })])).toBe(1);
	});

	it("uses the highest base when multiple base-armor items are equipped", () => {
		const ci = makeCi({ checked: { "light-armor": true, "heavy-armor": true } });
		const items = [
			makeArmorItem("light-armor", { base: 1 }),
			makeArmorItem("heavy-armor", { base: 3 }),
		];
		expect(ci.calculateArmor(items)).toBe(3);
	});

	it("adds modifier to base when a modifier item is also equipped", () => {
		const ci = makeCi({ checked: { "thick-hides": true, "shield": true } });
		const items = [
			makeArmorItem("thick-hides", { base: 1 }),
			makeArmorItem("shield", { modifier: 1 }),
		];
		expect(ci.calculateArmor(items)).toBe(2);
	});

	it("returns modifier alone when no base item is equipped", () => {
		const ci = makeCi({ checked: { "shield": true } });
		expect(ci.calculateArmor([makeArmorItem("shield", { modifier: 1 })])).toBe(1);
	});

	it("ignores unchecked items", () => {
		const ci = makeCi({ checked: { "thick-hides": false } });
		expect(ci.calculateArmor([makeArmorItem("thick-hides", { base: 1 })])).toBe(0);
	});

	it("ignores items with no armor", () => {
		const ci = makeCi({ checked: { "cloak": true } });
		expect(ci.calculateArmor([makeArmorItem("cloak", null)])).toBe(0);
	});
});

// -- CharacterInventory.buildArmorBreakdown -----------------------------------

describe("CharacterInventory.buildArmorBreakdown", () => {
	it("returns an ArmorBreakdown naming the equipped gear", () => {
		const ci = makeCi({ checked: { "thick-hides": true, "shield": true } });
		const items = [
			makeArmorItem("thick-hides", { base: 1 }),
			makeArmorItem("shield", { modifier: 1 }),
		];
		const breakdown = ci.buildArmorBreakdown(items);
		expect(breakdown).toBeInstanceOf(ArmorBreakdown);
		expect(breakdown.value).toBe(2);
		expect(breakdown.contributions.map(c => c.name)).toEqual(["thick-hides", "shield"]);
	});

	it("leaves unchecked gear out of the contributions", () => {
		const ci = makeCi({ checked: { "thick-hides": true, "shield": false } });
		const items = [
			makeArmorItem("thick-hides", { base: 1 }),
			makeArmorItem("shield", { modifier: 1 }),
		];
		expect(ci.buildArmorBreakdown(items).contributions.map(c => c.name)).toEqual(["thick-hides"]);
	});

	it("is empty when nothing is checked", () => {
		expect(makeCi().buildArmorBreakdown([makeArmorItem("shield", { base: 1 })]).isEmpty).toBe(true);
	});
});

// -- CharacterInventory.getArmorBreakdown -------------------------------------

describe("CharacterInventory.getArmorBreakdown", () => {
	it("reads the equipped gear from the repository", async () => {
		const ci = makeCi({ checked: { shield: true } }, makeRepo([makeArmorItem("shield", { base: 2 })]));
		const breakdown = await ci.getArmorBreakdown();
		expect(breakdown.value).toBe(2);
		expect(breakdown.contributions.map(c => c.name)).toEqual(["shield"]);
	});
});

// -- CharacterInventory.getArmor ----------------------------------------------

describe("CharacterInventory.getArmor", () => {
	it("returns 0 when no items are checked", async () => {
		const ci = makeCi({}, makeRepo([makeArmorItem("shield", { base: 1 })]));
		expect(await ci.getArmor()).toBe(0);
	});

	it("returns base armor when item is checked", async () => {
		const ci = makeCi({ checked: { shield: true } }, makeRepo([makeArmorItem("shield", { base: 2 })]));
		expect(await ci.getArmor()).toBe(2);
	});
});

// -- CharacterInventory.buildSnapshot -----------------------------------------

describe("CharacterInventory.buildSnapshot", () => {
	it("returns an OutfitSnapshot", async () => {
		const snap = await makeCi().buildSnapshot(1);
		expect(snap).toBeInstanceOf(OutfitSnapshot);
	});

	it("regular item from repo appears in regularSections", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "knife", inventoryColumn: "regular" })]);
		const snap = await makeCi({}, repo).buildSnapshot(1);
		expect(regularItems(snap)).toHaveLength(1);
		expect(regularItems(snap)[0].slug).toBe("knife");
	});

	it("checked flag sets item.checked to true", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "knife", inventoryColumn: "regular" })]);
		const snap = await makeCi({ checked: { knife: true } }, repo).buildSnapshot(1);
		expect(regularItems(snap)[0].checked).toBe(true);
	});

	it("unchecked item defaults to false", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "knife", inventoryColumn: "regular" })]);
		const snap = await makeCi({}, repo).buildSnapshot(1);
		expect(regularItems(snap)[0].checked).toBe(false);
	});

	it("resource.current reflects saved inventory resource", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "bow-arrows", inventoryColumn: "regular", resourceLabels: ["low", "out"] })]);
		const resourceCtrl = makeResourceController();
		await resourceCtrl.set("inventory", "bow-arrows", 1);
		const snap = await makeCi({}, repo, null, resourceCtrl).buildSnapshot(1);
		expect(regularItems(snap)[0].resource.current).toBe(1);
	});

	it("item without resource has resource=null", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "knife", inventoryColumn: "regular", resource: null })]);
		const snap = await makeCi({}, repo).buildSnapshot(1);
		expect(regularItems(snap)[0].resource).toBeNull();
	});

	// Sections, order and layout are the PAGE's — the inventory renders whatever page it was handed,
	// and an item carries no position of its own. The page's own behaviour is pinned in
	// tests/model/snapshot/outfitSections.test.js; what matters here is that the snapshot follows it.
	it("renders the page's groups as separate sections, in the page's order", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "a" }), makeOutfitItem({ slug: "b" })]);
		const page = new InventoryPage([new InventoryColumn("regular", [
			new PageSection(["b"]), new PageSection(["a"]),
		])]);
		const snap = await makeCi({}, repo, null, null, null, page).buildSnapshot(1);
		expect(snap.regularSections).toHaveLength(2);
		expect(regularItems(snap).map(i => i.slug)).toEqual(["b", "a"]);
	});

	it("draws only the rows the page lists, whatever else the catalog holds", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "a" }), makeOutfitItem({ slug: "unlisted" })]);
		const page = new InventoryPage([new InventoryColumn("regular", [new PageSection(["a"])])]);
		const snap = await makeCi({}, repo, null, null, null, page).buildSnapshot(1);
		expect(regularItems(snap).map(i => i.slug)).toEqual(["a"]);
	});

	it("embedded items form a trailing section separate from the page's rows", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "knife", inventoryColumn: "regular" })]);
		const embedded = makeRawEmbeddedItem({ _id: "emb-1", slug: "arcanum-1", source: "arcana:arcanum-1" });
		const snap = await makeCi({}, repo, makeActorOutfitItems([embedded])).buildSnapshot(1);
		expect(snap.regularSections).toHaveLength(2);
		expect(sectionItems([snap.regularSections[0]]).some(i => i.slug === "knife")).toBe(true);
		expect(sectionItems([snap.regularSections[1]]).some(i => i.slug === "arcanum-1")).toBe(true);
	});

	it("embedded items are the only section when no repo items exist", async () => {
		const embedded = makeRawEmbeddedItem({ _id: "emb-1", slug: "arcanum-1", source: "arcana:arcanum-1" });
		const snap = await makeCi({}, makeRepo(), makeActorOutfitItems([embedded])).buildSnapshot(1);
		expect(snap.regularSections).toHaveLength(1);
		expect(sectionItems([snap.regularSections[0]]).some(i => i.slug === "arcanum-1")).toBe(true);
	});

	it("embedded item with no source has isCustom=true and ownedId set", async () => {
		const embedded = makeRawEmbeddedItem({ _id: "custom-1", name: "Custom Item" });
		const snap = await makeCi({}, null, makeActorOutfitItems([embedded])).buildSnapshot(1);
		const item = regularItems(snap).find(i => i.slug === "custom-1");
		expect(item.isCustom).toBe(true);
		expect(item.ownedId).toBe("custom-1");
	});

	// A legacy comma string, as a world written before the tag conversion still holds it: the read
	// path parses it, so the row renders correctly whether or not the world has been migrated yet.
	it("embedded item surfaces system.tagList as the snapshot tags", async () => {
		const embedded = makeRawEmbeddedItem({ _id: "custom-1", slug: "custom-1", tagList: "warm" });
		const snap = await makeCi({}, null, makeActorOutfitItems([embedded])).buildSnapshot(1);
		const item = regularItems(snap).find(i => i.slug === "custom-1");
		expect(item.tags.map((t) => t.label)).toEqual(["warm"]);
	});

	it("granted item has isCustom=false and ownedId=null", async () => {
		const embedded = makeRawEmbeddedItem({ _id: "emb-1", slug: "arcanum-1", source: "arcana:arcanum-1" });
		const snap = await makeCi({}, null, makeActorOutfitItems([embedded])).buildSnapshot(1);
		const item = regularItems(snap).find(i => i.slug === "arcanum-1");
		expect(item.isCustom).toBe(false);
		expect(item.ownedId).toBeNull();
	});

	it("embedded item uses system.slug as slug when present", async () => {
		const embedded = makeRawEmbeddedItem({ _id: "emb-1", slug: "smithy-tongs", source: "possession:smithy" });
		const snap = await makeCi({}, null, makeActorOutfitItems([embedded])).buildSnapshot(1);
		expect(regularItems(snap).some(i => i.slug === "smithy-tongs")).toBe(true);
	});

	it("embedded item falls back to _id as slug when no stonetop slug", async () => {
		const embedded = makeRawEmbeddedItem({ _id: "c-2", slug: null });
		const snap = await makeCi({}, null, makeActorOutfitItems([embedded])).buildSnapshot(1);
		expect(regularItems(snap).some(i => i.slug === "c-2")).toBe(true);
	});

	it("embedded item in small column appears in smallSections", async () => {
		const embedded = makeRawEmbeddedItem({ _id: "c-3", inventoryColumn: "small" });
		const snap = await makeCi({}, null, makeActorOutfitItems([embedded])).buildSnapshot(1);
		expect(smallItems(snap).some(i => i.slug === "c-3")).toBe(true);
	});

	it("puts a small-column row in the small column", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "chalk", inventoryColumn: "small" })]);
		const snap = await makeCi({}, repo).buildSnapshot(1);
		expect(smallItems(snap).map(i => i.slug)).toEqual(["chalk"]);
		expect(regularItems(snap)).toHaveLength(0);
	});

	it("clearSelections unmarks every item and empties both pools", async () => {
		const ci = makeCi({ checked: { armor: true, rope: true }, regularPool: 5, smallPool: 4 });
		await ci.clearSelections();
		expect(ci.checked).toEqual({});
		expect(ci.regularPool).toBe(0);
		expect(ci.smallPool).toBe(0);
	});

	it("clearSelections writes each mark as a deletion key, since Foundry merges the update", async () => {
		const actor = makeActor({ checked: { armor: true } });
		const ci = new CharacterInventory(actor, makeRepo(), makeActorOutfitItems(), makeResourceController());
		actor.update = vi.fn(async () => {});
		await ci.clearSelections();
		expect(actor.update).toHaveBeenCalledWith({
			"system.inventory.checked":     { "-=armor": null },
			"system.inventory.regularPool": 0,
			"system.inventory.smallPool":   0,
		});
	});

	it("clearSelections leaves the other-items note alone — it is not a selection", async () => {
		const ci = makeCi({ checked: { armor: true }, otherItems: "a bag of teeth" });
		await ci.clearSelections();
		expect(ci.otherItems).toBe("a bag of teeth");
	});

	it("marks nothing and sits in the light band when no item is checked", async () => {
		const snap = await makeCi({}, makeRepo([makeOutfitItem({ slug: "rope", weight: 2 })])).buildSnapshot(1);
		expect(snap.load.markedWeight).toBe(0);
		expect(activeLoad(snap)).toBe("light");
	});

	it("counts the weight of every checked regular item", async () => {
		const repo = makeRepo([
			makeOutfitItem({ slug: "armor", weight: 3 }),
			makeOutfitItem({ slug: "rope",  weight: 1 }),
			makeOutfitItem({ slug: "tent",  weight: 4 }),
		]);
		const snap = await makeCi({ checked: { armor: true, rope: true } }, repo).buildSnapshot(1);
		expect(snap.load.markedWeight).toBe(4);
		expect(activeLoad(snap)).toBe("normal");
	});

	it("counts the undefined pool's diamonds alongside the checked items", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "armor", weight: 3 })]);
		const snap = await makeCi({ checked: { armor: true }, regularPool: 4 }, repo).buildSnapshot(1);
		expect(snap.load.markedWeight).toBe(7);
		expect(activeLoad(snap)).toBe("heavy");
	});

	it("counts custom (embedded) items, which carry weight like any other", async () => {
		const outfitItems = makeActorOutfitItems([makeRawEmbeddedItem({ slug: "idol", weight: 2 })]);
		const snap = await makeCi({ checked: { idol: true } }, makeRepo(), outfitItems).buildSnapshot(1);
		expect(snap.load.markedWeight).toBe(2);
		expect(activeLoad(snap)).toBe("light");
	});

	it("does not count small items — they are □ and carry no load", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "chalk", weight: 1, inventoryColumn: "small" })]);
		const snap = await makeCi({ checked: { chalk: true } }, repo).buildSnapshot(1);
		expect(snap.load.markedWeight).toBe(0);
	});

	it("offers the three printed load lines, with only the marked band active", async () => {
		const snap = await makeCi({ regularPool: 5 }).buildSnapshot(1);
		expect(snap.load.options.map(o => o.slug)).toEqual(["light", "normal", "heavy"]);
		expect(snap.load.options.map(o => o.active)).toEqual([false, true, false]);
		expect(snap.load.options[0].note).toBe("stonetop.inventory.outfit.light");
	});

	it("is not over capacity at the 9 ◇ the Outfit move allows", async () => {
		const snap = await makeCi({ regularPool: 9 }).buildSnapshot(1);
		expect(snap.load.capacity).toBe(9);
		expect(snap.load.overCapacity).toBe(false);
	});

	it("flags marking more than the 9 ◇ allowed, without stopping it", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "tent", weight: 4 })]);
		const snap = await makeCi({ checked: { tent: true }, regularPool: 7 }, repo).buildSnapshot(1);
		expect(snap.load.markedWeight).toBe(11);
		expect(snap.load.overCapacity).toBe(true);
		expect(activeLoad(snap)).toBe("heavy");
	});

	it("regularPool.current reflects regularPool flag", async () => {
		const snap = await makeCi({ regularPool: 3 }).buildSnapshot(1);
		expect(snap.regularPool.current).toBe(3);
	});

	it("smallPool.current reflects smallPool flag", async () => {
		const snap = await makeCi({ smallPool: 5 }).buildSnapshot(1);
		expect(snap.smallPool.current).toBe(5);
	});

	it("otherItems defaults to empty string", async () => {
		expect((await makeCi().buildSnapshot(1)).otherItems).toBe("");
	});

	it("otherItems reflects the stored value", async () => {
		const ci = makeCi({ otherItems: "A magic ring" });
		expect((await ci.buildSnapshot(1)).otherItems).toBe("A magic ring");
	});

	it("prosperity is null without a steading repository", async () => {
		expect((await makeCi().buildSnapshot(1)).prosperity).toBeNull();
	});

	it("prosperity is null when the repository finds no steading", async () => {
		const ci = makeCi({}, null, null, null, new FakeSteadingRepository());
		expect((await ci.buildSnapshot(1)).prosperity).toBeNull();
	});

	it("prosperity carries the steading name and value", async () => {
		const ci = makeCi({}, null, null, null, makeSteadingRepo());
		const p = (await ci.buildSnapshot(1)).prosperity;
		expect(p.steadingName).toBe("Stonetop");
		expect(p.value).toBe(0);
		expect(p.lacking).toBe(false);
	});

	it("prosperity names whichever steading the repository found", async () => {
		const ci = makeCi({}, null, null, null, makeSteadingRepo({ name: "Marshedge", prosperity: 2 }));
		const p = (await ci.buildSnapshot(1)).prosperity;
		expect(p.steadingName).toBe("Marshedge");
		expect(p.value).toBe(2);
	});

	it("prosperity carries the lacking debility", async () => {
		const ci = makeCi({}, null, null, null, makeSteadingRepo({ prosperity: 1, lacking: true }));
		expect((await ci.buildSnapshot(1)).prosperity.lacking).toBe(true);
	});
});

// -- the Prosperity gear table ------------------------------------------------

describe("CharacterInventory — Prosperity gear table", () => {
	const rowsFor = async (steading) =>
		(await makeCi({}, null, null, null, makeSteadingRepo(steading)).buildSnapshot(1)).prosperity.rows;

	const markedIn = (rows) => rows.find(r => r.current)?.label ?? null;

	it("prints the four rungs of the insert's table in order", async () => {
		expect((await rowsFor({})).map(r => r.label)).toEqual(["-1", "+0", "+1", "+2"]);
	});

	// localize() is the identity in tests, so the notes come through as their keys…
	it("carries each rung's note, and leaves +0 blank", async () => {
		expect((await rowsFor({})).map(r => r.note)).toEqual([
			"stonetop.inventory.prosperityTable.crude",
			"",
			"stonetop.inventory.prosperityTable.piercing1",
			"stonetop.inventory.prosperityTable.piercing2",
		]);
	});

	// …so this is what catches a key that was never added to en.json (or later renamed away).
	it("every note key has a string in en.json", async () => {
		const i18n = fakeI18n();
		const keys = (await rowsFor({})).map(r => r.note).filter(Boolean);
		expect(keys.filter(k => !i18n.has(k))).toEqual([]);
	});

	it("marks exactly one rung", async () => {
		expect((await rowsFor({ prosperity: 1 })).filter(r => r.current)).toHaveLength(1);
	});

	it("marks the rung the steading is at", async () => {
		expect(markedIn(await rowsFor({ prosperity: 1 }))).toBe("+1");
		expect(markedIn(await rowsFor({ prosperity: -1 }))).toBe("-1");
	});

	// The steading hands over an already-adjusted rating, so lacking moves the mark down a rung
	// without the inventory knowing the debility exists.
	it("a lacking steading marks a rung lower", async () => {
		expect(markedIn(await rowsFor({ prosperity: 1, lacking: true }))).toBe("+0");
	});

	it("marks the top rung for a steading that has climbed past the table", async () => {
		expect(markedIn(await rowsFor({ prosperity: 4 }))).toBe("+2");
	});

	it("marks the bottom rung for a steading that has fallen below it", async () => {
		expect(markedIn(await rowsFor({ prosperity: -2 }))).toBe("-1");
	});
});

// -- CharacterInventory.addCustomItem -----------------------------------------

describe("CharacterInventory.addCustomItem", () => {
	it("calls outfitItems.create with a regular-column item with the given name and weight", async () => {
		const outfitItems = makeActorOutfitItems();
		const ci = makeCi({}, null, outfitItems);
		await ci.addCustomItem("Rope", 2);
		expect(outfitItems.create).toHaveBeenCalledWith([
			expect.objectContaining({
				name: "Rope",
				type: "outfitItem",
				system: expect.objectContaining({ weight: 2, inventoryColumn: "regular" }),
			}),
		]);
	});

	it("clamps weight to minimum 1", async () => {
		const outfitItems = makeActorOutfitItems();
		const ci = makeCi({}, null, outfitItems);
		await ci.addCustomItem("Pebble", 0);
		expect(outfitItems.create).toHaveBeenCalledWith([
			expect.objectContaining({ system: expect.objectContaining({ weight: 1 }) }),
		]);
	});
});

// -- CharacterInventory.addCustomSmallItem ------------------------------------

describe("CharacterInventory.addCustomSmallItem", () => {
	it("calls outfitItems.create with a small-column item with the given name", async () => {
		const outfitItems = makeActorOutfitItems();
		const ci = makeCi({}, null, outfitItems);
		await ci.addCustomSmallItem("Coin");
		expect(outfitItems.create).toHaveBeenCalledWith([
			expect.objectContaining({
				name: "Coin",
				type: "outfitItem",
				system: expect.objectContaining({ inventoryColumn: "small" }),
			}),
		]);
	});
});

// -- CharacterInventory.removeCustomItem --------------------------------------

describe("CharacterInventory.removeCustomItem", () => {
	it("calls outfitItems.deleteById with the item id", async () => {
		const outfitItems = makeActorOutfitItems();
		const ci = makeCi({}, null, outfitItems);
		await ci.removeCustomItem("item-42");
		expect(outfitItems.deleteById).toHaveBeenCalledWith("item-42");
	});
});
