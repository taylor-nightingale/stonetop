import { describe, it, expect } from "vitest";
import { CharacterVitals } from "../../../src/actors/character/CharacterVitals.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";

function makeVitals({ hp, armor, level, xp } = {}) {
	let b = new FakeCharacterActorBuilder();
	if (hp    !== undefined) b = b.withHp(hp.value ?? 0, hp.max ?? 0);
	if (armor !== undefined) b = b.withArmor(armor);
	if (level !== undefined) b = b.withLevel(level);
	if (xp    !== undefined) b = b.withXp(xp.value ?? 0, 8);
	return new CharacterVitals(b.build());
}

describe("CharacterVitals.buildVitalsSnapshot", () => {
	it("hp.max comes from actor system hp.max", async () => {
		const vitals = makeVitals({});
		await vitals.setMaxHP(20);
		const snap = await vitals.buildVitalsSnapshot();
		expect(snap.hp.max).toBe(20);
	});

	it("hp.value comes from actor attrs.hp.value", async () => {
		const snap = await makeVitals({ hp: { value: 12 } }).buildVitalsSnapshot();
		expect(snap.hp.value).toBe(12);
	});

	it("hp.max defaults to 0 when not set on actor", async () => {
		const snap = await makeVitals({ hp: { value: 5 } }).buildVitalsSnapshot();
		expect(snap.hp.max).toBe(0);
	});

	it("damage comes from actor system damage.value", async () => {
		const vitals = makeVitals({});
		await vitals.setDamage("d6");
		const snap = await vitals.buildVitalsSnapshot();
		expect(snap.damage).toEqual({ value: "d6" });
	});

	it("damage is null when not set", async () => {
		const snap = await makeVitals().buildVitalsSnapshot();
		expect(snap.damage).toBeNull();
	});

	it("armor comes from actor attrs.armor", async () => {
		const snap = await makeVitals({ armor: 3 }).buildVitalsSnapshot();
		expect(snap.armor).toBe(3);
	});

	it("armor defaults to 0 when not in attrs", async () => {
		const snap = await makeVitals().buildVitalsSnapshot();
		expect(snap.armor).toBe(0);
	});

	it("level comes from actor attrs.level", async () => {
		const snap = await makeVitals({ level: 4 }).buildVitalsSnapshot();
		expect(snap.level).toBe(4);
	});

	it("level defaults to 1 when missing", async () => {
		const snap = await makeVitals().buildVitalsSnapshot();
		expect(snap.level).toBe(1);
	});

	it("xp.max = 6 + level * 2", async () => {
		const snap = await makeVitals({ level: 4 }).buildVitalsSnapshot();
		expect(snap.xp.max).toBe(14);
	});

	it("xp.value comes from actor attrs.xp.value", async () => {
		const snap = await makeVitals({ xp: { value: 5 } }).buildVitalsSnapshot();
		expect(snap.xp.value).toBe(5);
	});

	it("defaults gracefully when actor.system.attributes is absent", async () => {
		const actor = new FakeCharacterActorBuilder().build();
		actor.system.attributes = undefined;
		const snap = await new CharacterVitals(actor).buildVitalsSnapshot();
		expect(snap.hp).toMatchObject({ value: 0, max: 0 });
		expect(snap.level).toBe(1);
		expect(snap.xp.max).toBe(8);
	});

	it("hp and damage are zero/null when nothing is set", async () => {
		const snap = await makeVitals({ hp: { value: 0 } }).buildVitalsSnapshot();
		expect(snap.hp).toMatchObject({ value: 0, max: 0 });
		expect(snap.damage).toBeNull();
	});
});

describe("CharacterVitals setters", () => {
	it("setHP stores the value and reflects in snapshot", async () => {
		const vitals = makeVitals();
		await vitals.setHP(14);
		expect((await vitals.buildVitalsSnapshot()).hp.value).toBe(14);
	});

	it("setHP clamps negative values to 0", async () => {
		const vitals = makeVitals();
		await vitals.setHP(-3);
		expect((await vitals.buildVitalsSnapshot()).hp.value).toBe(0);
	});

	it("setXP stores the value and reflects in snapshot", async () => {
		const vitals = makeVitals();
		await vitals.setXP(5);
		expect((await vitals.buildVitalsSnapshot()).xp.value).toBe(5);
	});

	it("setXP with 0 stores 0", async () => {
		const vitals = makeVitals({ xp: { value: 3 } });
		await vitals.setXP(0);
		expect((await vitals.buildVitalsSnapshot()).xp.value).toBe(0);
	});

	it("setXP clamps negative values to 0", async () => {
		const vitals = makeVitals();
		await vitals.setXP(-1);
		expect((await vitals.buildVitalsSnapshot()).xp.value).toBe(0);
	});

	it("setLevel stores the value and reflects in snapshot", async () => {
		const vitals = makeVitals();
		await vitals.setLevel(3);
		expect((await vitals.buildVitalsSnapshot()).level).toBe(3);
	});

	it("setLevel clamps values below 1 to 1", async () => {
		const vitals = makeVitals();
		await vitals.setLevel(0);
		expect((await vitals.buildVitalsSnapshot()).level).toBe(1);
	});

	it("setMaxHP stores value and reflects in hp.max", async () => {
		const vitals = makeVitals();
		await vitals.setMaxHP(20);
		expect((await vitals.buildVitalsSnapshot()).hp.max).toBe(20);
	});

	it("setArmor stores value and reflects in snapshot", async () => {
		const vitals = makeVitals();
		await vitals.setArmor(2);
		expect((await vitals.buildVitalsSnapshot()).armor).toBe(2);
	});

	it("setArmor clamps negative to 0", async () => {
		const vitals = makeVitals();
		await vitals.setArmor(-1);
		expect((await vitals.buildVitalsSnapshot()).armor).toBe(0);
	});

	it("setDamage stores value and reflects in snapshot", async () => {
		const vitals = makeVitals();
		await vitals.setDamage("d8");
		expect((await vitals.buildVitalsSnapshot()).damage).toEqual({ value: "d8" });
	});

	it("setDamage with empty string stores null", async () => {
		const vitals = makeVitals();
		await vitals.setDamage("d8");
		await vitals.setDamage("");
		expect((await vitals.buildVitalsSnapshot()).damage).toBeNull();
	});

	it("setters accept string values from inputs and coerce correctly", async () => {
		const vitals = makeVitals();
		await vitals.setHP("7");
		await vitals.setXP("3");
		await vitals.setLevel("2");
		await vitals.setMaxHP("18");
		await vitals.setArmor("1");
		const snap = await vitals.buildVitalsSnapshot();
		expect(snap.hp.value).toBe(7);
		expect(snap.xp.value).toBe(3);
		expect(snap.level).toBe(2);
		expect(snap.hp.max).toBe(18);
		expect(snap.armor).toBe(1);
	});
});

describe("CharacterVitals.updateVitalsFromPlaybook", () => {
	it("sets max HP and initial HP from playbook", async () => {
		const vitals = makeVitals();
		await vitals.updateVitalsFromPlaybook({ hp: 16, damage: null });
		const snap = await vitals.buildVitalsSnapshot();
		expect(snap.hp.max).toBe(16);
		expect(snap.hp.value).toBe(16);
	});

	it("sets damage from playbook", async () => {
		const vitals = makeVitals();
		await vitals.updateVitalsFromPlaybook({ hp: 16, damage: { value: "d10" } });
		expect((await vitals.buildVitalsSnapshot()).damage).toEqual({ value: "d10" });
	});

	it("sets null damage when playbook has no damage", async () => {
		const vitals = makeVitals();
		await vitals.updateVitalsFromPlaybook({ hp: 16, damage: null });
		expect((await vitals.buildVitalsSnapshot()).damage).toBeNull();
	});
});

describe("CharacterVitals.markXp", () => {
	it("adds one tick to the track", async () => {
		const vitals = makeVitals({ xp: { value: 2 }, level: 1 });
		expect(await vitals.markXp()).toBe(true);
		const snap = await vitals.buildVitalsSnapshot();
		expect(snap.xp.value).toBe(3);
	});

	it("reports false and stays put when the track is full (6 + level × 2)", async () => {
		const vitals = makeVitals({ xp: { value: 8 }, level: 1 });
		expect(await vitals.markXp()).toBe(false);
		const snap = await vitals.buildVitalsSnapshot();
		expect(snap.xp.value).toBe(8);
	});

	it("uses the level-scaled cap", async () => {
		const vitals = makeVitals({ xp: { value: 8 }, level: 2 }); // cap 10
		expect(await vitals.markXp()).toBe(true);
	});
});
