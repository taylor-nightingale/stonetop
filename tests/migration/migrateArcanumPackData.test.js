import { describe, it, expect } from "vitest";
import { migrateArcanumPackData } from "../../src/migration/migrateCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeArcanaRepository } from "../fakes/FakeArcanaRepository.js";

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
