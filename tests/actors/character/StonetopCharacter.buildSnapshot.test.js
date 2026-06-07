import {describe, expect, it} from "vitest";
import {CharacterSnapshot, PossessionsSnapshot} from "../../../src/model/snapshot/character/CharacterSnapshot.js";
import {TestCharacterBuilder} from "../../fakes/TestCharacterBuilder.js";
import {FakeActorBuilder} from "../../fakes/FakeActorBuilder.js";
import {FakePossessionRepository} from "../../fakes/FakePossessionRepository.js";
import {TestPossessionBuilder} from "../../fakes/TestPossessionBuilder.js";

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

// ── possessions ───────────────────────────────────────────────────────────────

describe("buildSnapshot — possessions: null when no playbook", () => {
	it("possessions is null", async () => {
		const snap = await new TestCharacterBuilder(new FakeActorBuilder().build())
			.build().buildSnapshot();
		expect(snap.possessions).toBeNull();
	});
});

describe("buildSnapshot — possessions: snapshot when playbook configured", () => {
	it("possessions is a PossessionsSnapshot with items from actor.items", async () => {
		const sp = { pickCount: 1, pickNote: "Pick 1", preselected: [], slugs: ["apiary"] };
		const actor = new FakeActorBuilder().withItems([
			{ _id: "pb", type: "playbook", name: "The Blessed", system: { slug: "blessed", specialPossessions: sp } },
			{ _id: "ap", type: "possession", name: "Apiary",
				system: { slug: "apiary", label: "Apiary", description: "", resource: null, outfitItems: [],
					choices: null, scaling: null, sortOrder: null, selected: false, preselected: false,
					uses: 0, pickValues: {}, choiceUses: {}, playbookSlug: "blessed" } },
		]).withPlaybook("blessed").build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.possessions).toBeInstanceOf(PossessionsSnapshot);
		expect(snap.possessions.items).toHaveLength(1);
		expect(snap.possessions.items[0].slug).toBe("apiary");
	});
});
