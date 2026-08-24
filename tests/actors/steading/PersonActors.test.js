import { describe, it, expect } from "vitest";
import { PersonActors } from "../../../src/actors/steading/PersonActors.js";
import { PersonActorPlan } from "../../../src/actors/steading/PersonActorPlan.js";
import { LinkedNpc } from "../../../src/actors/steading/LinkedNpc.js";
import { NpcProvenance } from "../../../src/actors/steading/NpcProvenance.js";
import { Person } from "../../../src/actors/steading/Person.js";
import { FakeNpcRepository } from "../../fakes/FakeNpcRepository.js";

const steading = { uuid: "Actor.stonetop", ownership: { default: 2, gm: 3 } };
const person   = (over = {}) => Person.fromRaw({ id: "p1", name: "Willa", occupation: "Baker", traits: "Kind", ...over });

function make(repo = new FakeNpcRepository()) {
	return { repo, actors: new PersonActors(steading, repo) };
}

/** An actor we created for `person`, as it stands right after creation. */
function managedNpc(name = "Willa", folderId = "folder-Stonetop") {
	return new LinkedNpc("Actor.npc-0", name, folderId, new NpcProvenance(steading.uuid, "p1", name, folderId));
}

describe("PersonActors.sync — creating", () => {
	it("creates an actor for a named, unlinked person and links the row to it", async () => {
		const { repo, actors } = make();
		const updated = await actors.sync(person(), "Stonetop");
		expect(repo.created).toHaveLength(1);
		expect(updated.linkUuid).toBe("Actor.npc-0");
	});

	it("creates it in NPCs/<location>, with the description and stamp", async () => {
		const { repo, actors } = make();
		await actors.sync(person(), "Stonetop");
		const draft = repo.created[0];
		expect(draft.folderId).toBe("folder-Stonetop");
		expect(draft.description).toBe("Baker\n\nKind");
		expect(draft.provenance.personId).toBe("p1");
	});

	it("does nothing for a person with no name", async () => {
		const { repo, actors } = make();
		expect(await actors.sync(person({ name: "  " }), "Stonetop")).toBeNull();
		expect(repo.created).toHaveLength(0);
		expect(repo.folders.size).toBe(0);
	});

	it("links an actor the GM already made under that name instead of duplicating it", async () => {
		const repo = new FakeNpcRepository().withFolder("Stonetop", "f1")
			.withNpc(new LinkedNpc("Actor.existing", "Willa", "f1", null));
		const { actors } = make(repo);
		const updated = await actors.sync(person(), "Stonetop");
		expect(repo.created).toHaveLength(0);
		expect(updated.linkUuid).toBe("Actor.existing");
	});

	it("leaves an actor it linked by name unstamped, so it is never written to later", async () => {
		const repo = new FakeNpcRepository().withFolder("Stonetop", "f1")
			.withNpc(new LinkedNpc("Actor.existing", "Willa", "f1", null));
		const { actors } = make(repo);
		const linked = await actors.sync(person(), "Stonetop");
		await actors.sync(linked.withName("Willa Fletcher"), "Stonetop");
		expect(repo.renames).toHaveLength(0);
	});
});

describe("PersonActors.sync — an actor we created", () => {
	it("renames it when the row is renamed", async () => {
		const repo = new FakeNpcRepository().withFolder("Stonetop", "folder-Stonetop").withNpc(managedNpc());
		const { actors } = make(repo);
		await actors.sync(person({ name: "Willa Fletcher", linkUuid: "Actor.npc-0" }), "Stonetop");
		expect(repo.renames).toEqual([{ uuid: "Actor.npc-0", name: "Willa Fletcher" }]);
	});

	it("moves it when the person's location changes", async () => {
		const repo = new FakeNpcRepository().withFolder("Marshedge", "folder-Marshedge").withNpc(managedNpc());
		const { actors } = make(repo);
		await actors.sync(person({ linkUuid: "Actor.npc-0" }), "Marshedge");
		expect(repo.moves).toEqual([{ uuid: "Actor.npc-0", folderId: "folder-Marshedge" }]);
	});

	it("writes nothing when the row already matches", async () => {
		const repo = new FakeNpcRepository().withFolder("Stonetop", "folder-Stonetop").withNpc(managedNpc());
		const { actors } = make(repo);
		await actors.sync(person({ linkUuid: "Actor.npc-0" }), "Stonetop");
		expect(repo.renames).toHaveLength(0);
		expect(repo.moves).toHaveLength(0);
	});

	it("is idempotent — syncing twice creates one actor and no further writes", async () => {
		const { repo, actors } = make();
		const linked = await actors.sync(person(), "Stonetop");
		expect(await actors.sync(linked, "Stonetop")).toBeNull();
		expect(repo.created).toHaveLength(1);
		expect(repo.renames).toHaveLength(0);
		expect(repo.moves).toHaveLength(0);
	});
});

describe("PersonActors.sync — a rename and a move at once", () => {
	it("makes both writes and leaves the stamp describing both", async () => {
		const repo = new FakeNpcRepository().withFolder("Marshedge", "folder-Marshedge").withNpc(managedNpc());
		const { actors } = make(repo);
		await actors.sync(person({ name: "Willa Fletcher", linkUuid: "Actor.npc-0" }), "Marshedge");
		expect(repo.renames).toHaveLength(1);
		expect(repo.moves).toHaveLength(1);
		const stamp = repo.get("Actor.npc-0").provenance;
		expect(stamp.lastSyncedName).toBe("Willa Fletcher");
		expect(stamp.lastSyncedFolderId).toBe("folder-Marshedge");
	});

	it("leaves the row syncable afterwards rather than looking GM-edited", async () => {
		const repo = new FakeNpcRepository().withFolder("Marshedge", "folder-Marshedge").withNpc(managedNpc());
		const { actors } = make(repo);
		await actors.sync(person({ name: "Willa Fletcher", linkUuid: "Actor.npc-0" }), "Marshedge");
		await actors.sync(person({ name: "Willa Baker", linkUuid: "Actor.npc-0" }), "Marshedge");
		expect(repo.renames.map(r => r.name)).toEqual(["Willa Fletcher", "Willa Baker"]);
	});
});

describe("PersonActors.sync — work the GM has taken over", () => {
	it("never renames an actor the GM renamed by hand", async () => {
		const renamedByHand = new LinkedNpc("Actor.npc-0", "Willa the Baker", "folder-Stonetop",
			new NpcProvenance(steading.uuid, "p1", "Willa", "folder-Stonetop"));
		const repo = new FakeNpcRepository().withFolder("Stonetop", "folder-Stonetop").withNpc(renamedByHand);
		const { actors } = make(repo);
		await actors.sync(person({ name: "Willa Fletcher", linkUuid: "Actor.npc-0" }), "Stonetop");
		expect(repo.renames).toHaveLength(0);
	});

	it("never moves an actor the GM dragged into their own folder", async () => {
		const movedByHand = new LinkedNpc("Actor.npc-0", "Willa", "villagers",
			new NpcProvenance(steading.uuid, "p1", "Willa", "folder-Stonetop"));
		const repo = new FakeNpcRepository().withFolder("Marshedge", "folder-Marshedge").withNpc(movedByHand);
		const { actors } = make(repo);
		await actors.sync(person({ linkUuid: "Actor.npc-0" }), "Marshedge");
		expect(repo.moves).toHaveLength(0);
	});

	it("creates no folder for an actor the GM refiled themselves", async () => {
		const movedByHand = new LinkedNpc("Actor.npc-0", "Willa", "villagers",
			new NpcProvenance(steading.uuid, "p1", "Willa", "folder-Stonetop"));
		const repo = new FakeNpcRepository().withNpc(movedByHand);
		const { actors } = make(repo);
		await actors.sync(person({ linkUuid: "Actor.npc-0" }), "Marshedge");
		expect(repo.folders.size).toBe(0);
	});

	it("never touches a document dropped onto the row by hand", async () => {
		const dropped = new LinkedNpc("JournalEntry.willa", "Willa", "f1", null);
		const repo = new FakeNpcRepository().withNpc(dropped);
		const { actors } = make(repo);
		await actors.sync(person({ name: "Willa Fletcher", linkUuid: "JournalEntry.willa" }), "Stonetop");
		expect(repo.renames).toHaveLength(0);
		expect(repo.moves).toHaveLength(0);
		expect(repo.created).toHaveLength(0);
	});

	it("never touches an actor stamped for a different person", async () => {
		const someoneElses = new LinkedNpc("Actor.npc-0", "Willa", "folder-Stonetop",
			new NpcProvenance(steading.uuid, "p2", "Willa", "folder-Stonetop"));
		const repo = new FakeNpcRepository().withFolder("Stonetop", "folder-Stonetop").withNpc(someoneElses);
		const { actors } = make(repo);
		await actors.sync(person({ name: "Willa Fletcher", linkUuid: "Actor.npc-0" }), "Stonetop");
		expect(repo.renames).toHaveLength(0);
	});

	it("leaves a broken link alone rather than creating a replacement", async () => {
		const { repo, actors } = make();
		expect(await actors.sync(person({ linkUuid: "Actor.deleted" }), "Stonetop")).toBeNull();
		expect(repo.created).toHaveLength(0);
	});
});

describe("PersonActors.preview", () => {
	it("reports a create without writing anything", async () => {
		const { repo, actors } = make();
		const plan = await actors.preview(person(), "Stonetop");
		expect(plan.willCreate).toBe(true);
		expect(plan.location).toBe("Stonetop");
		expect(repo.created).toHaveLength(0);
		expect(repo.folders.size).toBe(0);
	});

	it("reports a link when a same-named actor already sits in the folder", async () => {
		const repo = new FakeNpcRepository().withFolder("Stonetop", "f1")
			.withNpc(new LinkedNpc("Actor.existing", "Willa", "f1", null));
		const { actors } = make(repo);
		expect((await actors.preview(person(), "Stonetop")).willLink).toBe(true);
	});

	it("reports rows that are already linked or unnamed as no work", async () => {
		const { actors } = make();
		expect((await actors.preview(person({ linkUuid: "Actor.x" }), "Stonetop")).action).toBe(PersonActorPlan.LINKED);
		expect((await actors.preview(person({ name: "" }), "Stonetop")).action).toBe(PersonActorPlan.UNNAMED);
	});
});
