import { describe, expect, it, beforeEach } from "vitest";
import { migrateCharacterFlags } from "../../src/migration/migrateCharacter.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";

function makeActor(flags = {}) {
	const builder = new FakeActorBuilder();
	builder._flagsBuilder.withFlags(flags);
	return builder.build();
}

describe("migrateCharacterFlags — gate", () => {
	it("skips when vitals.maxHP flag is absent", async () => {
		const actor = makeActor({});
		actor.system.attributes.hp.max = 0;
		await migrateCharacterFlags(actor);
		expect(actor.system.attributes.hp.max).toBe(0);
	});
});

describe("migrateCharacterFlags — vitals", () => {
	it("copies vitals.maxHP to system.attributes.hp.max", async () => {
		const actor = makeActor({ "vitals.maxHP": 22 });
		await migrateCharacterFlags(actor);
		expect(actor.system.attributes.hp.max).toBe(22);
	});
});

describe("migrateCharacterFlags — playbook", () => {
	it("copies playbook.slug to system.playbookSlug", async () => {
		const actor = makeActor({ "vitals.maxHP": 16, "playbook.slug": "blessed" });
		await migrateCharacterFlags(actor);
		expect(actor.system.playbookSlug).toBe("blessed");
	});
});

describe("migrateCharacterFlags — identity fields", () => {
	it("copies background, instinct, origin", async () => {
		const actor = makeActor({
			"vitals.maxHP": 16,
			"background.selected": "the-grove",
			"instinct.custom": "to seek the Old Ways",
			"origin.selected": "the-blessed-basin",
		});
		await migrateCharacterFlags(actor);
		expect(actor.system.background.selected).toBe("the-grove");
		expect(actor.system.instinct.custom).toBe("to seek the Old Ways");
		expect(actor.system.origin.selected).toBe("the-blessed-basin");
	});
});

describe("migrateCharacterFlags — lore + postDeath", () => {
	it("copies lore.values and postDeathLore.values", async () => {
		const actor = makeActor({
			"vitals.maxHP": 16,
			"lore.values":        { "lore-group": { "opt-a": 1 } },
			"postDeathLore.values": { "pd-group": { "opt-b": 1 } },
		});
		await migrateCharacterFlags(actor);
		expect(actor.system.lore.values).toEqual({ "lore-group": { "opt-a": 1 } });
		expect(actor.system.postDeathLore.values).toEqual({ "pd-group": { "opt-b": 1 } });
	});

	it("copies postDeathInstinct.custom", async () => {
		const actor = makeActor({ "vitals.maxHP": 16, "postDeathInstinct.custom": "to hunger" });
		await migrateCharacterFlags(actor);
		expect(actor.system.postDeathInstinct.custom).toBe("to hunger");
	});
});

describe("migrateCharacterFlags — choices", () => {
	it("copies choices.values and postDeathChoices.values", async () => {
		const actor = makeActor({
			"vitals.maxHP": 16,
			"choices.values":          { "ns": { "slug-a": 1 } },
			"postDeathChoices.values": { "ns2": { "slug-b": 1 } },
		});
		await migrateCharacterFlags(actor);
		expect(actor.system.choices.values).toEqual({ "ns": { "slug-a": 1 } });
		expect(actor.system.postDeathChoices.values).toEqual({ "ns2": { "slug-b": 1 } });
	});

	it("migrates groupDefs row types while copying", async () => {
		const actor = makeActor({
			"vitals.maxHP": 16,
			"choices.groupDefs": {
				"instinct": { list: [{ slug: "the-call", type: "heading" }] },
			},
		});
		await migrateCharacterFlags(actor);
		expect(actor.system.choices.groupDefs["instinct"].list[0].type).toBe("entry");
	});
});

describe("migrateCharacterFlags — resources", () => {
	it("copies resources.counts and move-resources.counts", async () => {
		const actor = makeActor({
			"vitals.maxHP": 16,
			"resources.counts":       { backgrounds: { "grove": 2 } },
			"move-resources.counts":  { "move-slug": 1 },
		});
		await migrateCharacterFlags(actor);
		expect(actor.system.resources.counts).toEqual({ backgrounds: { "grove": 2 } });
		expect(actor.system.moveResources.counts).toEqual({ "move-slug": 1 });
	});
});

describe("migrateCharacterFlags — inventory", () => {
	it("copies all inventory fields", async () => {
		const actor = makeActor({
			"vitals.maxHP": 16,
			"inventory.checked":     { "sword": true },
			"inventory.loadLevel":   "normal",
			"inventory.regularPool": 3,
			"inventory.smallPool":   1,
			"inventory.otherItems":  "a coin",
		});
		await migrateCharacterFlags(actor);
		expect(actor.system.inventory.checked).toEqual({ "sword": true });
		expect(actor.system.inventory.loadLevel).toBe("normal");
		expect(actor.system.inventory.regularPool).toBe(3);
		expect(actor.system.inventory.smallPool).toBe(1);
		expect(actor.system.inventory.otherItems).toBe("a coin");
	});
});
