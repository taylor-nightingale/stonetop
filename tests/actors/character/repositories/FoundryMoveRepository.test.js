import {afterEach, describe, expect, it, vi} from "vitest";
import {FoundryMoveRepository} from "../../../../src/actors/character/repositories/FoundryMoveRepository.js";
import {Move} from "../../../../src/model/data/Move.js";
import {FakeCompendiumMoveBuilder} from "../../../fakes/FakeCompendiumMoveBuilder.js";
import {FakeGameBuilder} from "../../../fakes/FakeGameBuilder.js";
import {FakePackBuilder} from "../../../fakes/foundry/FakePackBuilder.js";

// -- Fixtures ------------------------------------------------------------------

const BASIC_MOVE_A    = new FakeCompendiumMoveBuilder().withName("Defy Danger").withRollType("stat").withMoveType("basic").build();
const BASIC_MOVE_B    = new FakeCompendiumMoveBuilder().withName("Aid or Interfere").withRollType("stat").withMoveType("basic").build();
const REVENANT_MOVE_A = new FakeCompendiumMoveBuilder().withName("Unliving").build(); // slug: unliving

describe("FoundryMoveRepository", () => {
	afterEach(() => vi.unstubAllGlobals());

	describe("getMovesByType / getBasicMoves", () => {
		it("returns [] when pack is not registered", async () => {
			new FakeGameBuilder().build();
			expect(await new FoundryMoveRepository().getBasicMoves()).toEqual([]);
		});

		it("returns Move instances for all moves of the type", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.movesPack().withItem(BASIC_MOVE_A).withItem(BASIC_MOVE_B))
				.build();
			const moves = await new FoundryMoveRepository().getBasicMoves();
			expect(moves).toHaveLength(2);
			expect(moves[0]).toBeInstanceOf(Move);
			expect(moves.map(m => m.id)).toEqual([BASIC_MOVE_A._id, BASIC_MOVE_B._id]);
		});
	});

	describe("getReferencedMoveDocument", () => {
		it("returns null when not in pack and no world item", async () => {
			new FakeGameBuilder().build();
			expect(await new FoundryMoveRepository().getReferencedMoveDocument(REVENANT_MOVE_A._id)).toBeNull();
		});

		it("returns the document when found in the pack", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.movesPack().withItem(REVENANT_MOVE_A))
				.build();
			expect(await new FoundryMoveRepository().getReferencedMoveDocument(REVENANT_MOVE_A._id)).toEqual(REVENANT_MOVE_A);
		});

		it("falls back to a world move when not in the pack", async () => {
			const worldMove = new FakeCompendiumMoveBuilder().withName("Custom Move").build();
			new FakeGameBuilder().withWorldItem(worldMove).build();
			expect(await new FoundryMoveRepository().getReferencedMoveDocument(worldMove._id)).toEqual(worldMove);
		});
	});

	describe("getMovesBySlugs", () => {
		it("returns [] for an empty list", async () => {
			new FakeGameBuilder().build();
			expect(await new FoundryMoveRepository().getMovesBySlugs([])).toEqual([]);
		});

		it("resolves slugs across compendium + world, preserves order, drops unknowns", async () => {
			const worldMove = new FakeCompendiumMoveBuilder().withName("Custom Move").build(); // slug: custom-move
			new FakeGameBuilder()
				.withPack(FakePackBuilder.movesPack().withItem(REVENANT_MOVE_A)) // slug: unliving
				.withWorldItem(worldMove)
				.build();
			const moves = await new FoundryMoveRepository().getMovesBySlugs(["custom-move", "nope", "unliving"]);
			expect(moves.map(m => m.slug)).toEqual(["custom-move", "unliving"]);
			expect(moves[0]).toBeInstanceOf(Move);
		});
	});

	describe("getMoveEntriesBySlugs", () => {
		it("returns [] for an empty list", async () => {
			new FakeGameBuilder().build();
			expect(await new FoundryMoveRepository().getMoveEntriesBySlugs([])).toEqual([]);
		});

		it("returns item-shaped entries across compendium + world, in order, dropping unknowns", async () => {
			const worldMove = new FakeCompendiumMoveBuilder().withName("Custom Move").build(); // slug: custom-move
			new FakeGameBuilder()
				.withPack(FakePackBuilder.movesPack().withItem(REVENANT_MOVE_A)) // slug: unliving
				.withWorldItem(worldMove)
				.build();
			const entries = await new FoundryMoveRepository().getMoveEntriesBySlugs(["custom-move", "nope", "unliving"]);
			// Item-shaped (carry `.system`), unlike the flat Move models getMovesBySlugs returns. A pack
			// entry is an INDEX ROW, not the document — it carries the indexed fields, not every field.
			expect(entries.map(e => e.system.slug)).toEqual(["custom-move", "unliving"]);
			expect(entries[1]._id).toBe(REVENANT_MOVE_A._id);
			expect(entries[1].name).toBe(REVENANT_MOVE_A.name);
		});
	});

	describe("getMoveDocumentBySlug", () => {
		it("returns null for an unknown slug", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.movesPack().withItem(REVENANT_MOVE_A))
				.build();
			expect(await new FoundryMoveRepository().getMoveDocumentBySlug("nope")).toBeNull();
		});

		it("returns the pack document for a compendium move", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.movesPack().withItem(REVENANT_MOVE_A))
				.build();
			expect(await new FoundryMoveRepository().getMoveDocumentBySlug("unliving")).toEqual(REVENANT_MOVE_A);
		});

		it("falls back to a world move when the pack has no such slug", async () => {
			const worldMove = new FakeCompendiumMoveBuilder().withName("Custom Move").build(); // slug: custom-move
			new FakeGameBuilder().withWorldItem(worldMove).build();
			expect(await new FoundryMoveRepository().getMoveDocumentBySlug("custom-move")).toEqual(worldMove);
		});
	});
	// A translated world: Babele localizes a document's `name` and never touches `system.slug`, so the
	// two disagree for every pack move. Every lookup here takes a slug from stored data, so the index
	// has to carry the real slug — deriving one from the name resolves nothing.
	describe("a move whose name disagrees with its slug", () => {
		const TRANSLATED = new FakeCompendiumMoveBuilder()
			.withName("Der Untote").withSlug("unliving").withMoveType("basic").build();

		const withTranslatedPack = () => new FakeGameBuilder()
			.withPack(FakePackBuilder.movesPack().withItem(TRANSLATED))
			.build();

		it("indexes it under its stored slug, not one derived from the translated name", async () => {
			withTranslatedPack();
			const index = await new FoundryMoveRepository().buildSlugIndex();
			expect([...index.keys()]).toEqual(["unliving"]);
		});

		it("resolves it by its stored slug", async () => {
			withTranslatedPack();
			const moves = await new FoundryMoveRepository().getMovesBySlugs(["unliving"]);
			expect(moves.map(m => m.name)).toEqual(["Der Untote"]);
		});

		it("maps the stored slug to the translated name, so a requirement label reads translated", async () => {
			withTranslatedPack();
			expect(await new FoundryMoveRepository().namesBySlug()).toEqual(new Map([["unliving", "Der Untote"]]));
		});

		it("resolves its entry and its document by the stored slug", async () => {
			withTranslatedPack();
			const repo = new FoundryMoveRepository();
			expect((await repo.getMoveEntriesBySlugs(["unliving"]))[0]?.name).toBe("Der Untote");
			expect(await repo.getMoveDocumentBySlug("unliving")).toEqual(TRANSLATED);
		});
	});
});
