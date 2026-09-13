import { describe, it, expect } from "vitest";
import { migrateCompanionTypeSlugs } from "../../src/migration/migrateCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";

// A companion's chosen type used to be stored as the type's NAME. A name is prose — retyping the
// catalog or translating the pack leaves the pick pointing at nothing, and the card silently loses
// the type's pickCount and its pre-checked defaults. This re-keys each pick to the type's slug.

const BIRD  = { slug: "bird",  name: "Bird",  pickCount: 4, options: ["tiny", "fast"], defaults: ["tiny"] };
const BRUTE = { slug: "brute", name: "Brute", pickCount: 3, options: ["tough"],        defaults: ["tough"] };

function selection(selected, multi = false) {
	return { selected, options: [], multi, allowCustom: true };
}

function makeFollowerItem(id, companion) {
	return { _id: id, type: "follower", name: id, system: { slug: id, companion } };
}

function makeCompanion(typeSelection, catalog = [BIRD, BRUTE]) {
	return {
		enabled: true,
		type:    typeSelection,
		options: selection(["tiny"], true),
		catalog,
	};
}

const makeActor = (items = []) => new FakeCharacterActorBuilder().withItems(items).build();
const companionOf = (actor, id) => actor.updatedDocs.find(d => d._id === id)?.system?.companion;

describe("migrateCompanionTypeSlugs", () => {
	it("re-keys a pick stored as a name to the type's slug", async () => {
		const actor = makeActor([makeFollowerItem("shadow", makeCompanion(selection(["Bird"])))]);

		await migrateCompanionTypeSlugs(actor);

		expect(companionOf(actor, "shadow")?.type?.selected).toEqual(["bird"]);
	});

	it("matches against that follower's own catalog", async () => {
		const actor = makeActor([makeFollowerItem("shadow", makeCompanion(selection(["Brute"])))]);

		await migrateCompanionTypeSlugs(actor);

		expect(companionOf(actor, "shadow")?.type?.selected).toEqual(["brute"]);
	});

	it("keeps the rest of the atomic companion object — it is written back whole", async () => {
		const actor = makeActor([makeFollowerItem("shadow", makeCompanion(selection(["Bird"])))]);

		await migrateCompanionTypeSlugs(actor);

		const companion = companionOf(actor, "shadow");
		expect(companion.enabled).toBe(true);
		expect(companion.catalog).toHaveLength(2);
		expect(companion.options.selected).toEqual(["tiny"]);
	});

	it("drops the stored copy of the catalog names — the snapshot names the catalog every render", async () => {
		const withOptions = makeCompanion({ ...selection(["Bird"]), options: ["Bird", "Brute"] });
		const actor = makeActor([makeFollowerItem("shadow", withOptions)]);

		await migrateCompanionTypeSlugs(actor);

		expect(companionOf(actor, "shadow")?.type?.options).toEqual([]);
	});

	it("is idempotent — a pick already stored as a slug is left alone", async () => {
		const actor = makeActor([makeFollowerItem("shadow", makeCompanion(selection(["bird"])))]);

		await migrateCompanionTypeSlugs(actor);

		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("leaves a pick that names no type in the catalog, rather than clearing it", async () => {
		const actor = makeActor([makeFollowerItem("shadow", makeCompanion(selection(["Wyvern"])))]);

		await migrateCompanionTypeSlugs(actor);

		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("ignores a follower with no companion, no catalog, or nothing picked yet", async () => {
		const actor = makeActor([
			makeFollowerItem("plain",   undefined),
			makeFollowerItem("empty",   makeCompanion(selection([]))),
			makeFollowerItem("nolist",  makeCompanion(selection(["Bird"]), [])),
		]);

		await migrateCompanionTypeSlugs(actor);

		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("ignores items that are not followers", async () => {
		const notAFollower = { _id: "arc", type: "arcanum", name: "arc", system: { companion: makeCompanion(selection(["Bird"])) } };
		const actor = makeActor([notAFollower]);

		await migrateCompanionTypeSlugs(actor);

		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("migrates every follower that needs it in one write", async () => {
		const actor = makeActor([
			makeFollowerItem("shadow", makeCompanion(selection(["Bird"]))),
			makeFollowerItem("rook",   makeCompanion(selection(["Brute"]))),
		]);

		await migrateCompanionTypeSlugs(actor);

		expect(companionOf(actor, "shadow")?.type?.selected).toEqual(["bird"]);
		expect(companionOf(actor, "rook")?.type?.selected).toEqual(["brute"]);
	});
});
