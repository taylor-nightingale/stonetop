import { describe, it, expect, vi } from "vitest";
import { CharacterVitals } from "../../../module/actors/character/CharacterVitals.js";

function makeActor(attrs = {}, vitalsFlags = {}) {
	const flagStore = {};
	for (const [k, v] of Object.entries(vitalsFlags)) {
		flagStore[`vitals.${k}`] = v;
	}
	return {
		system: { attributes: attrs },
		getFlag: (_scope, key) => flagStore[key] ?? null,
		setFlag: vi.fn(async () => {}),
		update: vi.fn(),
	};
}

function makeInventory(armor = 0) {
	return { getArmor: async () => armor };
}

function makeVitals(attrs = {}, vitalsFlags = {}, armor = 0) {
	return new CharacterVitals(makeActor(attrs, vitalsFlags), makeInventory(armor));
}

describe("CharacterVitals.buildVitalsSnapshot", () => {
	it("hp.max comes from vitals flags maxHP", async () => {
		const snap = await makeVitals({}, { maxHP: 20 }).buildVitalsSnapshot();
		expect(snap.hp.max).toBe(20);
	});

	it("hp.value comes from actor attrs.hp.value", async () => {
		const snap = await makeVitals({ hp: { value: 12 } }, { maxHP: 20 }).buildVitalsSnapshot();
		expect(snap.hp.value).toBe(12);
	});

	it("hp.max defaults to 0 when maxHP flag not set", async () => {
		const snap = await makeVitals({ hp: { value: 5 } }).buildVitalsSnapshot();
		expect(snap.hp.max).toBe(0);
	});

	it("damage comes from vitals flags", async () => {
		const snap = await makeVitals({}, { maxHP: 18, damage: {die: "d6"} }).buildVitalsSnapshot();
		expect(snap.damage).toEqual({die: "d6"});
	});

	it("damage is null when damage flag not set", async () => {
		const snap = await makeVitals().buildVitalsSnapshot();
		expect(snap.damage).toBeNull();
	});

	it("armor comes from inventory.getArmor()", async () => {
		const snap = await makeVitals({}, { maxHP: 18 }, 3).buildVitalsSnapshot();
		expect(snap.armor).toBe(3);
	});

	it("level comes from actor attrs.level scalar", async () => {
		const snap = await makeVitals({ level: 4 }, { maxHP: 18 }).buildVitalsSnapshot();
		expect(snap.level).toBe(4);
	});

	it("level is 1 when missing from actor", async () => {
		const snap = await makeVitals({}, { maxHP: 18 }).buildVitalsSnapshot();
		expect(snap.level).toBe(1);
	});

	it("xp.max = 6 + level * 2", async () => {
		const snap = await makeVitals({ level: 4 }, { maxHP: 18 }).buildVitalsSnapshot();
		expect(snap.xp.max).toBe(14);
	});

	it("xp.value comes from actor attrs.xp.value", async () => {
		const snap = await makeVitals({ xp: { value: 5 } }, { maxHP: 18 }).buildVitalsSnapshot();
		expect(snap.xp.value).toBe(5);
	});

	it("defaults gracefully when actor.system.attributes is absent", async () => {
		const actor = {
			system: {},
			getFlag: (_s, k) => k === "vitals.maxHP" ? 18 : null,
			setFlag: vi.fn(),
			update: vi.fn(),
		};
		const snap = await new CharacterVitals(actor, makeInventory(0)).buildVitalsSnapshot();
		expect(snap.hp).toMatchObject({ value: 0, max: 18 });
		expect(snap.level).toBe(1);
		expect(snap.xp.max).toBe(8);
	});

	it("hp and damage are zero/null when no flags set", async () => {
		const snap = await makeVitals({ }).buildVitalsSnapshot();
		expect(snap.hp).toMatchObject({ value: 0, max: 0 });
		expect(snap.damage).toBeNull();
	});
});

describe("CharacterVitals.setHP / setDamage / setMaxHP", () => {
	it("setHP calls actor.update with hp.value", async () => {
		const actor = makeActor();
		await new CharacterVitals(actor, makeInventory()).setHP(14);
		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.hp.value": 14 });
	});

	it("setMaxHP writes only to flags, not system", async () => {
		const actor = makeActor();
		await new CharacterVitals(actor, makeInventory()).setMaxHP(20);
		expect(actor.update).not.toHaveBeenCalled();
		expect(actor.setFlag).toHaveBeenCalledWith("stonetop", "vitals.maxHP", 20);
	});

	it("setDamage writes die to system.attributes.damage.value", async () => {
		const actor = makeActor();
		await new CharacterVitals(actor, makeInventory())._setDamage({die: "d8"});
		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.damage.value": "d8" });
	});

	it("setDamage stores full damage object in flags", async () => {
		const actor = makeActor();
		await new CharacterVitals(actor, makeInventory())._setDamage({die: "d8"});
		expect(actor.setFlag).toHaveBeenCalledWith("stonetop", "vitals.damage", {die: "d8"});
	});
});
