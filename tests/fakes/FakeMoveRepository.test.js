import { describe, it, expect } from "vitest";
import { FakeMoveRepository } from "./FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "./FakeCompendiumMoveBuilder.js";

describe("FakeMoveRepository — world moves via addWorld", () => {
	it("buildSlugIndex includes world moves", async () => {
		const repo = new FakeMoveRepository();
		repo.addWorld(new FakeCompendiumMoveBuilder().withName("Iron Wall").build());
		const index = await repo.buildSlugIndex();
		expect(index.has("iron-wall")).toBe(true);
		expect(index.get("iron-wall").name).toBe("Iron Wall");
	});

	it("getPlaybookMoves returns world move matching playbook and moveType", async () => {
		const repo = new FakeMoveRepository();
		repo.addWorld(
			new FakeCompendiumMoveBuilder()
				.withName("Smite").withMoveType("playbook").withPlaybook("The Blessed")
				.build()
		);
		const moves = await repo.getPlaybookMoves("The Blessed");
		expect(moves).toHaveLength(1);
		expect(moves[0].name).toBe("Smite");
	});

	it("getPlaybookMoves does not return world move for a different playbook", async () => {
		const repo = new FakeMoveRepository();
		repo.addWorld(
			new FakeCompendiumMoveBuilder()
				.withName("Smite").withMoveType("playbook").withPlaybook("The Blessed")
				.build()
		);
		const moves = await repo.getPlaybookMoves("The Heavy");
		expect(moves).toHaveLength(0);
	});

	it("getBasicMoves returns world moves with moveType basic", async () => {
		const repo = new FakeMoveRepository();
		repo.addWorld(
			new FakeCompendiumMoveBuilder().withName("Defy Danger").withMoveType("basic").build()
		);
		const moves = await repo.getBasicMoves();
		expect(moves.some(m => m.name === "Defy Danger")).toBe(true);
	});

	it("getBasicMoveDocument falls back to world store when not in basicMoves", async () => {
		const repo = new FakeMoveRepository();
		repo.addWorld(
			new FakeCompendiumMoveBuilder().withName("Aid or Interfere").withMoveType("basic").build()
		);
		const doc = await repo.getBasicMoveDocument("aid-or-interfere");
		expect(doc).not.toBeNull();
		expect(doc.name).toBe("Aid or Interfere");
	});
});
