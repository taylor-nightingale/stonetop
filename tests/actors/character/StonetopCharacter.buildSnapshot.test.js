import {describe, expect, it} from "vitest";
import {CharacterSnapshot} from "../../../src/model/snapshot/character/CharacterSnapshot.js";
import {TestCharacterBuilder} from "../../fakes/TestCharacterBuilder.js";
import {FakeActorBuilder} from "../../fakes/FakeActorBuilder.js";

// ── CharacterSnapshot class ───────────────────────────────────────────────────

describe("buildSnapshot — type", () => {
	it("returns a CharacterSnapshot instance", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.build().buildSnapshot();
		expect(snap).toBeInstanceOf(CharacterSnapshot);
	});
});

// ── name ─────────────────────────────────────────────────────────────────────

describe("buildSnapshot — name", () => {
	it("uses actor.name", async () => {
		const actor = new FakeActorBuilder().withName("Jorvik").build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.name).toBe("Jorvik");
	});
});

// ── playbook (null when no playbook) ─────────────────────────────────────────

describe("buildSnapshot — playbook: null when no playbook selected", () => {
	it("playbook is null", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.build().buildSnapshot();
		expect(snap.playbook).toBeNull();
	});
});

// ── rollMode ──────────────────────────────────────────────────────────────────

describe("buildSnapshot — rollMode", () => {
	it("defaults to 'normal' when no flag set", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build()).build().buildSnapshot();
		expect(snap.rollMode).toBe("normal");
	});

	it("reflects stonetop rollMode flag", async () => {
		const actor = new FakeActorBuilder().withRollMode("adv").build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.rollMode).toBe("adv");
	});
});
