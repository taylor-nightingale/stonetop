import { describe, expect, it } from "vitest";
import { migrateChoiceValues, migratePlaybookChoiceValues, migrateInsertMoveCategories, migrateInsertChoiceValues } from "../../src/migration/migrateCharacter.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";

function makeActor({ choicesValues = {}, pbSystem = {}, moveItems = [] } = {}) {
	const items = [];
	if (pbSystem !== null) {
		items.push({ _id: "pb-1", type: "playbook", name: "The Blessed", system: { backgrounds: [], ...pbSystem } });
	}
	items.push(...moveItems);
	const actor = new FakeActorBuilder().withItems(items).build();
	actor.update({ "system.choices.values": choicesValues });
	return actor;
}

// ── Gate ─────────────────────────────────────────────────────────────────────

describe("migrateChoiceValues — gate", () => {
	it("skips when choices.values is empty", async () => {
		const actor = makeActor({ choicesValues: {} });
		await migrateChoiceValues(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("skips when choices.values is absent", async () => {
		const actor = makeActor();
		await migrateChoiceValues(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});
});

// ── Instinct / appearance ─────────────────────────────────────────────────────

describe("migrateChoiceValues — instinct and appearance", () => {
	it("moves instinct values to playbook item choiceValues.instinct", async () => {
		const actor = makeActor({ choicesValues: { instinct: { delight: 1 } } });
		await migrateChoiceValues(actor);
		expect(actor.items.get("pb-1").system.choiceValues).toMatchObject({ instinct: { delight: 1 } });
	});

	it("moves appearance values to playbook item choiceValues.appearance", async () => {
		const actor = makeActor({ choicesValues: { appearance: { "fresh-faced": 1 } } });
		await migrateChoiceValues(actor);
		expect(actor.items.get("pb-1").system.choiceValues).toMatchObject({ appearance: { "fresh-faced": 1 } });
	});

	it("skips instinct/appearance keys when no playbook item", async () => {
		const actor = makeActor({ choicesValues: { instinct: { delight: 1 } }, pbSystem: null });
		await migrateChoiceValues(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});
});

// ── Background values ─────────────────────────────────────────────────────────

describe("migrateChoiceValues — background values", () => {
	it("moves background slug values to playbook item backgroundValues", async () => {
		const actor = makeActor({
			choicesValues: { initiate: { enfys: 1 } },
			pbSystem: { backgrounds: [{ slug: "initiate" }] },
		});
		await migrateChoiceValues(actor);
		expect(actor.items.get("pb-1").system.backgroundValues).toEqual({ initiate: { enfys: 1 } });
	});

	it("collects multiple background slugs into backgroundValues", async () => {
		const actor = makeActor({
			choicesValues: { initiate: { enfys: 1 }, vessel: { adra: 1 } },
			pbSystem: { backgrounds: [{ slug: "initiate" }, { slug: "vessel" }] },
		});
		await migrateChoiceValues(actor);
		expect(actor.items.get("pb-1").system.backgroundValues).toEqual({
			initiate: { enfys: 1 }, vessel: { adra: 1 },
		});
	});

	it("ignores non-background slugs in backgroundValues", async () => {
		const actor = makeActor({
			choicesValues: { "potential-for-greatness": { stat1: 1 }, initiate: { enfys: 1 } },
			pbSystem: { backgrounds: [{ slug: "initiate" }] },
		});
		await migrateChoiceValues(actor);
		expect(actor.items.get("pb-1").system.backgroundValues).toEqual({ initiate: { enfys: 1 } });
		expect(actor.items.get("pb-1").system.backgroundValues["potential-for-greatness"]).toBeUndefined();
	});
});

// ── Move values ───────────────────────────────────────────────────────────────

describe("migrateChoiceValues — move values", () => {
	it("moves values keyed by move slug to move item pickValues under choices slug", async () => {
		const moveItem = {
			_id: "m-1", type: "move", name: "Potential for Greatness",
			system: { slug: "potential-for-greatness", choices: { slug: "potential", list: [] } },
		};
		const actor = makeActor({
			choicesValues: { "potential-for-greatness": { stat1: 1 } },
			moveItems: [moveItem],
		});
		await migrateChoiceValues(actor);
		expect(actor.items.get("m-1").system.pickValues).toEqual({ potential: { stat1: 1 } });
	});

	it("skips move items without a choices field", async () => {
		const moveItem = { _id: "m-1", type: "move", name: "Defy Danger", system: { slug: "defy-danger" } };
		const actor = makeActor({
			choicesValues: { "defy-danger": { x: 1 } },
			moveItems: [moveItem],
		});
		await migrateChoiceValues(actor);
		expect(actor.updatedDocs.find(d => d._id === "m-1")).toBeUndefined();
	});

	it("skips move items whose slug is not in choices.values", async () => {
		const moveItem = {
			_id: "m-1", type: "move", name: "Alpha",
			system: { slug: "alpha", choices: { slug: "alpha", list: [] } },
		};
		const actor = makeActor({ choicesValues: { instinct: { x: 1 } }, moveItems: [moveItem] });
		await migrateChoiceValues(actor);
		expect(actor.updatedDocs.find(d => d._id === "m-1")).toBeUndefined();
	});
});

// ── migrateInsertMoveCategories ───────────────────────────────────────────────

describe("migrateInsertMoveCategories", () => {
	it("renames post-death-{slug} categoryKey to insert-{slug}", async () => {
		const actor = new FakeActorBuilder().withItems([
			{ _id: "m-1", type: "move", name: "Haunt", system: { categoryKey: "post-death-revenant" } },
		]).build();
		await migrateInsertMoveCategories(actor);
		expect(actor.items.get("m-1").system.categoryKey).toBe("insert-revenant");
	});

	it("renames all post-death move items in one batch", async () => {
		const actor = new FakeActorBuilder().withItems([
			{ _id: "m-1", type: "move", name: "Haunt", system: { categoryKey: "post-death-ghost" } },
			{ _id: "m-2", type: "move", name: "Wail",  system: { categoryKey: "post-death-ghost" } },
		]).build();
		await migrateInsertMoveCategories(actor);
		expect(actor.updatedDocs).toHaveLength(2);
		expect(actor.items.get("m-1").system.categoryKey).toBe("insert-ghost");
		expect(actor.items.get("m-2").system.categoryKey).toBe("insert-ghost");
	});

	it("does nothing when no post-death move categories exist", async () => {
		const actor = new FakeActorBuilder().withItems([
			{ _id: "m-1", type: "move", name: "Defy Danger", system: { categoryKey: "basic" } },
		]).build();
		await migrateInsertMoveCategories(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("leaves non-post-death categories unchanged", async () => {
		const actor = new FakeActorBuilder().withItems([
			{ _id: "m-1", type: "move", name: "Defy Danger",  system: { categoryKey: "basic" } },
			{ _id: "m-2", type: "move", name: "Post-Death M", system: { categoryKey: "post-death-revenant" } },
		]).build();
		await migrateInsertMoveCategories(actor);
		expect(actor.items.get("m-1").system.categoryKey).toBe("basic");
		expect(actor.items.get("m-2").system.categoryKey).toBe("insert-revenant");
	});
});

// ── migrateInsertChoiceValues ─────────────────────────────────────────────────

function makeActorWithInsert({ insertSystem = {}, flags = {} } = {}) {
	const builder = new FakeActorBuilder().withItems([
		{ _id: "ins-1", type: "insert", name: "Revenant", system: { slug: "revenant", choiceValues: {}, ...insertSystem } },
	]);
	builder._flagsBuilder.withFlags(flags);
	return builder.build();
}

describe("migrateInsertChoiceValues", () => {
	it("skips when no insert item is present", async () => {
		const actor = new FakeActorBuilder().build();
		await migrateInsertChoiceValues(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("skips when insert already has choiceValues", async () => {
		const actor = makeActorWithInsert({ insertSystem: { choiceValues: { instinct: { denial: 1 } } } });
		await migrateInsertChoiceValues(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("merges postDeathChoices.values onto insert item choiceValues", async () => {
		const actor = makeActorWithInsert({
			flags: { "postDeathChoices.values": { instinct: { denial: 1 } } },
		});
		await migrateInsertChoiceValues(actor);
		expect(actor.items.get("ins-1").system.choiceValues).toEqual({ instinct: { denial: 1 } });
	});

	it("merges postDeathLore.values onto insert item choiceValues", async () => {
		const actor = makeActorWithInsert({
			flags: { "postDeathLore.values": { "terrible-purpose": { longing: 1 } } },
		});
		await migrateInsertChoiceValues(actor);
		expect(actor.items.get("ins-1").system.choiceValues).toEqual({ "terrible-purpose": { longing: 1 } });
	});

	it("merges both postDeathChoices and postDeathLore into a single choiceValues object", async () => {
		const actor = makeActorWithInsert({
			flags: {
				"postDeathChoices.values": { instinct: { denial: 1 } },
				"postDeathLore.values":    { "terrible-purpose": { longing: 1 } },
			},
		});
		await migrateInsertChoiceValues(actor);
		expect(actor.items.get("ins-1").system.choiceValues).toEqual({
			instinct: { denial: 1 },
			"terrible-purpose": { longing: 1 },
		});
	});

	it("skips when both postDeathChoices and postDeathLore are absent from flags", async () => {
		const actor = makeActorWithInsert({});
		await migrateInsertChoiceValues(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});
});

// ── migratePlaybookChoiceValues ───────────────────────────────────────────────

function makeActorWithPlaybook({ pbSystem = {}, actorSystem = {} } = {}) {
	const actor = new FakeActorBuilder().withItems([
		{ _id: "pb-1", type: "playbook", name: "The Blessed", system: { choiceValues: {}, ...pbSystem } },
	]).build();
	Object.assign(actor.system, actorSystem);
	return actor;
}

describe("migratePlaybookChoiceValues — gate", () => {
	it("skips when no playbook item is present", async () => {
		const actor = new FakeActorBuilder().build();
		await migratePlaybookChoiceValues(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("skips when all sources are empty", async () => {
		const actor = makeActorWithPlaybook();
		await migratePlaybookChoiceValues(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});
});

describe("migratePlaybookChoiceValues — instinct", () => {
	it("migrates instinctValues to choiceValues.instinct", async () => {
		const actor = makeActorWithPlaybook({ pbSystem: { instinctValues: { delight: 1 } } });
		await migratePlaybookChoiceValues(actor);
		expect(actor.items.get("pb-1").system.choiceValues).toMatchObject({ instinct: { delight: 1 } });
	});

	it("migrates instinct.custom to choiceValues.instinct.__custom", async () => {
		const actor = makeActorWithPlaybook({ actorSystem: { instinct: { custom: "my instinct" } } });
		await migratePlaybookChoiceValues(actor);
		expect(actor.items.get("pb-1").system.choiceValues).toMatchObject({ instinct: { __custom: "my instinct" } });
	});

	it("does not overwrite existing choiceValues.instinct", async () => {
		const actor = makeActorWithPlaybook({
			pbSystem: {
				choiceValues:   { instinct: { delight: 1 } },
				instinctValues: { nurture: 1 },
			},
		});
		await migratePlaybookChoiceValues(actor);
		expect(actor.items.get("pb-1").system.choiceValues.instinct).toEqual({ delight: 1 });
	});

	it("does not add instinct entry when instinct.custom is empty", async () => {
		const actor = makeActorWithPlaybook({ actorSystem: { instinct: { custom: "" } } });
		await migratePlaybookChoiceValues(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});
});

describe("migratePlaybookChoiceValues — appearance", () => {
	it("migrates appearanceValues to choiceValues.appearance", async () => {
		const actor = makeActorWithPlaybook({ pbSystem: { appearanceValues: { "fresh-faced": 1 } } });
		await migratePlaybookChoiceValues(actor);
		expect(actor.items.get("pb-1").system.choiceValues).toMatchObject({ appearance: { "fresh-faced": 1 } });
	});

	it("does not overwrite existing choiceValues.appearance", async () => {
		const actor = makeActorWithPlaybook({
			pbSystem: {
				choiceValues:     { appearance: { wizened: 1 } },
				appearanceValues: { "fresh-faced": 1 },
			},
		});
		await migratePlaybookChoiceValues(actor);
		expect(actor.items.get("pb-1").system.choiceValues.appearance).toEqual({ wizened: 1 });
	});
});

describe("migratePlaybookChoiceValues — lore", () => {
	it("migrates lore.values entries to choiceValues by group slug", async () => {
		const actor = makeActorWithPlaybook({
			actorSystem: { lore: { values: { "lore-1": { "shrine-loved": 1 } } } },
		});
		await migratePlaybookChoiceValues(actor);
		expect(actor.items.get("pb-1").system.choiceValues).toMatchObject({ "lore-1": { "shrine-loved": 1 } });
	});

	it("migrates multiple lore groups", async () => {
		const actor = makeActorWithPlaybook({
			actorSystem: { lore: { values: { "lore-1": { a: 1 }, "lore-2": { b: 1 } } } },
		});
		await migratePlaybookChoiceValues(actor);
		expect(actor.items.get("pb-1").system.choiceValues).toMatchObject({ "lore-1": { a: 1 }, "lore-2": { b: 1 } });
	});

	it("does not overwrite existing lore entries", async () => {
		const actor = makeActorWithPlaybook({
			pbSystem:   { choiceValues: { "lore-1": { "shrine-loved": 1 } } },
			actorSystem: { lore: { values: { "lore-1": { other: 1 } } } },
		});
		await migratePlaybookChoiceValues(actor);
		expect(actor.items.get("pb-1").system.choiceValues["lore-1"]).toEqual({ "shrine-loved": 1 });
	});
});

describe("migratePlaybookChoiceValues — combined", () => {
	it("merges all sources into a single choiceValues write", async () => {
		const actor = makeActorWithPlaybook({
			pbSystem: {
				instinctValues:   { delight: 1 },
				appearanceValues: { "fresh-faced": 1 },
			},
			actorSystem: { lore: { values: { "lore-1": { "shrine-loved": 1 } } } },
		});
		await migratePlaybookChoiceValues(actor);
		expect(actor.items.get("pb-1").system.choiceValues).toEqual({
			instinct:  { delight: 1 },
			appearance: { "fresh-faced": 1 },
			"lore-1":  { "shrine-loved": 1 },
		});
		expect(actor.updatedDocs).toHaveLength(1);
	});
});
