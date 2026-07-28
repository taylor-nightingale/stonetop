import {describe, it, expect, afterEach, vi} from "vitest";
import {StonetopCharacter} from "../../../src/actors/character/StonetopCharacter.js";
import {FoundryRepositoryFactory} from "../../../src/actors/character/repositories/FoundryRepositoryFactory.js";
import {FakeGameBuilder} from "../../fakes/FakeGameBuilder.js";
import {FakeCharacterActorBuilder} from "../../fakes/FakeCharacterActorBuilder.js";
import {FakePackBuilder} from "../../fakes/foundry/FakePackBuilder.js";
import {FakeCompendiumMoveBuilder} from "../../fakes/FakeCompendiumMoveBuilder.js";

// Integration test: real StonetopCharacter + real FoundryRepositoryFactory/repositories +
// real CharacterArcana/CharacterMoves. Only the Foundry boundary is faked. This exercises the full
// drop→onArcanumCreated→buildSnapshot wiring: a major arcanum's mystery moves are registered as real
// `move` items in an `arcana-<slug>` category, rendered on the card, tickable, and kept off the moves tab.

function move(name) { return new FakeCompendiumMoveBuilder().withName(name).build(); }

function withMovesPack(...moves) {
	const pack = FakePackBuilder.movesPack();
	for (const m of moves) pack.withItem(m);
	new FakeGameBuilder().withPack(pack).build();
}

// A dropped major arcanum item: its back grants moves via move-grant entries in a "Moves" choice group.
function majorArcanumItem(moveSlugs) {
	return {
		_id: "arc1", type: "arcanum", name: "Azure Hand",
		system: {
			slug: "azure-hand", major: true, flipped: true,
			front: { title: "Azure Hand", description: null, item: null, unlock: null },
			back:  { title: "Mysteries", description: "the back", choices: [{ slug: "moves", title: "Moves",
				list: moveSlugs.map(s => ({ type: "entry", slug: s, track: { max: 1 }, grants: [{ type: "move", slug: s, locations: ["inline"] }] })) }] },
			choiceValues: {},
		},
	};
}

// Faithful to the real drop flow: Foundry first creates the embedded arcanum item, THEN fires the
// create-descendant hook with that document. Build the actor with the item already embedded, then drive
// the hook against the same object.
function characterWithArcanum(arcanumItem) {
	return new StonetopCharacter(
		new FakeCharacterActorBuilder().addItem(arcanumItem).build(), new FoundryRepositoryFactory(),
	);
}

// The card's "Moves" group and the move slugs it grants inline.
function cardMoveGrantSlugs(card) {
	const group = card.back.choices.find(g => g.slug === "moves");
	return group.list.flatMap(r => r.moves?.slugs ?? []);
}

describe("StonetopCharacter — major arcana granted moves render as real moves (integration)", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("a dropped major arcanum grants its moves as owned move items, referenced inline on the card", async () => {
		withMovesPack(move("Battery"), move("Resonance"));
		const arcanum = majorArcanumItem(["battery", "resonance"]);
		const character = characterWithArcanum(arcanum);

		await character._onCreateDescendantDocuments([arcanum]);

		const snap = await character.buildSnapshot();
		const card = snap.arcana.major.items.find(c => c.slug === "azure-hand");
		expect(card).toBeDefined();
		// The card's Moves group grants both moves inline (slug references resolved against moves.bySlug).
		expect(cardMoveGrantSlugs(card).sort()).toEqual(["battery", "resonance"]);
		// Each is a real, OWNED move item (seeded acquired so it rolls) resolvable in the registry.
		expect(snap.moves.bySlug["battery"]?.ownedId).toBeTruthy();
		expect(snap.moves.bySlug["resonance"]?.ownedId).toBeTruthy();
		expect(snap.moves.bySlug["battery"].selection.value).toBe(1);   // acquired, not tick-to-unlock
	});

	it("a rollable granted move exposes its rollStat and owned move id in the registry", async () => {
		// move-row emits `.item[data-item-id]` from the resolved snapshot's ownedId + rollStat, so the roll
		// resolves the OWNED move item (full description + result tiers), not a bare stat roll.
		const resonance = new FakeCompendiumMoveBuilder().withName("Resonance").withRollStat("int")
			.withMoveResults({ success: { label: "10+", value: "it comes to pass" },
				partial: { label: "7-9", value: "mark a consequence" }, failure: { label: "6-", value: "" } }).build();
		withMovesPack(resonance, move("Battery"));
		const arcanum = majorArcanumItem(["battery", "resonance"]);
		const character = characterWithArcanum(arcanum);

		await character._onCreateDescendantDocuments([arcanum]);

		const snap = await character.buildSnapshot();
		const m = snap.moves.bySlug["resonance"];
		expect(m.rollStat).toBe("int");
		expect(m.ownedId).toBeTruthy();
	});

	it("a granted move with a ○ resource track exposes its resource, with a fill-in blank", async () => {
		// Battery has a single-○ resource with a write-in blank; Mindwalking has a 3-○ pool with none.
		const battery = new FakeCompendiumMoveBuilder().withName("Battery")
			.withResource({ max: 1, title: null, input: { type: "inline" } }).build();
		const mindwalking = new FakeCompendiumMoveBuilder().withName("Mindwalking")
			.withResource({ max: 3, title: null }).build();
		withMovesPack(battery, mindwalking);
		const arcanum = majorArcanumItem(["battery", "mindwalking"]);
		const character = characterWithArcanum(arcanum);

		await character._onCreateDescendantDocuments([arcanum]);

		const snap = await character.buildSnapshot();
		expect(snap.moves.bySlug["battery"].resource.max).toBe(1);
		expect(snap.moves.bySlug["battery"].resource.input).toEqual({ value: "", placeholder: null, type: "inline" });
		expect(snap.moves.bySlug["mindwalking"].resource.max).toBe(3);
		expect(snap.moves.bySlug["mindwalking"].resource.input).toBeNull();
	});

	it("writing in a granted move's resource fill-in blank persists and reappears", async () => {
		const battery = new FakeCompendiumMoveBuilder().withName("Battery")
			.withResource({ max: 1, title: null, input: { type: "inline" } }).build();
		withMovesPack(battery);
		const arcanum = majorArcanumItem(["battery"]);
		const character = characterWithArcanum(arcanum);

		await character._onCreateDescendantDocuments([arcanum]);
		await character.setMoveResourceText("battery", "a caged thunderclap");

		const snap = await character.buildSnapshot();
		expect(snap.moves.bySlug["battery"].resource.input.value).toBe("a caged thunderclap");
	});

	it("granted arcana moves are in the registry but NOT on the moves tab", async () => {
		withMovesPack(move("Battery"), move("Resonance"));
		const arcanum = majorArcanumItem(["battery", "resonance"]);
		const character = characterWithArcanum(arcanum);

		await character._onCreateDescendantDocuments([arcanum]);

		const snap = await character.buildSnapshot();
		// No arcana category on the tab, and the moves appear in NO moves-tab category (not even "other")…
		expect(snap.moves.categories.find(c => c.key === "arcana-azure-hand")).toBeUndefined();
		const tabMoveNames = snap.moves.categories.flatMap(c => c.moves.map(m => m.name));
		expect(tabMoveNames).not.toContain("Battery");
		expect(tabMoveNames).not.toContain("Resonance");
		// …but they ARE resolvable in the registry (so their inline card references render).
		expect(snap.moves.bySlug["battery"]).toBeDefined();
	});

	it("removing the arcanum removes its granted-move category", async () => {
		withMovesPack(move("Battery"), move("Resonance"));
		const arcanum = majorArcanumItem(["battery", "resonance"]);
		const character = characterWithArcanum(arcanum);

		await character._onCreateDescendantDocuments([arcanum]);
		await character.removeArcanum("azure-hand");

		const snap = await character.buildSnapshot();
		expect(snap.arcana.major.items.find(c => c.slug === "azure-hand")).toBeUndefined();
		expect(snap.moves.bySlug["battery"]).toBeUndefined();
	});
});
