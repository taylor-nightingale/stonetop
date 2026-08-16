import { afterEach, describe, expect, it, vi } from "vitest";
import { createStonetopActorClass } from "../../src/actors/StonetopActor.js";

// Foundry calls _on{Create,Delete}DescendantDocuments on EVERY connected client, which is what the
// trailing userId is for. The typed dispatch grants playbook moves, followers, inserts and
// possessions — all writes — so it must run on the acting client only; unguarded, every connected
// client grants the same playbook and its moves land once per client.

class FakeBase {
	superCreates = [];
	superDeletes = [];
	async _onCreateDescendantDocuments(...args) { this.superCreates.push(args); }
	async _onDeleteDescendantDocuments(...args) { this.superDeletes.push(args); }
}

function makeActor(typedType = "character") {
	const actor = new (createStonetopActorClass(FakeBase))();
	actor._typedActor = {
		type: typedType,
		created: [],
		deleted: [],
		async _onCreateDescendantDocuments(documents) { this.created.push(documents); },
		async _onDeleteDescendantDocuments(documents) { this.deleted.push(documents); },
	};
	return actor;
}

function stubGame(userId = "u1") {
	vi.stubGlobal("game", { user: { id: userId } });
}

const DOCS = [{ _id: "pb1", type: "playbook" }];

describe("StonetopActor._onCreateDescendantDocuments — acting client only", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("dispatches to the typed actor on the client that created the item", async () => {
		stubGame("u1");
		const actor = makeActor();
		await actor._onCreateDescendantDocuments(actor, "items", DOCS, [], {}, "u1");
		expect(actor.typedActor.created).toEqual([DOCS]);
	});

	it("does not dispatch when another client created the item", async () => {
		stubGame("u1");
		const actor = makeActor();
		await actor._onCreateDescendantDocuments(actor, "items", DOCS, [], {}, "someone-else");
		expect(actor.typedActor.created).toEqual([]);
	});

	it("still runs the core handler when another client created the item", async () => {
		stubGame("u1");
		const actor = makeActor();
		await actor._onCreateDescendantDocuments(actor, "items", DOCS, [], {}, "someone-else");
		expect(actor.superCreates).toHaveLength(1);
	});

	it("ignores collections other than items", async () => {
		stubGame("u1");
		const actor = makeActor();
		await actor._onCreateDescendantDocuments(actor, "effects", DOCS, [], {}, "u1");
		expect(actor.typedActor.created).toEqual([]);
	});

	// A migration has already decided what the actor should hold; re-entering the grant router from its
	// writes would undo that decision (a pruned duplicate revoking the copy being kept).
	it("does not dispatch for a migration's own writes", async () => {
		stubGame("u1");
		const actor = makeActor();
		await actor._onCreateDescendantDocuments(actor, "items", DOCS, [], { stonetopMigration: true }, "u1");
		expect(actor.typedActor.created).toEqual([]);
	});

	it("ignores actor types other than character", async () => {
		stubGame("u1");
		const actor = makeActor("steading");
		await actor._onCreateDescendantDocuments(actor, "items", DOCS, [], {}, "u1");
		expect(actor.typedActor.created).toEqual([]);
	});
});

describe("StonetopActor._onDeleteDescendantDocuments — acting client only", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("dispatches to the typed actor on the client that deleted the item", async () => {
		stubGame("u1");
		const actor = makeActor();
		await actor._onDeleteDescendantDocuments(actor, "items", DOCS, ["pb1"], {}, "u1");
		expect(actor.typedActor.deleted).toEqual([DOCS]);
	});

	it("does not dispatch when another client deleted the item", async () => {
		stubGame("u1");
		const actor = makeActor();
		await actor._onDeleteDescendantDocuments(actor, "items", DOCS, ["pb1"], {}, "someone-else");
		expect(actor.typedActor.deleted).toEqual([]);
	});

	it("still runs the core handler when another client deleted the item", async () => {
		stubGame("u1");
		const actor = makeActor();
		await actor._onDeleteDescendantDocuments(actor, "items", DOCS, ["pb1"], {}, "someone-else");
		expect(actor.superDeletes).toHaveLength(1);
	});

	it("does not dispatch for a migration's own deletes", async () => {
		stubGame("u1");
		const actor = makeActor();
		await actor._onDeleteDescendantDocuments(actor, "items", DOCS, ["pb1"], { stonetopMigration: true }, "u1");
		expect(actor.typedActor.deleted).toEqual([]);
	});
});
