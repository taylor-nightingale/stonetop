import { describe, it, expect, vi } from "vitest";
import { CharacterWounds } from "../../../src/actors/character/CharacterWounds.js";
import { Wound } from "../../../src/model/data/character/Wound.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";

const STORED = [
	{ id: "w1", name: "broken arm", state: "stabilized" },
	{ id: "w2", name: "bad knee", state: "permanent" },
];

const setup = (wounds = STORED) => {
	const actor = new FakeCharacterActorBuilder().withWounds(wounds).build();
	return { actor, wounds: new CharacterWounds(actor) };
};

const stored = actor => actor.system.wounds;

describe("CharacterWounds", () => {
	it("lists the wounds in the order they were written", () => {
		const { wounds } = setup();
		expect(wounds.all()).toEqual([
			new Wound("w1", "broken arm", "stabilized"),
			new Wound("w2", "bad knee", "permanent"),
		]);
	});

	it("has none on a character that was never hurt", () => {
		const actor = new FakeCharacterActorBuilder().build();
		expect(new CharacterWounds(actor).all()).toEqual([]);
	});

	it("adds an active wound at the end, with an id of its own", async () => {
		const { actor, wounds } = setup();
		const added = await wounds.add("scar");
		expect(stored(actor)).toHaveLength(3);
		expect(stored(actor)[2]).toEqual({ id: added.id, name: "scar", state: "active" });
		expect(added.id).toMatch(/\S/);
		expect(["w1", "w2"]).not.toContain(added.id);
	});

	// The editor's "+ add a wound" gives the reader an empty line to type into.
	it("adds an unnamed wound", async () => {
		const { actor, wounds } = setup([]);
		await wounds.add();
		expect(stored(actor)[0].name).toBe("");
	});

	it("renames one wound", async () => {
		const { actor, wounds } = setup();
		await wounds.rename("w1", "shattered arm");
		expect(stored(actor)).toEqual([
			{ id: "w1", name: "shattered arm", state: "stabilized" },
			{ id: "w2", name: "bad knee", state: "permanent" },
		]);
	});

	it("steps one wound to its next state", async () => {
		const { actor, wounds } = setup();
		await wounds.advanceState("w1");
		expect(stored(actor)[0].state).toBe("permanent");
		expect(stored(actor)[1].state).toBe("permanent");
	});

	it("removes one wound", async () => {
		const { actor, wounds } = setup();
		await wounds.remove("w1");
		expect(stored(actor)).toEqual([{ id: "w2", name: "bad knee", state: "permanent" }]);
	});

	it("writes nothing for an id it does not have", async () => {
		const { actor, wounds } = setup();
		await wounds.rename("nope", "x");
		expect(stored(actor)).toEqual(STORED);
	});

	// Closing the editor on an empty line leaves no wound behind.
	it("removes the wounds nobody named", async () => {
		const { actor, wounds } = setup([...STORED, { id: "w3", name: "", state: "active" }, { id: "w4", name: "  ", state: "active" }]);
		await wounds.removeUnnamed();
		expect(stored(actor)).toEqual(STORED);
	});

	it("writes nothing when every wound is named", async () => {
		const { actor, wounds } = setup();
		const update = vi.spyOn(actor, "update");
		await wounds.removeUnnamed();
		expect(update).not.toHaveBeenCalled();
	});

	// A name is saved as its field is left, and leaving it is the same click that shuts the editor —
	// so the tidy-up must wait for the name to land, or it reads the line as still empty and drops it.
	it("waits for a write in flight before tidying up", async () => {
		const { actor, wounds } = setup([{ id: "w1", name: "", state: "active" }]);
		// The server applies writes in the order they were sent, and answers the first one late.
		const write = actor.update.bind(actor);
		let release;
		const held = new Promise(resolve => { release = resolve; });
		let server = held;
		vi.spyOn(actor, "update").mockImplementation(data => (server = server.then(() => write(data))));
		const naming = wounds.rename("w1", "broken arm");
		const tidying = wounds.removeUnnamed();
		release();
		await Promise.all([naming, tidying]);
		expect(stored(actor)).toEqual([{ id: "w1", name: "broken arm", state: "active" }]);
	});

	it("carries on after a write that failed", async () => {
		const { actor, wounds } = setup();
		vi.spyOn(actor, "update").mockRejectedValueOnce(new Error("offline"));
		await expect(wounds.remove("w1")).rejects.toThrow("offline");
		await wounds.remove("w2");
		expect(stored(actor)).toEqual([{ id: "w1", name: "broken arm", state: "stabilized" }]);
	});
});
