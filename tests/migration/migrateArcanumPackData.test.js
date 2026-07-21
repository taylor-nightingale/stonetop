import { describe, it, expect } from "vitest";
import { migrateArcanumPackData } from "../../src/migration/migrateCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeArcanaRepository } from "../fakes/FakeArcanaRepository.js";
import { FakeOutfitItems } from "../fakes/FakeOutfitItems.js";
import { ContainerOutfitSync } from "../../src/actors/character/ContainerOutfitSync.js";
import { CharacterArcana } from "../../src/actors/character/CharacterArcana.js";
import { FakeOutfitItems } from "../fakes/FakeOutfitItems.js";
import { ContainerOutfitSync } from "../../src/actors/character/ContainerOutfitSync.js";
import { CharacterArcana } from "../../src/actors/character/CharacterArcana.js";

const FRONT = { title: "Front", item: null, description: "desc", unlock: null };
const BACK  = { title: "Back",  item: null, description: "", choices: null };

function makeArcanumItem(slug, overrides = {}) {
	return {
		_id:    slug,
		type:   "arcanum",
		name:   slug,
		system: {
			slug,
			major:            false,
			front:            overrides.front ?? {},
			back:             overrides.back  ?? {},
			flipped:          false,
			choiceValues:     {},
		},
	};
}

function makeActor(items = []) {
	return new FakeCharacterActorBuilder().withItems(items).build();
}

function makeRepo(arcana = []) {
	return new FakeArcanaRepository(arcana);
}

describe("migrateArcanumPackData", () => {
	it("does nothing when actor has no arcanum items", async () => {
		const actor = makeActor();
		await migrateArcanumPackData(actor, makeRepo());
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("refreshes a populated arcanum's front/back from the pack (so pack fixes reach characters)", async () => {
		const STALE = { title: "Old", item: null, description: "stale", unlock: null };
		const actor = makeActor([makeArcanumItem("maw", { front: STALE, back: { title: "Old back" } })]);
		await migrateArcanumPackData(actor, makeRepo([{ slug: "maw", front: FRONT, back: BACK }]));
		const updated = actor.updatedDocs.find(d => d._id === "maw");
		expect(updated?.system?.front).toEqual(FRONT);
		expect(updated?.system?.back).toEqual(BACK);
	});

	it("updates front and back when front is empty object", async () => {
		const actor = makeActor([makeArcanumItem("maw")]);
		const repo  = makeRepo([{ slug: "maw", name: "Hungering Maw", front: FRONT, back: BACK }]);
		await migrateArcanumPackData(actor, repo);
		const updated = actor.updatedDocs.find(d => d._id === "maw");
		expect(updated?.system?.front).toEqual(FRONT);
		expect(updated?.system?.back).toEqual(BACK);
	});

	it("preserves player state — the update touches only front/back, never flipped/choiceValues", async () => {
		const item = makeArcanumItem("maw", { front: FRONT, back: BACK });
		item.system.flipped = true;
		item.system.choiceValues = { maw: { "some-pick": { max: 3, value: 2 } } };
		const actor = makeActor([item]);
		await migrateArcanumPackData(actor, makeRepo([{ slug: "maw", front: FRONT, back: BACK }]));
		const updated = actor.updatedDocs.find(d => d._id === "maw");
		expect(Object.keys(updated.system)).toEqual(["front", "back"]);
		expect(updated.system).not.toHaveProperty("flipped");
		expect(updated.system).not.toHaveProperty("choiceValues");
	});

	it("skips items with no slug", async () => {
		const item = { ...makeArcanumItem(""), system: { ...makeArcanumItem("").system, slug: null } };
		const actor = makeActor([item]);
		await migrateArcanumPackData(actor, makeRepo());
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("skips items whose slug is not in the repo", async () => {
		const actor = makeActor([makeArcanumItem("unknown-arcanum")]);
		await migrateArcanumPackData(actor, makeRepo());
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("repairs multiple stale items in a single batch update", async () => {
		const actor = makeActor([makeArcanumItem("maw"), makeArcanumItem("pelt")]);
		const repo = makeRepo([
			{ slug: "maw",  name: "Maw",  front: FRONT, back: BACK },
			{ slug: "pelt", name: "Pelt", front: FRONT, back: BACK },
		]);
		await migrateArcanumPackData(actor, repo);
		expect(actor.updatedDocs).toHaveLength(2);
	});
});

// Refreshing the arcanum's own data is not enough: the gear it granted is a SEPARATE embedded
// document, written when the card was flipped. A pouch that gained a "uses" resource in a later pack
// regen keeps `resource: null` on the character until the grant is recomputed — which looks exactly
// like the resource track silently refusing to render.
describe("migrateArcanumPackData — regranting the card item", () => {
	const POUCH = {
		name: "pouch of powdered cinnabar", weight: 1, tags: null, note: "Value 2",
		inventoryColumn: "regular", resource: { max: 12, title: "uses", labels: [] },
	};

	function flippedArcanum(backItem) {
		const item = makeArcanumItem("time-worn-missive");
		item.system.flipped = true;
		item.system.back    = { ...BACK, item: backItem };
		return item;
	}

	function syncFor(outfit) {
		return new ContainerOutfitSync(outfit).register("arcanum", CharacterArcana.outfitGrantFor);
	}

	it("re-grants the card item with the resource the pack now defines", async () => {
		// On the character: the same pouch, but granted before it had a resource.
		const actor  = makeActor([flippedArcanum({ ...POUCH, resource: null })]);
		const outfit = new FakeOutfitItems();
		const repo   = makeRepo([{ slug: "time-worn-missive", name: "Missive", front: FRONT, back: { ...BACK, item: POUCH } }]);

		await migrateArcanumPackData(actor, repo, syncFor(outfit));

		const [granted] = outfit.getItems("arcana:time-worn-missive");
		expect(granted?.system.resource).toEqual({ max: 12, title: "uses", labels: [] });
	});

	it("grants nothing for a card that is still face-up", async () => {
		const item = flippedArcanum(POUCH);
		item.system.flipped = false;
		const actor  = makeActor([item]);
		const outfit = new FakeOutfitItems();
		const repo   = makeRepo([{ slug: "time-worn-missive", name: "Missive", front: FRONT, back: { ...BACK, item: POUCH } }]);

		await migrateArcanumPackData(actor, repo, syncFor(outfit));

		expect(outfit.getSlugs("arcana:time-worn-missive")).toHaveLength(0);
	});

	it("is idempotent — a second run leaves one copy", async () => {
		const actor  = makeActor([flippedArcanum({ ...POUCH, resource: null })]);
		const outfit = new FakeOutfitItems();
		const repo   = makeRepo([{ slug: "time-worn-missive", name: "Missive", front: FRONT, back: { ...BACK, item: POUCH } }]);

		await migrateArcanumPackData(actor, repo, syncFor(outfit));
		await migrateArcanumPackData(actor, repo, syncFor(outfit));

		expect(outfit.getItems("arcana:time-worn-missive")).toHaveLength(1);
	});

    it("still works when no sync is supplied", async () => {
        const actor = makeActor([flippedArcanum(POUCH)]);
        const repo  = makeRepo([{ slug: "time-worn-missive", name: "Missive", front: FRONT, back: { ...BACK, item: POUCH } }]);

        await expect(migrateArcanumPackData(actor, repo)).resolves.not.toThrow();
    });
});

// Refreshing the arcanum's own data is not enough: the gear it granted is a SEPARATE embedded
// document, written when the card was flipped. A pouch that gained a "uses" resource in a later pack
// regen keeps `resource: null` on the character until the grant is recomputed — which looks exactly
// like the resource track silently refusing to render.
describe("migrateArcanumPackData — regranting the card item", () => {
	const POUCH = {
		name: "pouch of powdered cinnabar", weight: 1, tags: null, note: "Value 2",
		inventoryColumn: "regular", resource: { max: 12, title: "uses", labels: [] },
	};

	function flippedArcanum(backItem) {
		const item = makeArcanumItem("time-worn-missive");
		item.system.flipped = true;
		item.system.back    = { ...BACK, item: backItem };
		return item;
	}

	const syncFor = outfit =>
		new ContainerOutfitSync(outfit).register("arcanum", CharacterArcana.outfitGrantFor);
	const repoWith = item =>
		makeRepo([{ slug: "time-worn-missive", name: "Missive", front: FRONT, back: { ...BACK, item } }]);

	it("re-grants the card item with the resource the pack now defines", async () => {
		// On the character: the same pouch, but granted before it had a resource.
		const actor  = makeActor([flippedArcanum({ ...POUCH, resource: null })]);
		const outfit = new FakeOutfitItems();

		await migrateArcanumPackData(actor, repoWith(POUCH), syncFor(outfit));

		const [granted] = outfit.getItems("arcana:time-worn-missive");
		expect(granted?.system.resource).toEqual({ max: 12, title: "uses", labels: [] });
	});

	it("grants nothing for a card that is still face-up", async () => {
		const item = flippedArcanum(POUCH);
		item.system.flipped = false;
		const outfit = new FakeOutfitItems();

		await migrateArcanumPackData(makeActor([item]), repoWith(POUCH), syncFor(outfit));

		expect(outfit.getSlugs("arcana:time-worn-missive")).toHaveLength(0);
	});

	it("is idempotent — a second run leaves one copy", async () => {
		const actor  = makeActor([flippedArcanum({ ...POUCH, resource: null })]);
		const outfit = new FakeOutfitItems();

		await migrateArcanumPackData(actor, repoWith(POUCH), syncFor(outfit));
		await migrateArcanumPackData(actor, repoWith(POUCH), syncFor(outfit));

		expect(outfit.getItems("arcana:time-worn-missive")).toHaveLength(1);
	});

	it("still works when no sync is supplied", async () => {
		const actor = makeActor([flippedArcanum(POUCH)]);

		await expect(migrateArcanumPackData(actor, repoWith(POUCH))).resolves.not.toThrow();
	});
});
