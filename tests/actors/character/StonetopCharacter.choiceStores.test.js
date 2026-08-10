import { describe, expect, it } from "vitest";
import { TestCharacterBuilder } from "../../fakes/TestCharacterBuilder.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";

// End-to-end routing: a ChoiceTarget built from a rendered row reaches the right document's value
// store, under the namespace the row was stamped with. These assert on what actually got stored
// rather than on which method was called, so a mis-wired registration cannot pass.

function charWith(items) {
	const actor = new FakeCharacterActorBuilder().withItems(items).build();
	return { char: new TestCharacterBuilder(actor).build(), actor };
}

const valuesOf = (actor, id, field) => actor.items.get(id)?.system?.[field] ?? {};

function arcanumItem() {
	return {
		_id: "arc1", type: "arcanum", name: "Ring of Daagon",
		system: {
			slug: "ring-of-daagon", flipped: false, choiceValues: {},
			front: { unlock: { slug: "ring-of-daagon", list: [
				{ type: "entry", slug: "the-ring", track: { max: 1 } },
			] } },
		},
	};
}

function followerItem() {
	return {
		_id: "fol1", type: "follower", name: "Enfys",
		system: {
			slug: "enfys", owned: true, choiceValues: {},
			// Group slug deliberately unlike the follower slug: they are independent.
			choices: [{ slug: "choices", list: [
				{ type: "pick", pickCount: 1, options: [{ slug: "he" }, { slug: "she" }] },
			] }],
		},
	};
}

function moveItem() {
	return {
		_id: "mov1", type: "move", name: "Potential for Greatness",
		system: {
			slug: "potential-for-greatness", categoryKey: "other", acquired: true, pickValues: {},
			choices: { slug: "choices", list: [
				{ type: "entry", slug: "stat1", track: { max: 1 }, input: {} },
			] },
		},
	};
}

function possessionItem() {
	return {
		_id: "pos1", type: "possession", name: "Weapons of war",
		system: {
			slug: "weapons-of-war-heavy", selected: true, pickValues: {}, choiceUses: {},
			// Base gear, so that any count-kind write re-syncs this container and creates an outfit item.
			outfitItems: [{ slug: "sword", name: "Sword", weight: 1, inventoryColumn: "regular" }],
			choices: { slug: "weapons-of-war-heavy", list: [
				{ type: "pick", pickCount: 2, options: [{ slug: "sword" }, { slug: "axe" }] },
			] },
		},
	};
}

describe("StonetopCharacter — choice writes reach the right store", () => {
	it("routes an arcanum count to that arcanum's choiceValues", async () => {
		const { char, actor } = charWith([arcanumItem()]);

		await char.setChoiceCountFor(
			new ChoiceTarget({ context: "arcana", arcanumSlug: "ring-of-daagon", group: "ring-of-daagon", option: "the-ring" }), 1);

		expect(valuesOf(actor, "arc1", "choiceValues")["ring-of-daagon"]["the-ring"]).toBe(1);
	});

	it("routes an arcanum text write to the same store, under the group it was stamped with", async () => {
		const { char, actor } = charWith([arcanumItem()]);

		await char.setChoiceTextFor(
			new ChoiceTarget({ context: "arcana", arcanumSlug: "ring-of-daagon", group: "ring-of-daagon", option: "note" }), "hi");

		expect(valuesOf(actor, "arc1", "choiceValues")["ring-of-daagon"].note).toBe("hi");
	});

	// The wrapper says WHICH follower, the row says which group on it. The group's slug is not the
	// follower's slug and nothing in the routing may assume it is.
	it("routes a follower pick to that follower's choiceValues, under the row's own group", async () => {
		const { char, actor } = charWith([followerItem()]);

		await char.setChoicePickFor(new ChoiceTarget({
			context: "follower", followerSlug: "enfys", group: "choices", option: "she", siblingsCsv: "he,she",
		}), true);

		expect(valuesOf(actor, "fol1", "choiceValues").choices.she).toBeTruthy();
	});

	// Re-clicking the option a "pick 1" row already holds releases it — a radio cannot be unticked,
	// so without this a pick made by mistake would be permanent.
	describe("clearing a pick", () => {
		const she = () => new ChoiceTarget({
			context: "follower", followerSlug: "enfys", group: "choices", option: "she", siblingsCsv: "he,she",
		});

		it("releases the option through the same store the pick went to", async () => {
			const { char, actor } = charWith([followerItem()]);
			await char.setChoicePickFor(she(), true);

			await char.clearChoicePickFor(she());

			expect(valuesOf(actor, "fol1", "choiceValues").choices.she).toBeFalsy();
		});

		// Zero, not a dropped key: Foundry deep-merges an update, so omitting it leaves the old value.
		it("writes zero rather than dropping the key", async () => {
			const { char, actor } = charWith([followerItem()]);
			await char.setChoicePickFor(she(), true);

			await char.clearChoicePickFor(she());

			expect(valuesOf(actor, "fol1", "choiceValues").choices.she).toBe(0);
		});

		// setChoicePickFor(target, false) cannot do this for a pick-1 row: siblings route it through
		// selectOption, which re-selects instead of clearing.
		it("succeeds where unchecking the pick would have re-selected it", async () => {
			const { char, actor } = charWith([followerItem()]);
			await char.setChoicePickFor(she(), true);

			await char.setChoicePickFor(she(), false);
			expect(valuesOf(actor, "fol1", "choiceValues").choices.she).toBe(1);

			await char.clearChoicePickFor(she());
			expect(valuesOf(actor, "fol1", "choiceValues").choices.she).toBe(0);
		});

		it("ignores a target whose context nothing registered", async () => {
			const { char, actor } = charWith([followerItem()]);
			await char.clearChoicePickFor(new ChoiceTarget({ context: "not-a-thing", group: "g", option: "o" }));
			expect(valuesOf(actor, "fol1", "choiceValues")).toEqual({});
		});
	});

	it("routes a move count to that move's pickValues, under the row's own group", async () => {
		const { char, actor } = charWith([moveItem()]);

		await char.setChoiceCountFor(new ChoiceTarget({
			context: "move", moveSlug: "potential-for-greatness", group: "choices", option: "stat1",
		}), 1);

		expect(valuesOf(actor, "mov1", "pickValues").choices.stat1).toBe(1);
	});

	it("routes possession text to that possession's pickValues", async () => {
		const { char, actor } = charWith([possessionItem()]);

		await char.setChoiceTextFor(
			new ChoiceTarget({ context: "possession", possessionSlug: "weapons-of-war-heavy", group: "weapons-of-war-heavy", option: "note" }), "engraved");

		expect(valuesOf(actor, "pos1", "pickValues")["weapons-of-war-heavy"].note).toBe("engraved");
	});

	// Possession text used to be routed through the COUNT path, so every keystroke published a count
	// change and re-synced the container's granted gear. Only counts decide what a choice grants, so a
	// text write must not touch outfit items at all.
	it("does not re-sync granted gear on a text write", async () => {
		const { char, actor } = charWith([possessionItem()]);

		await char.setChoiceTextFor(
			new ChoiceTarget({ context: "possession", possessionSlug: "weapons-of-war-heavy", group: "weapons-of-war-heavy", option: "note" }), "engraved");

		expect(actor.createdDocs.filter(d => d.type === "outfitItem")).toHaveLength(0);
	});

	it("does re-sync granted gear on a count write", async () => {
		const { char, actor } = charWith([possessionItem()]);

		await char.setChoiceCountFor(
			new ChoiceTarget({ context: "possession", possessionSlug: "weapons-of-war-heavy", group: "weapons-of-war-heavy", option: "sword" }), 1);

		expect(actor.createdDocs.filter(d => d.type === "outfitItem").length).toBeGreaterThan(0);
	});

	it("ignores a target whose context nothing registered", async () => {
		const { char, actor } = charWith([arcanumItem()]);

		await char.setChoiceCountFor(new ChoiceTarget({ context: "not-a-thing", group: "g", option: "o" }), 1);

		expect(valuesOf(actor, "arc1", "choiceValues")).toEqual({});
	});

	it("ignores a target whose document is gone", async () => {
		const { char } = charWith([arcanumItem()]);

		await expect(char.setChoiceCountFor(
			new ChoiceTarget({ context: "arcana", arcanumSlug: "missing", group: "g", option: "o" }), 1),
		).resolves.not.toThrow();
	});
});
