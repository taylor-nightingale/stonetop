import { describe, it, expect } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { migrateArcanumPackData } from "../../src/migration/migrateCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeArcanaRepository } from "../fakes/FakeArcanaRepository.js";
import { FakeOutfitItems } from "../fakes/FakeOutfitItems.js";
import { ContainerOutfitSync } from "../../src/actors/character/ContainerOutfitSync.js";
import { CharacterArcana } from "../../src/actors/character/CharacterArcana.js";
import { ArcanumData } from "../../src/data/ArcanumData.js";

const FRONT = { item: null, description: "desc", unlock: null };
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
		const STALE = { item: null, description: "stale", unlock: null };
		const actor = makeActor([makeArcanumItem("maw", { front: STALE, back: { title: "Old back" } })]);
		await migrateArcanumPackData(actor, makeRepo([{ slug: "maw", front: FRONT, back: BACK }]));
		expect(actor.items.get("maw").system.front).toEqual(FRONT);
		expect(actor.items.get("maw").system.back).toEqual(BACK);
	});

	it("updates front and back when front is empty object", async () => {
		const actor = makeActor([makeArcanumItem("maw")]);
		const repo  = makeRepo([{ slug: "maw", name: "Hungering Maw", front: FRONT, back: BACK }]);
		await migrateArcanumPackData(actor, repo);
		expect(actor.items.get("maw").system.front).toEqual(FRONT);
		expect(actor.items.get("maw").system.back).toEqual(BACK);
	});

	it("preserves player state — the update touches only front/back, never flipped/choiceValues", async () => {
		const item = makeArcanumItem("maw", { front: FRONT, back: BACK });
		item.system.flipped = true;
		item.system.choiceValues = { maw: { "some-pick": { max: 3, value: 2 } } };
		const actor = makeActor([item]);
		await migrateArcanumPackData(actor, makeRepo([{ slug: "maw", front: FRONT, back: BACK }]));
		for (const update of actor.updatedDocs) expect(Object.keys(update.system)).toEqual(["front", "back"]);
		expect(actor.items.get("maw").system.flipped).toBe(true);
		expect(actor.items.get("maw").system.choiceValues).toEqual({ maw: { "some-pick": { max: 3, value: 2 } } });
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

	// The 1.0.3 cloak shipped with a one-group back (the spell text, with the card's "HP / Starts at 13"
	// tracker glued onto it) and no follower group. A character who already owns that card carries the
	// broken copy, so the pack fix only reaches them through this refresh — and only if a whole
	// ARRAY-valued `back.choices` is replaced, not merged with what's already stored.
	it("replaces a stale array-valued back.choices with the regenerated one (the cloak)", async () => {
		const stored = { title: "Flying Cloak", item: null, resource: null, choices: [
			{ slug: "intro", list: [{ type: "entry", content: { title: null,
				text: "…obeys you as a follower.\n\n**HP**\n\nStarts at 13" } }] },
		] };
		const packed = JSON.parse(await fs.readFile(
			path.resolve("packs/src/arcana/minor/cloak-richly-embroidered.json"), "utf8")).system;
		const item = makeArcanumItem("cloak-richly-embroidered", { front: {}, back: stored });
		item.system.flipped = true;
		item.system.choiceValues = { "cloak-richly-embroidered": { "learn-name": { max: 1, value: 1 } } };
		const actor = makeActor([item]);

		await migrateArcanumPackData(actor, makeRepo([{ slug: "cloak-richly-embroidered", front: packed.front, back: packed.back }]));

		const back = actor.items.get("cloak-richly-embroidered").system.back;
		expect(back.choices.map(g => g.slug)).toEqual(["intro", "cloak-richly-embroidered"]);
		expect(JSON.stringify(back)).not.toContain("Starts at");
		// the player's own state rides through untouched
		expect(actor.items.get("cloak-richly-embroidered").system.flipped).toBe(true);
		expect(actor.items.get("cloak-richly-embroidered").system.choiceValues)
			.toEqual({ "cloak-richly-embroidered": { "learn-name": { max: 1, value: 1 } } });
	});

	it("repairs every stale item, not just the first", async () => {
		const actor = makeActor([makeArcanumItem("maw"), makeArcanumItem("pelt")]);
		const repo = makeRepo([
			{ slug: "maw",  name: "Maw",  front: FRONT, back: BACK },
			{ slug: "pelt", name: "Pelt", front: FRONT, back: BACK },
		]);
		await migrateArcanumPackData(actor, repo);
		expect(actor.items.get("maw").system.front).toEqual(FRONT);
		expect(actor.items.get("pelt").system.front).toEqual(FRONT);
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

// A 0.14 character stores the arcanum shape of its day: a `front.description` string with the card's
// prose, a `front.unlock` group, and a `back.consequences` group. Foundry MERGES an object-field
// update into what is stored, so those keys survive the refresh — and ArcanumData.migrateData folds
// each of them into `choices` on every load. Left merged, the description renders twice and the
// consequences render as a second Consequences group, for as long as the character exists.
describe("migrateArcanumPackData — legacy front/back keys", () => {
	const DESCRIPTION = "A dozen copper plates, green with age.";

	// What ArcanumData.migrateData leaves in the stored source the first time a 0.14 arcanum is loaded:
	// the legacy keys are folded into `choices` in memory, but the DB record still carries them.
	function legacyStoredSystem() {
		return {
			slug: "codex", major: true, flipped: true, choiceValues: {},
			front: {
				title: "Codex", item: null, tags: null,
				description: DESCRIPTION,
				unlock: { slug: "codex", list: [{ type: "entry", slug: "marks", content: { text: "Marks" }, track: { max: 4 } }] },
			},
			back: {
				title: "Spells of the Codex", item: null, description: null, resource: null,
				itemSameAsFront: true, choices: null, moveSlugs: ["darksome-vessel"], unlockAt: 4,
				consequences: { slug: "consequences", list: [{ type: "entry", slug: "c1", content: { text: "Old scales" } }] },
			},
		};
	}

	// The current pack shape: both sides are an array of groups, and the description is authored as the
	// leading entry of the front's first group.
	const PACK_FRONT = { item: null, tags: null, choices: [{ slug: "codex", list: [
		{ type: "entry", content: { title: null, text: DESCRIPTION } },
		{ type: "entry", slug: "marks", content: { text: "Marks" }, track: { max: 4 } },
	] }] };
	const PACK_BACK = { title: "Mysteries of the Codex", item: null, resource: null, itemSameAsFront: true, choices: [
		{ slug: "codex", title: "Spells of the Codex", list: [{ type: "entry", slug: "call-up-the-dead", content: { text: "Call Up the Dead." } }] },
		{ slug: "consequences", title: "Consequences", list: [{ type: "entry", slug: "codex-c1", content: { text: "You lose all body hair." } }] },
	] };

	// What the next world load makes of whatever the migration left behind.
	async function migrateThenReload() {
		const item  = { _id: "codex", type: "arcanum", name: "Codex", system: legacyStoredSystem() };
		const actor = makeActor([item]);
		await migrateArcanumPackData(actor, makeRepo([{ slug: "codex", front: PACK_FRONT, back: PACK_BACK }]));
		return ArcanumData.migrateData(structuredClone(actor.items.get("codex").system));
	}

	it("does not re-inject the legacy description as a second copy of the front's opening entry", async () => {
		const system = await migrateThenReload();
		const texts = system.front.choices[0].list.map(row => row.content?.text);
		expect(texts.filter(t => t === DESCRIPTION)).toHaveLength(1);
	});

	it("does not re-append the legacy consequences as a second Consequences group", async () => {
		const system = await migrateThenReload();
		expect(system.back.choices.map(g => g.slug)).toEqual(["codex", "consequences"]);
	});

	it("leaves the back showing the pack's title and groups, not the 0.14 ones", async () => {
		const system = await migrateThenReload();
		expect(system.back.title).toBe("Mysteries of the Codex");
		expect(system.back.choices[0].list).toHaveLength(1);
	});

	it("drops the legacy keys entirely rather than carrying them alongside the refreshed content", async () => {
		const system = await migrateThenReload();
		expect(system.front.unlock).toBeUndefined();
		expect(system.front.description).toBeUndefined();
		expect(system.back.moveSlugs).toBeUndefined();
		expect(system.back.consequences).toBeUndefined();
	});

	it("keeps the player's flip state and marked circles across the refresh", async () => {
		const item  = { _id: "codex", type: "arcanum", name: "Codex", system: legacyStoredSystem() };
		item.system.choiceValues = { codex: { marks: 3 } };
		const actor = makeActor([item]);
		await migrateArcanumPackData(actor, makeRepo([{ slug: "codex", front: PACK_FRONT, back: PACK_BACK }]));
		expect(actor.items.get("codex").system.flipped).toBe(true);
		expect(actor.items.get("codex").system.choiceValues).toEqual({ codex: { marks: 3 } });
	});
});
