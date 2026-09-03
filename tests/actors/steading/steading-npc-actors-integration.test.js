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
	const changed = { system: { folk: actor.system.folk } };
	const options = {};
	onPreUpdateSteadingPeople({ ...actor, system: before }, changed, options);
	await onUpdateSteadingPeople(actor, changed, options);
	return options;
}

afterEach(() => vi.unstubAllGlobals());

describe("naming someone on the roster", () => {
	it("creates an NPC actor under NPCs/<steading> and links the row to it", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addPerson();
		const id = actor.system.folk[0].id;

		await edit(actor, () => steading.updatePersonName(id, "Willa"));

		expect(npcs.created).toHaveLength(1);
		expect(npcs.created[0].name).toBe("Willa");
		expect(npcs.created[0].folderId).toBe("folder-Stonetop");
		expect(actor.system.folk[0].linkUuid).toBe("Actor.npc-0");
	});

	it("makes the villager visible to every player, whatever the steading's own ownership", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addPerson();
		await edit(actor, () => steading.updatePersonName(actor.system.folk[0].id, "Willa"));
		expect(npcs.created[0].toCreateData().ownership).toEqual({ default: 2 });
	});

	it("creates nothing while the row has no name", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await edit(actor, () => steading.addPerson());
		expect(npcs.created).toHaveLength(0);
	});

	it("writes nothing further when an unrelated field is edited afterwards", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addPerson();
		const id = actor.system.folk[0].id;
		await edit(actor, () => steading.updatePersonName(id, "Willa"));
		await edit(actor, () => steading.updatePersonTraits(id, "Kind"));
		expect(npcs.created).toHaveLength(1);
		expect(npcs.renames).toHaveLength(0);
	});
});

describe("renaming someone on the roster", () => {
	it("renames the actor it created", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addPerson();
		const id = actor.system.folk[0].id;
		await edit(actor, () => steading.updatePersonName(id, "Willa"));

		await edit(actor, () => steading.updatePersonName(id, "Willa Fletcher"));

		expect(npcs.renames).toEqual([{ uuid: "Actor.npc-0", name: "Willa Fletcher" }]);
	});

	it("leaves an actor the GM renamed by hand alone", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addPerson();
		const id = actor.system.folk[0].id;
		await edit(actor, () => steading.updatePersonName(id, "Willa"));

		const ours = npcs.get("Actor.npc-0");
		npcs.withNpc(new LinkedNpc(ours.uuid, "Willa the Baker", ours.folderId, ours.provenance));

		await edit(actor, () => steading.updatePersonName(id, "Willa Fletcher"));
		expect(npcs.renames).toHaveLength(0);
	});

	it("leaves a document dropped onto the row alone", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addPerson();
		const id = actor.system.folk[0].id;
		npcs.withNpc(new LinkedNpc("JournalEntry.willa", "Willa", null, null));
		await steading.linkPerson(id, "JournalEntry.willa");

		await edit(actor, () => steading.updatePersonName(id, "Willa Fletcher"));

		expect(npcs.renames).toHaveLength(0);
		expect(npcs.created).toHaveLength(0);
	});
});

describe("someone who lives elsewhere", () => {
	it("files them under their home and moves them when it changes", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addPerson();
		const id = actor.system.folk[0].id;
		await edit(actor, async () => {
			await steading.updatePersonName(id, "Brennan");
			await steading.updatePersonHome(id, "Marshedge");
		});
		expect(npcs.created[0].folderId).toBe("folder-Marshedge");

		await edit(actor, () => steading.updatePersonHome(id, "Gordin's Delve"));
		expect(npcs.moves).toEqual([{ uuid: "Actor.npc-0", folderId: "folder-Gordin's Delve" }]);
	});

	// One roster, one rule: a blank Home is not "unknown", it is this steading.
	it("files one with no home written down under the steading's own name", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addPerson();
		await edit(actor, () => steading.updatePersonName(actor.system.folk[0].id, "Brennan"));
		expect(npcs.created[0].folderId).toBe("folder-Stonetop");
	});
});

describe("the rest of the roster", () => {
	it("is untouched when one row is edited — no sweep", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addPerson();
		await steading.addPerson();
		const [first, second] = actor.system.folk.map(p => p.id);
		await edit(actor, () => steading.updatePersonName(first, "Willa"));
		await edit(actor, () => steading.updatePersonName(second, "Marek"));
		// Naming the second created only its own actor; the first was already linked and left alone.
		expect(npcs.created.map(d => d.name)).toEqual(["Willa", "Marek"]);
		expect(npcs.renames).toHaveLength(0);
	});

	it("stays data-only while the setting is off", async () => {
		stubGame({ autoCreate: false });
		const { actor, npcs, steading } = build();
		await steading.addPerson();
		await edit(actor, () => steading.updatePersonName(actor.system.folk[0].id, "Willa"));
		expect(npcs.created).toHaveLength(0);
		expect(actor.system.folk[0].linkUuid).toBeUndefined();
	});
});

describe("the GM's bulk pass", () => {
	it("creates actors for a roster typed up before any of this existed", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addPerson();
		await steading.addPerson();
		const [first, second] = actor.system.folk.map(p => p.id);
		await steading.updatePersonName(first, "Willa");
		await steading.updatePersonName(second, "Marek");
		expect(npcs.created).toHaveLength(0);   // nothing happened without the hooks

		await steading.createMissingFolkActors();

		expect(npcs.created.map(d => d.name)).toEqual(["Willa", "Marek"]);
		expect(actor.system.folk.map(p => p.linkUuid)).toEqual(["Actor.npc-0", "Actor.npc-1"]);
	});

	it("previews without writing anything", async () => {
		stubGame();
		const { actor, npcs, steading } = build();
		await steading.addPerson();
		await steading.updatePersonName(actor.system.folk[0].id, "Willa");

		const plans = await steading.previewFolkActors();

		expect(plans.map(p => p.action)).toEqual(["create"]);
		expect(npcs.created).toHaveLength(0);
		expect(npcs.folders.size).toBe(0);
	});
});

describe("linksDocument", () => {
	it("recognises a document linked from the roster or the places list", async () => {
		const { actor, steading } = build();
		await steading.addPerson();
		await steading.linkPerson(actor.system.folk[0].id, "Actor.willa");
		await steading.addPlace();
		await steading.linkPlace(0, "JournalEntry.mill");

		expect(steading.linksDocument("Actor.willa")).toBe(true);
		expect(steading.linksDocument("JournalEntry.mill")).toBe(true);
		expect(steading.linksDocument("Actor.stranger")).toBe(false);
	});
});
