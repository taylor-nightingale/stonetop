import { afterEach, describe, expect, it, vi } from "vitest";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { onPreUpdateSteadingPeople, onUpdateSteadingPeople } from "../../../src/hooks/SteadingPeopleChanged.js";
import { LinkedNpc } from "../../../src/actors/steading/LinkedNpc.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeNpcRepository } from "../../fakes/FakeNpcRepository.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";

/**
 * The whole path with only Foundry faked: a roster edit on someone's sheet, through the pre-update
 * delta and the GM-side update hook, into created actors and links written back onto the rows.
 */
const gm = { id: "gm" };

function build() {
	const npcs   = new FakeNpcRepository();
	const actor  = new FakeSteadingBuilder().withTypedActor(a => new StonetopSteading(a, steadingRepos({ npcs }))).build();
	return { actor, npcs, steading: actor.typedActor };
}

function stubGame({ autoCreate = true } = {}) {
	vi.stubGlobal("game", { user: gm, users: { activeGM: gm }, settings: { get: () => autoCreate } });
}

/** Edit the roster the way the sheet does, then run the hooks the update would fire. */
async function edit(actor, mutate) {
	const before  = JSON.parse(JSON.stringify(actor.system));
	await mutate();
	const changed = { system: { residentPeople: actor.system.residentPeople, neighborPeople: actor.system.neighborPeople } };
	const options = {};
	onPreUpdateSteadingPeople({ ...actor, system: before }, changed, options);
	await onUpdateSteadingPeople(actor, changed, options);
	return options;
}

afterEach(() => vi.unstubAllGlobals());

describe("naming a resident", () => {
	it("creates an NPC actor under NPCs/<steading> and links the row to it", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addResident();
		const id = actor.system.residentPeople[0].id;

		await edit(actor, () => steading.updateResidentName(id, "Willa"));

		expect(npcs.created).toHaveLength(1);
		expect(npcs.created[0].name).toBe("Willa");
		expect(npcs.created[0].folderId).toBe("folder-Stonetop");
		expect(actor.system.residentPeople[0].linkUuid).toBe("Actor.npc-0");
	});

	it("makes the villager visible to every player, whatever the steading's own ownership", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addResident();
		await edit(actor, () => steading.updateResidentName(actor.system.residentPeople[0].id, "Willa"));
		expect(npcs.created[0].toCreateData().ownership).toEqual({ default: 2 });
	});

	it("creates nothing while the row has no name", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await edit(actor, () => steading.addResident());
		expect(npcs.created).toHaveLength(0);
	});

	it("writes nothing further when an unrelated field is edited afterwards", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addResident();
		const id = actor.system.residentPeople[0].id;
		await edit(actor, () => steading.updateResidentName(id, "Willa"));
		await edit(actor, () => steading.updateResidentTraits(id, "Kind"));
		expect(npcs.created).toHaveLength(1);
		expect(npcs.renames).toHaveLength(0);
	});
});

describe("renaming a resident", () => {
	it("renames the actor it created", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addResident();
		const id = actor.system.residentPeople[0].id;
		await edit(actor, () => steading.updateResidentName(id, "Willa"));

		await edit(actor, () => steading.updateResidentName(id, "Willa Fletcher"));

		expect(npcs.renames).toEqual([{ uuid: "Actor.npc-0", name: "Willa Fletcher" }]);
	});

	it("leaves an actor the GM renamed by hand alone", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addResident();
		const id = actor.system.residentPeople[0].id;
		await edit(actor, () => steading.updateResidentName(id, "Willa"));

		const ours = npcs.get("Actor.npc-0");
		npcs.withNpc(new LinkedNpc(ours.uuid, "Willa the Baker", ours.folderId, ours.provenance));

		await edit(actor, () => steading.updateResidentName(id, "Willa Fletcher"));
		expect(npcs.renames).toHaveLength(0);
	});

	it("leaves a document dropped onto the row alone", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addResident();
		const id = actor.system.residentPeople[0].id;
		npcs.withNpc(new LinkedNpc("JournalEntry.willa", "Willa", null, null));
		await steading.linkResident(id, "JournalEntry.willa");

		await edit(actor, () => steading.updateResidentName(id, "Willa Fletcher"));

		expect(npcs.renames).toHaveLength(0);
		expect(npcs.created).toHaveLength(0);
	});
});

describe("neighbours", () => {
	it("files them under their home and moves them when it changes", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addNeighbor();
		const id = actor.system.neighborPeople[0].id;
		await edit(actor, async () => {
			await steading.updateNeighborName(id, "Brennan");
			await steading.updateNeighborHome(id, "Marshedge");
		});
		expect(npcs.created[0].folderId).toBe("folder-Marshedge");

		await edit(actor, () => steading.updateNeighborHome(id, "Gordin's Delve"));
		expect(npcs.moves).toEqual([{ uuid: "Actor.npc-0", folderId: "folder-Gordin's Delve" }]);
	});

	it("files one with no home written down under NPCs/Neighbors", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addNeighbor();
		await edit(actor, () => steading.updateNeighborName(actor.system.neighborPeople[0].id, "Brennan"));
		expect(npcs.created[0].folderId).toBe("folder-Neighbors");
	});
});

describe("the rest of the roster", () => {
	it("is untouched when one row is edited — no sweep", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addResident();
		await steading.addResident();
		const [first, second] = actor.system.residentPeople.map(p => p.id);
		await edit(actor, () => steading.updateResidentName(first, "Willa"));
		await edit(actor, () => steading.updateResidentName(second, "Marek"));
		// Naming the second created only its own actor; the first was already linked and left alone.
		expect(npcs.created.map(d => d.name)).toEqual(["Willa", "Marek"]);
		expect(npcs.renames).toHaveLength(0);
	});

	it("stays data-only while the setting is off", async () => {
		stubGame({ autoCreate: false });
		const { actor, npcs, steading } = build();
		await steading.addResident();
		await edit(actor, () => steading.updateResidentName(actor.system.residentPeople[0].id, "Willa"));
		expect(npcs.created).toHaveLength(0);
		expect(actor.system.residentPeople[0].linkUuid).toBeUndefined();
	});
});

describe("the GM's bulk pass", () => {
	it("creates actors for a roster typed up before any of this existed", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addResident();
		await steading.addResident();
		const [first, second] = actor.system.residentPeople.map(p => p.id);
		await steading.updateResidentName(first, "Willa");
		await steading.updateResidentName(second, "Marek");
		expect(npcs.created).toHaveLength(0);   // nothing happened without the hooks

		await steading.createMissingResidentActors();

		expect(npcs.created.map(d => d.name)).toEqual(["Willa", "Marek"]);
		expect(actor.system.residentPeople.map(p => p.linkUuid)).toEqual(["Actor.npc-0", "Actor.npc-1"]);
	});

	it("previews without writing anything", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addResident();
		await steading.updateResidentName(actor.system.residentPeople[0].id, "Willa");

		const plans = await steading.previewResidentActors();

		expect(plans.map(p => p.action)).toEqual(["create"]);
		expect(npcs.created).toHaveLength(0);
		expect(npcs.folders.size).toBe(0);
	});
});

describe("linksDocument", () => {
	it("recognises a document linked from any of the three lists", async () => {
		const { actor, steading } = build();
		await steading.addResident();
		await steading.linkResident(actor.system.residentPeople[0].id, "Actor.willa");
		await steading.addPlace();
		await steading.linkPlace(0, "JournalEntry.mill");

		expect(steading.linksDocument("Actor.willa")).toBe(true);
		expect(steading.linksDocument("JournalEntry.mill")).toBe(true);
		expect(steading.linksDocument("Actor.stranger")).toBe(false);
	});
});
