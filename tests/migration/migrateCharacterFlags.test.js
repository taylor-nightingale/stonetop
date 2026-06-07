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

	it("prefers the PBTA system value when it is larger than the flag", async () => {
		const actor = makeActor({ "vitals.maxHP": 9 });
		actor.system.attributes.hp.max = 16;
		await migrateCharacterFlags(actor);
		expect(actor.system.attributes.hp.max).toBe(16);
	});

	it("uses the flag value when it is larger than the system value", async () => {
		const actor = makeActor({ "vitals.maxHP": 20 });
		actor.system.attributes.hp.max = 8;
		await migrateCharacterFlags(actor);
		expect(actor.system.attributes.hp.max).toBe(20);
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

describe("migrateCharacterFlags — lore", () => {
	it("copies lore.values", async () => {
		const actor = makeActor({
			"vitals.maxHP": 16,
			"lore.values": { "lore-group": { "opt-a": 1 } },
		});
		await migrateCharacterFlags(actor);
		expect(actor.system.lore.values).toEqual({ "lore-group": { "opt-a": 1 } });
	});
});

describe("migrateCharacterFlags — choices", () => {
	it("copies choices.values", async () => {
		const actor = makeActor({
			"vitals.maxHP": 16,
			"choices.values": { "ns": { "slug-a": 1 } },
		});
		await migrateCharacterFlags(actor);
		expect(actor.system.choices.values).toEqual({ "ns": { "slug-a": 1 } });
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
