import { describe, expect, it } from "vitest";
import { migrateArcanaMoves } from "../../src/migration/migrateCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeArcanaRepository } from "../fakes/FakeArcanaRepository.js";
import { FakeMoveRepository } from "../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../fakes/FakeCompendiumMoveBuilder.js";

// migrateArcanaMoves(actor, arcanaRepo, moveRepo): an arcanum grants its moves via move-grant choice
// entries. The migration registers the arcana-<slug> category of real move items, seeded ACQUIRED (the
// "unlocked" checkbox is now the granting entry's ornamental choice track). (migrateArcanumPackData
// refreshes the back from the pack first, so the grants are the current array shape by the time this runs.)

const FRONT = { unlock: null, item: null, description: "desc" };

function makeActor(items = []) {
	return new FakeCharacterActorBuilder().withItems(items).build();
}

function mkMove(name) { return new FakeCompendiumMoveBuilder().withName(name).build(); }

function moveRepoWith(...names) {
	const repo = new FakeMoveRepository();
	for (const n of names) repo.addInsertMove(mkMove(n));
	return repo;
}

// An arcanum that grants Battery + Resonance via a back "Moves" choice group.
function majorArcanum() {
	return {
		_id: "arc1", type: "arcanum", name: "Azure Hand",
		system: {
			slug: "azure-hand", major: true,
			front: FRONT,
			back: { title: "Mysteries", choices: [{ slug: "moves", title: "Moves", list: [
				{ type: "entry", slug: "battery",   track: { max: 1 }, grants: [{ type: "move", slug: "battery",   locations: ["inline"] }] },
				{ type: "entry", slug: "resonance", track: { max: 1 }, grants: [{ type: "move", slug: "resonance", locations: ["inline"] }] },
			] }] },
		},
	};
}

function arcanaCategoryItems(actor) {
	return [...actor.items].filter(i => i.type === "move" && i.system?.categoryKey === "arcana-azure-hand");
}

describe("migrateArcanaMoves", () => {
	it("registers the arcana-<slug> move category of real move items, seeded acquired", async () => {
		const actor = makeActor([majorArcanum()]);
		await migrateArcanaMoves(actor, new FakeArcanaRepository(), moveRepoWith("Battery", "Resonance"));
		const moves = arcanaCategoryItems(actor);
		expect(moves.map(i => i.name).sort()).toEqual(["Battery", "Resonance"]);
		for (const m of moves) expect(m.system.acquired).toBe(true);
	});

	it("is re-run safe: a second pass adds no duplicate move items", async () => {
		const actor = makeActor([majorArcanum()]);
		await migrateArcanaMoves(actor, new FakeArcanaRepository(), moveRepoWith("Battery", "Resonance"));
		await migrateArcanaMoves(actor, new FakeArcanaRepository(), moveRepoWith("Battery", "Resonance"));
		expect(arcanaCategoryItems(actor)).toHaveLength(2);
	});

	it("leaves an arcanum that grants no moves alone (minor/custom)", async () => {
		const minor = {
			_id: "arc2", type: "arcanum", name: "A Folktale",
			system: { slug: "a-folktale", major: false, front: FRONT, back: { title: "Back", choices: [] } },
		};
		const actor = makeActor([minor]);
		await migrateArcanaMoves(actor, new FakeArcanaRepository(), moveRepoWith());
		expect([...actor.items].filter(i => i.type === "move")).toHaveLength(0);
	});

	it("does nothing when the actor has no arcanum items", async () => {
		const actor = makeActor([]);
		await migrateArcanaMoves(actor, new FakeArcanaRepository(), moveRepoWith("Battery", "Resonance"));
		expect([...actor.items]).toHaveLength(0);
	});
});
