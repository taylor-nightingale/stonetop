import {describe, expect, it} from "vitest";
import {CharacterSnapshot, PossessionsSnapshot} from "../../../src/model/snapshot/character/CharacterSnapshot.js";
import {TestCharacterBuilder} from "../../fakes/TestCharacterBuilder.js";
import {FakeCharacterActorBuilder} from "../../fakes/FakeCharacterActorBuilder.js";
import {FakePossessionRepository} from "../../fakes/FakePossessionRepository.js";
import {TestPossessionBuilder} from "../../fakes/TestPossessionBuilder.js";
import {FakeInventoryRepository} from "../../fakes/FakeInventoryRepository.js";
import {OutfitItemBuilder} from "../../../src/model/data/character/OutfitItem.js";

// ── CharacterSnapshot class ───────────────────────────────────────────────────

describe("buildSnapshot — type", () => {
	it("returns a CharacterSnapshot instance", async () => {
		const snap = await new TestCharacterBuilder(new FakeCharacterActorBuilder().build())
			.build().buildSnapshot();
		expect(snap).toBeInstanceOf(CharacterSnapshot);
	});
});

// ── name ─────────────────────────────────────────────────────────────────────

describe("buildSnapshot — name", () => {
	it("uses actor.name", async () => {
		const actor = new FakeCharacterActorBuilder().withName("Jorvik").build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.name).toBe("Jorvik");
	});
});

// ── playbook (null when no playbook) ─────────────────────────────────────────

describe("buildSnapshot — playbook: null when no playbook selected", () => {
	it("playbook is null", async () => {
		const snap = await new TestCharacterBuilder(new FakeCharacterActorBuilder().build())
			.build().buildSnapshot();
		expect(snap.playbook).toBeNull();
	});
});

// ── rollMode ──────────────────────────────────────────────────────────────────

describe("buildSnapshot — rollMode", () => {
	it("defaults to 'normal' when no flag set", async () => {
		const snap = await new TestCharacterBuilder(new FakeCharacterActorBuilder().build()).build().buildSnapshot();
		expect(snap.rollMode).toBe("normal");
	});

	it("reflects stonetop rollMode flag", async () => {
		const actor = new FakeCharacterActorBuilder().withRollMode("adv").build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.rollMode).toBe("adv");
	});
});

// ── vitals sources ────────────────────────────────────────────────────────────

// End-to-end: the character has to hand its playbook item and its checked gear to the vitals
// snapshot, or the provenance tooltips describe an empty character no matter what's on the sheet.
describe("buildSnapshot — vitals.sources", () => {
	const playbookItem = {
		_id: "pb", type: "playbook", name: "The Blessed",
		system: { slug: "the-blessed", hp: 18, damage: { value: "d6" } },
	};

	function armorItem(slug, name, armor) {
		return new OutfitItemBuilder()
			.withSlug(slug).withName(name).withWeight(1)
			.withInventoryColumn("regular").withArmor(armor).build();
	}

	function makeCharacter({ hp = 18, die = "d6", items = [] } = {}) {
		const actor = new FakeCharacterActorBuilder()
			.withItems([playbookItem])
			.withPlaybook("the-blessed")
			.withHp(hp, hp)
			.withDamage(die)
			.build();
		return new TestCharacterBuilder(actor)
			.withInventoryRepo(new FakeInventoryRepository(items))
			.build();
	}

	it("credits the playbook item on the actor for max HP and damage", async () => {
		const snap = await makeCharacter().buildSnapshot();
		expect(snap.vitals.sources.hp).toBe("Max HP 18 comes from your playbook, The Blessed.");
		expect(snap.vitals.sources.damage).toContain("Damage die d6 comes from your playbook, The Blessed.");
	});

	it("flags a max HP that no longer matches the playbook as hand-set", async () => {
		const snap = await makeCharacter({ hp: 22 }).buildSnapshot();
		expect(snap.vitals.sources.hp).toBe("Manually set to 22. Your playbook, The Blessed, grants 18.");
	});

	it("names the checked gear behind Armor", async () => {
		const character = makeCharacter({ items: [
			armorItem("chain-mail", "Chain mail", { base: 2 }),
			armorItem("shield", "Shield", { modifier: 1 }),
		] });
		await character.setInventoryItemChecked("chain-mail", true);
		await character.setInventoryItemChecked("shield", true);

		const snap = await character.buildSnapshot();
		expect(snap.vitals.armor).toBe(3);
		expect(snap.vitals.sources.armor)
			.toBe("Armor 3 from your checked gear: Chain mail 2 (base), Shield +1. Only the highest base counts, plus every modifier.");
	});

	it("reports Armor typed over the gear's total as hand-set", async () => {
		const character = makeCharacter({ items: [armorItem("chain-mail", "Chain mail", { base: 2 })] });
		await character.setInventoryItemChecked("chain-mail", true);
		await character.setArmor(4);

		const snap = await character.buildSnapshot();
		expect(snap.vitals.sources.armor)
			.toBe("Manually set to 4. Your checked gear adds up to 2: Chain mail 2 (base).");
	});
});

// ── possessions ───────────────────────────────────────────────────────────────

describe("buildSnapshot — possessions: null when no playbook", () => {
	it("possessions is null", async () => {
		const snap = await new TestCharacterBuilder(new FakeCharacterActorBuilder().build())
			.build().buildSnapshot();
		expect(snap.possessions).toBeNull();
	});
});

describe("buildSnapshot — possessions: snapshot when playbook configured", () => {
	it("possessions is a PossessionsSnapshot with items from actor.items", async () => {
		const sp = { pickCount: 1, pickNote: "Pick 1", preselected: [], slugs: ["apiary"] };
		const actor = new FakeCharacterActorBuilder().withItems([
			{ _id: "pb", type: "playbook", name: "The Blessed", system: { slug: "blessed", specialPossessions: sp } },
			{ _id: "ap", type: "possession", name: "Apiary",
				system: { slug: "apiary", description: "", resource: null, outfitItems: [],
					choices: null, scaling: null, sortOrder: null, selected: false, preselected: false,
					uses: 0, pickValues: {}, choiceUses: {}, playbookSlug: "blessed" } },
		]).withPlaybook("blessed").build();
		const snap = await new TestCharacterBuilder(actor).build().buildSnapshot();
		expect(snap.possessions).toBeInstanceOf(PossessionsSnapshot);
		expect(snap.possessions.items).toHaveLength(1);
		expect(snap.possessions.items[0].slug).toBe("apiary");
	});
});

// ── outfit: what a taken move does to the gear ───────────────────────────────

// End-to-end through the real subsystems: the character has to hand what its TAKEN moves say about
// gear (CharacterMoves.outfitEffects) to the inventory, or the Armored move a Heavy took stays
// prose and their shield goes on costing ◇◇. Only Foundry is faked.
describe("buildSnapshot — outfit: gear a taken move changes", () => {
	const ARMORED = [
		{ slug: "shield", weight: 1 },
		{ slug: "hauberk", removeTags: ["cumbersome"] },
	];

	function armoredItem({ acquired = true } = {}) {
		return {
			_id: "mv-armored", type: "move", name: "Armored",
			system: { slug: "armored", acquired, categoryKey: "playbook-the-heavy", outfitEffects: ARMORED },
		};
	}

	const gear = () => new FakeInventoryRepository([
		new OutfitItemBuilder().withSlug("shield").withName("Shield").withWeight(2)
			.withInventoryColumn("regular").withArmor({ modifier: 1 }).build(),
		new OutfitItemBuilder().withSlug("hauberk").withName("Hauberk").withWeight(2)
			.withInventoryColumn("regular").withTags(["warm", "cumbersome"]).build(),
	]);

	function makeCharacter(items) {
		const actor = new FakeCharacterActorBuilder().withItems(items).build();
		return new TestCharacterBuilder(actor).withInventoryRepo(gear()).build();
	}

	const rowFor = (snap, slug) =>
		snap.outfit.regularSections.flatMap(s => s.runs.flatMap(r => r.items)).find(i => i.slug === slug);

	it("marks one ◇ for the shield of a character who took Armored", async () => {
		const snap = await makeCharacter([armoredItem()]).buildSnapshot();
		expect(rowFor(snap, "shield").weight).toBe(1);
	});

	it("marks the printed ◇◇ when the move is only offered, not taken", async () => {
		const snap = await makeCharacter([armoredItem({ acquired: false })]).buildSnapshot();
		expect(rowFor(snap, "shield").weight).toBe(2);
	});

	it("counts the lighter shield toward the load band", async () => {
		const character = makeCharacter([armoredItem()]);
		await character.setInventoryItemChecked("shield", true);
		const snap = await character.buildSnapshot();
		expect(snap.outfit.load.markedWeight).toBe(1);
	});

	it("stops cumbersome applying to the armor worn", async () => {
		const snap = await makeCharacter([armoredItem()]).buildSnapshot();
		expect(rowFor(snap, "hauberk").tags.map(t => t.label)).toEqual(["warm"]);
	});

	it("leaves the shield's +1 Armor exactly as it was", async () => {
		const character = makeCharacter([armoredItem()]);
		await character.setInventoryItemChecked("shield", true);
		const snap = await character.buildSnapshot();
		expect(snap.vitals.armor).toBe(1);
	});
});

