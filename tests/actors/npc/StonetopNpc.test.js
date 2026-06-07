import { describe, it, expect } from "vitest";
import { StonetopNpc } from "../../../src/actors/npc/StonetopNpc.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

function makeActor(overrides = {}) {
	const actor = new FakeActorBuilder().build();
	Object.assign(actor.system, overrides);
	return actor;
}

function makeNpc(overrides = {}) {
	return new StonetopNpc(makeActor(overrides));
}

describe("StonetopNpc — getters return defaults", () => {
	it("hp defaults to 0", () => expect(makeNpc().hp).toBe(0));
	it("maxHp defaults to 0", () => expect(makeNpc().maxHp).toBe(0));
	it("armor defaults to 0", () => expect(makeNpc().armor).toBe(0));
	it("damage defaults to 'd6'", () => expect(makeNpc().damage).toBe("d6"));
	it("specialQuality defaults to empty string", () => expect(makeNpc().specialQuality).toBe(""));
	it("instinct defaults to empty string", () => expect(makeNpc().instinct).toBe(""));
	it("description defaults to empty string", () => expect(makeNpc().description).toBe(""));
});

describe("StonetopNpc — getters reflect pre-seeded system values", () => {
	it("hp returns system.hp", () => expect(makeNpc({ hp: 8 }).hp).toBe(8));
	it("maxHp returns system.maxHp", () => expect(makeNpc({ maxHp: 10 }).maxHp).toBe(10));
	it("armor returns system.armor", () => expect(makeNpc({ armor: 2 }).armor).toBe(2));
	it("damage returns system.damage", () => expect(makeNpc({ damage: "d10" }).damage).toBe("d10"));
	it("specialQuality returns system.specialQuality", () => expect(makeNpc({ specialQuality: "undead" }).specialQuality).toBe("undead"));
	it("instinct returns system.instinct", () => expect(makeNpc({ instinct: "to feed" }).instinct).toBe("to feed"));
	it("description returns system.description", () => expect(makeNpc({ description: "Horrible." }).description).toBe("Horrible."));
});

describe("StonetopNpc — setters update observable state", () => {
	it("setHp updates hp", async () => {
		const npc = makeNpc();
		await npc.setHp(6);
		expect(npc.hp).toBe(6);
	});

	it("setMaxHp updates maxHp", async () => {
		const npc = makeNpc();
		await npc.setMaxHp(12);
		expect(npc.maxHp).toBe(12);
	});

	it("setArmor updates armor", async () => {
		const npc = makeNpc();
		await npc.setArmor(3);
		expect(npc.armor).toBe(3);
	});

	it("setDamage updates damage", async () => {
		const npc = makeNpc();
		await npc.setDamage("d8");
		expect(npc.damage).toBe("d8");
	});

	it("setSpecialQuality updates specialQuality", async () => {
		const npc = makeNpc();
		await npc.setSpecialQuality("ethereal");
		expect(npc.specialQuality).toBe("ethereal");
	});

	it("setInstinct updates instinct", async () => {
		const npc = makeNpc();
		await npc.setInstinct("to stalk");
		expect(npc.instinct).toBe("to stalk");
	});

	it("setDescription updates description", async () => {
		const npc = makeNpc();
		await npc.setDescription("A shadow given form.");
		expect(npc.description).toBe("A shadow given form.");
	});
});
