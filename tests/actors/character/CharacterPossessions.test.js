import { describe, it, expect } from "vitest";
import { CharacterPossessions } from "../../../src/actors/character/CharacterPossessions.js";
import { PossessionsSnapshot } from "../../../src/model/snapshot/character/CharacterSnapshot.js";
import { FakeMoves } from "../../fakes/FakeMoves.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { FakeOutfitItems } from "../../fakes/FakeOutfitItems.js";
import { FakePossessionRepository } from "../../fakes/FakePossessionRepository.js";
import { TestPossessionBuilder } from "../../fakes/TestPossessionBuilder.js";
import { TestChoiceGroupBuilder } from "../../fakes/TestChoiceGroupBuilder.js";
import { TestChoiceRowBuilder } from "../../fakes/TestChoiceRowBuilder.js";

// -- Helpers ------------------------------------------------------------------

function makeActor(items = []) {
	return new FakeActorBuilder().withItems(items).build();
}

function makeMoves()       { return new FakeMoves(); }
function makeOutfitItems() { return new FakeOutfitItems(); }

function makePossessionItem(p, opts = {}) {
	return {
		_id:    p.slug + "-item",
		type:   "possession",
		name:   p.label ?? p.slug,
		system: {
			slug:         p.slug,
			label:        p.label        ?? "",
			description:  p.description  ?? "",
			resource:     p.resource     ?? null,
			outfitItems:  p.outfitItems  ?? [],
			choices:      p.choices      ?? null,
			scaling:      p.scaling      ?? null,
			sortOrder:    p.sortOrder    ?? null,
			selected:     opts.selected     ?? false,
			preselected:  opts.preselected  ?? false,
			uses:         opts.uses         ?? 0,
			pickValues:   opts.pickValues   ?? {},
			choiceUses:   opts.choiceUses   ?? {},
			playbookSlug: opts.playbookSlug ?? null,
		},
	};
}

function makePlaybookItem(sp) {
	return {
		_id:    "playbook-item",
		type:   "playbook",
		name:   "Test Playbook",
		system: { slug: "test-playbook", specialPossessions: sp ?? null },
	};
}

// -- Test data ─────────────────────────────────────────────────────────────────

function bonusPossession() {
	return new TestPossessionBuilder()
		.withSlug("sacred-pouch").withResource(3)
		.withScaling(1).withMoveBonus("big-magic", 2)
		.build();
}

function basePossessions() {
	return [
		new TestPossessionBuilder().withSlug("sacred-pouch").withLabel("Sacred Pouch").withDescription("magic").withResource(3).build(),
		new TestPossessionBuilder().withSlug("apiary").withLabel("Apiary").withDescription("bees").build(),
		new TestPossessionBuilder().withSlug("mastiffs").withLabel("Mastiffs").withDescription("dogs").build(),
	];
}

function baseSp() {
	return { pickNote: "Pick 2", pickCount: 2, preselected: ["sacred-pouch"], slugs: ["sacred-pouch", "apiary", "mastiffs"] };
}

function outfitPossessions() {
	return [
		new TestPossessionBuilder()
			.withSlug("smithy").withLabel("Smithy")
			.withOutfitItems(
				{ slug: "smithy-tongs",   name: "Tongs",   weight: 1, inventoryColumn: "regular" },
				{ slug: "smithy-bellows", name: "Bellows", weight: 1, inventoryColumn: "regular" },
			).build(),
		new TestPossessionBuilder()
			.withSlug("weapons-of-war").withLabel("Weapons of War")
			.withChoices(new TestChoiceGroupBuilder()
				.withSlug("weapons-of-war")
				.addChoice(TestChoiceRowBuilder.pick().withOptions(
					{ slug: "mace",     outfitItems: [{ slug: "mace",     name: "Mace",     weight: 1, inventoryColumn: "regular" }] },
					{ slug: "crossbow", outfitItems: [{ slug: "crossbow", name: "Crossbow", weight: 1, inventoryColumn: "regular" }] },
				))
				.build())
			.build(),
		new TestPossessionBuilder().withSlug("apiary").withLabel("Apiary").build(),
	];
}

function choicesPossessions() {
	return [
		new TestPossessionBuilder()
			.withSlug("weapons-of-war").withLabel("Weapons of War").withDescription("War stuff")
			.withChoices(new TestChoiceGroupBuilder()
				.withSlug("weapons-of-war")
				.addChoice(TestChoiceRowBuilder.heading().withContentTitle("Choose your weapon").withNote("pick 1"))
				.addChoice(TestChoiceRowBuilder.pick().withOptions(
					{ slug: "sword", label: "◇ Sword" },
					{ slug: "axe",   label: "◇ Axe" },
				))
				.addChoice(TestChoiceRowBuilder.pick().withPickCount(2).withOptions(
					{ slug: "shield",  label: "Shield" },
					{ slug: "quiver",  label: "Quiver" },
					{ slug: "hauberk", label: "Hauberk" },
				))
				.build())
			.build(),
		new TestPossessionBuilder().withSlug("apiary").withLabel("Apiary").withDescription("Bees").build(),
	];
}

function choicesSp() {
	return { pickCount: 1, pickNote: "Pick 1", preselected: [], slugs: ["weapons-of-war", "apiary"] };
}

// -- selection ─────────────────────────────────────────────────────────────────

describe("CharacterPossessions — selection", () => {
	it("selected is empty before any mutation", () => {
		const cp = new CharacterPossessions(makeActor(), makeMoves());
		expect(cp.selected.size).toBe(0);
	});

	it("select marks item as selected", async () => {
		const actor = makeActor([makePossessionItem(basePossessions()[1])]);
		const cp = new CharacterPossessions(actor, makeMoves());
		await cp.select("apiary");
		expect(cp.selected.has("apiary")).toBe(true);
	});

	it("deselect removes slug from selected", async () => {
		const [pouch, apiary, mastiffs] = basePossessions();
		const actor = makeActor([
			makePossessionItem(apiary,    { selected: true }),
			makePossessionItem(mastiffs,  { selected: true }),
		]);
		const cp = new CharacterPossessions(actor, makeMoves());
		await cp.deselect("apiary");
		expect(cp.selected.has("apiary")).toBe(false);
		expect(cp.selected.has("mastiffs")).toBe(true);
	});
});

// -- resource tracking ─────────────────────────────────────────────────────────

describe("CharacterPossessions — resource tracking", () => {
	it("setUses is reflected in buildSnapshot resource.current", async () => {
		const [pouch] = basePossessions();
		const actor = makeActor([
			makePlaybookItem(baseSp()),
			makePossessionItem(pouch, { selected: true, preselected: true, playbookSlug: "test-playbook" }),
		]);
		const cp = new CharacterPossessions(actor, makeMoves());
		await cp.setUses("sacred-pouch", 2);
		const snap = await cp.buildSnapshot(1);
		expect(snap.items.find(i => i.slug === "sacred-pouch").resource.current).toBe(2);
	});

	it("setChoiceUses stores count under choiceSlug key on the item", async () => {
		const [, apiary] = basePossessions();
		const actor = makeActor([makePossessionItem(apiary)]);
		const cp = new CharacterPossessions(actor, makeMoves());
		await cp.setChoiceUses("apiary", "crossbow", 1);
		const item = [...actor.items].find(i => i.system?.slug === "apiary");
		expect(item.system.choiceUses["crossbow"]).toBe(1);
	});

	it("setChoiceUses merges with existing choiceUses", async () => {
		const [, apiary] = basePossessions();
		const actor = makeActor([makePossessionItem(apiary)]);
		const cp = new CharacterPossessions(actor, makeMoves());
		await cp.setChoiceUses("apiary", "sword", 0);
		await cp.setChoiceUses("apiary", "crossbow", 2);
		const item = [...actor.items].find(i => i.system?.slug === "apiary");
		expect(item.system.choiceUses["sword"]).toBe(0);
		expect(item.system.choiceUses["crossbow"]).toBe(2);
	});
});

// -- sub-choices ───────────────────────────────────────────────────────────────

describe("CharacterPossessions — sub-choices", () => {
	function makeCpWithChoices() {
		const [wow, apiary] = choicesPossessions();
		const actor = makeActor([
			makePlaybookItem(choicesSp()),
			makePossessionItem(wow,    { selected: true,  playbookSlug: "test-playbook" }),
			makePossessionItem(apiary, { selected: false, playbookSlug: "test-playbook" }),
		]);
		return new CharacterPossessions(actor, makeMoves());
	}

	async function wowChoices(cp) {
		const snap = await cp.buildSnapshot(1);
		return snap.items.find(i => i.slug === "weapons-of-war").choices;
	}

	it("addSubChoice marks the option checked in the snapshot", async () => {
		const cp = makeCpWithChoices();
		await cp.addSubChoice("weapons-of-war", "sword");
		const row = (await wowChoices(cp)).list[1];
		expect(row.options.find(o => o.slug === "sword").checked).toBe(true);
	});

	it("addSubChoice is idempotent — calling twice keeps the option checked", async () => {
		const cp = makeCpWithChoices();
		await cp.addSubChoice("weapons-of-war", "sword");
		await cp.addSubChoice("weapons-of-war", "sword");
		const row = (await wowChoices(cp)).list[1];
		expect(row.options.find(o => o.slug === "sword").checked).toBe(true);
	});

	it("addSubChoice merges with existing selections across rows", async () => {
		const cp = makeCpWithChoices();
		await cp.addSubChoice("weapons-of-war", "sword");
		await cp.addSubChoice("weapons-of-war", "shield");
		const choices = await wowChoices(cp);
		expect(choices.list[1].options.find(o => o.slug === "sword").checked).toBe(true);
		expect(choices.list[2].options.find(o => o.slug === "shield").checked).toBe(true);
	});

	it("removeSubChoice clears the option", async () => {
		const cp = makeCpWithChoices();
		await cp.addSubChoice("weapons-of-war", "sword");
		await cp.removeSubChoice("weapons-of-war", "sword");
		const row = (await wowChoices(cp)).list[1];
		expect(row.options.find(o => o.slug === "sword").checked).toBe(false);
	});

	it("removeSubChoice is safe when slug was not previously set", async () => {
		const cp = makeCpWithChoices();
		await cp.addSubChoice("weapons-of-war", "sword");
		await cp.removeSubChoice("weapons-of-war", "axe");
		const row = (await wowChoices(cp)).list[1];
		expect(row.options.find(o => o.slug === "sword").checked).toBe(true);
		expect(row.options.find(o => o.slug === "axe").checked).toBe(false);
	});

	it("selectExclusive selects the target and clears all siblings", async () => {
		const cp = makeCpWithChoices();
		await cp.addSubChoice("weapons-of-war", "sword");
		await cp.selectExclusive("weapons-of-war", "axe", ["sword", "axe"]);
		const row = (await wowChoices(cp)).list[1];
		expect(row.options.find(o => o.slug === "axe").checked).toBe(true);
		expect(row.options.find(o => o.slug === "sword").checked).toBe(false);
	});
});

// -- computeMaxUses ────────────────────────────────────────────────────────────

describe("CharacterPossessions — computeMaxUses", () => {
	function makeCp(moves = makeMoves()) {
		return new CharacterPossessions(makeActor(), moves);
	}

	it("no bonus at level 1 with no moves — entry absent", () => {
		expect(makeCp().computeMaxUses([bonusPossession()], 1)["sacred-pouch"]).toBeUndefined();
	});

	it("level 2 adds +1 from even-level bonus", () => {
		expect(makeCp().computeMaxUses([bonusPossession()], 2)["sacred-pouch"]).toBe(4);
	});

	it("level 4 adds +2 from two even levels", () => {
		expect(makeCp().computeMaxUses([bonusPossession()], 4)["sacred-pouch"]).toBe(5);
	});

	it("owning Big Magic once adds +2", () => {
		expect(makeCp(makeMoves().ownMove("big-magic")).computeMaxUses([bonusPossession()], 1)["sacred-pouch"]).toBe(5);
	});

	it("owning Big Magic twice adds +4", () => {
		expect(makeCp(makeMoves().ownMove("big-magic", 2)).computeMaxUses([bonusPossession()], 1)["sacred-pouch"]).toBe(7);
	});

	it("Big Magic once + level 4 gives base 3 + 4", () => {
		expect(makeCp(makeMoves().ownMove("big-magic")).computeMaxUses([bonusPossession()], 4)["sacred-pouch"]).toBe(7);
	});

	it("possession without scaling is not affected", () => {
		const possessions = [new TestPossessionBuilder().withSlug("apiary").build()];
		expect(makeCp().computeMaxUses(possessions, 10)["apiary"]).toBeUndefined();
	});
});

// -- buildSnapshot ─────────────────────────────────────────────────────────────

describe("CharacterPossessions — buildSnapshot", () => {
	function makeCp(extra = []) {
		const [pouch, apiary, mastiffs] = basePossessions();
		const actor = makeActor([
			makePlaybookItem(baseSp()),
			makePossessionItem(pouch,    { preselected: true, selected: true, playbookSlug: "test-playbook" }),
			makePossessionItem(apiary,   { playbookSlug: "test-playbook" }),
			makePossessionItem(mastiffs, { playbookSlug: "test-playbook" }),
			...extra,
		]);
		return new CharacterPossessions(actor, makeMoves());
	}

	it("returns null when no playbook item in actor.items", async () => {
		const cp = new CharacterPossessions(makeActor(), makeMoves());
		expect(await cp.buildSnapshot(1)).toBeNull();
	});

	it("returns null when playbook item has no specialPossessions", async () => {
		const actor = makeActor([makePlaybookItem(null)]);
		const cp = new CharacterPossessions(actor, makeMoves());
		expect(await cp.buildSnapshot(1)).toBeNull();
	});

	it("returns a PossessionsSnapshot", async () => {
		expect(await makeCp().buildSnapshot(1)).toBeInstanceOf(PossessionsSnapshot);
	});

	it("passes pickCount and pickNote through", async () => {
		const snap = await makeCp().buildSnapshot(1);
		expect(snap.pickCount).toBe(2);
		expect(snap.pickNote).toBe("Pick 2");
	});

	it("all options appear in items", async () => {
		const snap = await makeCp().buildSnapshot(1);
		expect(snap.items).toHaveLength(3);
	});

	it("preselected item is selected, disabled, and marked preselected", async () => {
		const snap = await makeCp().buildSnapshot(1);
		const pouch = snap.items.find(i => i.slug === "sacred-pouch");
		expect(pouch.selected).toBe(true);
		expect(pouch.checked).toBe(true);
		expect(pouch.disabled).toBe(true);
		expect(pouch.preselected).toBe(true);
		expect(pouch.preselectedSource).toBe("Starting");
	});

	it("non-preselected, non-selected item is unselected and not disabled", async () => {
		const snap = await makeCp().buildSnapshot(1);
		const apiary = snap.items.find(i => i.slug === "apiary");
		expect(apiary.selected).toBe(false);
		expect(apiary.disabled).toBe(false);
	});

	it("user-selected item is selected and not disabled", async () => {
		const [, apiary, mastiffs] = basePossessions();
		const actor = makeActor([
			makePlaybookItem(baseSp()),
			makePossessionItem(basePossessions()[0], { preselected: true, selected: true, playbookSlug: "test-playbook" }),
			makePossessionItem(apiary,   { selected: true,  playbookSlug: "test-playbook" }),
			makePossessionItem(mastiffs, { selected: false, playbookSlug: "test-playbook" }),
		]);
		const cp = new CharacterPossessions(actor, makeMoves());
		const snap = await cp.buildSnapshot(1);
		const a = snap.items.find(i => i.slug === "apiary");
		expect(a.selected).toBe(true);
		expect(a.disabled).toBe(false);
	});

	it("resource uses current count from setUses", async () => {
		const cp = makeCp();
		await cp.setUses("sacred-pouch", 2);
		const snap = await cp.buildSnapshot(1);
		const pouch = snap.items.find(i => i.slug === "sacred-pouch");
		expect(pouch.resource.current).toBe(2);
		expect(pouch.resource.max).toBe(3);
	});

	it("item without a resource definition has null resource", async () => {
		const snap = await makeCp().buildSnapshot(1);
		expect(snap.items.find(i => i.slug === "apiary").resource).toBeNull();
	});

	it("level-based uses bonus is applied to resource max", async () => {
		const scalingPouch = new TestPossessionBuilder()
			.withSlug("sacred-pouch").withLabel("Sacred Pouch").withResource(3).withScaling(1)
			.build();
		const sp = { pickCount: 1, preselected: ["sacred-pouch"], pickNote: "Pick 1", slugs: ["sacred-pouch"] };
		const actor = makeActor([
			makePlaybookItem(sp),
			makePossessionItem(scalingPouch, { preselected: true, selected: true, playbookSlug: "test-playbook" }),
		]);
		const cp = new CharacterPossessions(actor, makeMoves());
		const snap = await cp.buildSnapshot(4);
		expect(snap.items.find(i => i.slug === "sacred-pouch").resource.max).toBe(5);
	});
});

// -- buildSnapshot — choices ───────────────────────────────────────────────────

describe("CharacterPossessions — buildSnapshot — choices", () => {
	function makeCp() {
		const [wow, apiary] = choicesPossessions();
		const actor = makeActor([
			makePlaybookItem(choicesSp()),
			makePossessionItem(wow,    { playbookSlug: "test-playbook" }),
			makePossessionItem(apiary, { playbookSlug: "test-playbook" }),
		]);
		return new CharacterPossessions(actor, makeMoves());
	}

	it("choices is null when possession has no choices key", async () => {
		const cp = makeCp();
		await cp.select("apiary");
		const snap = await cp.buildSnapshot(1);
		expect(snap.items.find(i => i.slug === "apiary").choices).toBeNull();
	});

	it("choices is null when possession is not selected", async () => {
		const snap = await makeCp().buildSnapshot(1);
		expect(snap.items.find(i => i.slug === "weapons-of-war").choices).toBeNull();
	});

	it("choices is non-null when possession is selected", async () => {
		const cp = makeCp();
		await cp.select("weapons-of-war");
		const snap = await cp.buildSnapshot(1);
		expect(snap.items.find(i => i.slug === "weapons-of-war").choices).not.toBeNull();
	});

	it("heading row carries title and note", async () => {
		const cp = makeCp();
		await cp.select("weapons-of-war");
		const snap = await cp.buildSnapshot(1);
		const heading = snap.items.find(i => i.slug === "weapons-of-war").choices.list[0];
		expect(heading.type).toBe("entry");
		expect(heading.content.title).toBe("Choose your weapon");
		expect(heading.note).toBe("pick 1");
	});

	it("pick row with pickCount 1 has radio=true", async () => {
		const cp = makeCp();
		await cp.select("weapons-of-war");
		const snap = await cp.buildSnapshot(1);
		expect(snap.items.find(i => i.slug === "weapons-of-war").choices.list[1].radio).toBe(true);
	});

	it("pick row with pickCount > 1 has radio=false", async () => {
		const cp = makeCp();
		await cp.select("weapons-of-war");
		const snap = await cp.buildSnapshot(1);
		expect(snap.items.find(i => i.slug === "weapons-of-war").choices.list[2].radio).toBe(false);
	});

	it("pick row has rowKey based on possession slug and row index", async () => {
		const cp = makeCp();
		await cp.select("weapons-of-war");
		const snap = await cp.buildSnapshot(1);
		expect(snap.items.find(i => i.slug === "weapons-of-war").choices.list[1].rowKey)
			.toBe("weapons-of-war-row-1");
	});

	it("radio pick row has siblingSlugsCsv listing all option slugs", async () => {
		const cp = makeCp();
		await cp.select("weapons-of-war");
		const snap = await cp.buildSnapshot(1);
		expect(snap.items.find(i => i.slug === "weapons-of-war").choices.list[1].siblingSlugsCsv)
			.toBe("sword,axe");
	});

	it("option is checked when slug is in addSubChoice selections", async () => {
		const cp = makeCp();
		await cp.select("weapons-of-war");
		await cp.addSubChoice("weapons-of-war", "sword");
		const snap = await cp.buildSnapshot(1);
		const row = snap.items.find(i => i.slug === "weapons-of-war").choices.list[1];
		expect(row.options.find(o => o.slug === "sword").checked).toBe(true);
	});

	it("option is unchecked when slug is not in addSubChoice selections", async () => {
		const cp = makeCp();
		await cp.select("weapons-of-war");
		await cp.addSubChoice("weapons-of-war", "sword");
		const snap = await cp.buildSnapshot(1);
		const row = snap.items.find(i => i.slug === "weapons-of-war").choices.list[1];
		expect(row.options.find(o => o.slug === "axe").checked).toBe(false);
	});

	it("all rows appear in correct order", async () => {
		const cp = makeCp();
		await cp.select("weapons-of-war");
		const snap = await cp.buildSnapshot(1);
		const list = snap.items.find(i => i.slug === "weapons-of-war").choices.list;
		expect(list).toHaveLength(3);
		expect(list[0].type).toBe("entry");
		expect(list[1].options).toHaveLength(2);
		expect(list[2].options).toHaveLength(3);
	});
});

// -- syncPossessionItems ───────────────────────────────────────────────────────

describe("CharacterPossessions — syncPossessionItems", () => {
	const [smithy, wow, apiary] = outfitPossessions();

	it("is a no-op when possession item is not in actor.items", async () => {
		const outfitItems = makeOutfitItems();
		const cp = new CharacterPossessions(makeActor(), makeMoves(), outfitItems);
		await cp.syncPossessionItems("smithy");
		expect(outfitItems.hasSource("possession:smithy")).toBe(false);
	});

	it("does not throw when outfitItems is null", async () => {
		const actor = makeActor([makePossessionItem(smithy)]);
		const cp = new CharacterPossessions(actor, makeMoves(), null);
		await expect(cp.syncPossessionItems("smithy")).resolves.not.toThrow();
	});

	it("syncs possession-level outfit items under 'possession:smithy'", async () => {
		const outfitItems = makeOutfitItems();
		const actor = makeActor([makePossessionItem(smithy)]);
		const cp = new CharacterPossessions(actor, makeMoves(), outfitItems);
		await cp.syncPossessionItems("smithy");
		expect(outfitItems.getSlugs("possession:smithy"))
			.toEqual(expect.arrayContaining(["smithy-tongs", "smithy-bellows"]));
	});

	it("syncs choice outfit item when the sub-choice is selected", async () => {
		const outfitItems = makeOutfitItems();
		const actor = makeActor([makePossessionItem(wow)]);
		const cp = new CharacterPossessions(actor, makeMoves(), outfitItems);
		await cp.addSubChoice("weapons-of-war", "mace");
		await cp.syncPossessionItems("weapons-of-war");
		expect(outfitItems.getSlugs("possession:weapons-of-war")).toContain("mace");
	});

	it("does not include choice outfit item when sub-choice is not selected", async () => {
		const outfitItems = makeOutfitItems();
		const actor = makeActor([makePossessionItem(wow)]);
		const cp = new CharacterPossessions(actor, makeMoves(), outfitItems);
		await cp.syncPossessionItems("weapons-of-war");
		expect(outfitItems.getSlugs("possession:weapons-of-war")).toHaveLength(0);
	});

	it("syncs an empty array when possession has no outfit items", async () => {
		const outfitItems = makeOutfitItems();
		const actor = makeActor([makePossessionItem(apiary)]);
		const cp = new CharacterPossessions(actor, makeMoves(), outfitItems);
		await cp.syncPossessionItems("apiary");
		expect(outfitItems.getSlugs("possession:apiary")).toHaveLength(0);
		expect(outfitItems.hasSource("possession:apiary")).toBe(true);
	});
});

// -- outfit item integration ───────────────────────────────────────────────────

describe("CharacterPossessions — outfit item integration", () => {
	const [smithy, wow] = outfitPossessions();

	it("select syncs the possession's outfit items", async () => {
		const outfitItems = makeOutfitItems();
		const actor = makeActor([makePossessionItem(smithy)]);
		const cp = new CharacterPossessions(actor, makeMoves(), outfitItems);
		await cp.select("smithy");
		expect(outfitItems.getSlugs("possession:smithy"))
			.toEqual(expect.arrayContaining(["smithy-tongs", "smithy-bellows"]));
	});

	it("deselect removes the possession's outfit items", async () => {
		const outfitItems = makeOutfitItems();
		const actor = makeActor([makePossessionItem(smithy, { selected: true })]);
		const cp = new CharacterPossessions(actor, makeMoves(), outfitItems);
		await cp.select("smithy");
		await cp.deselect("smithy");
		expect(outfitItems.hasSource("possession:smithy")).toBe(false);
	});

	it("addSubChoice syncs with the newly selected choice item", async () => {
		const outfitItems = makeOutfitItems();
		const actor = makeActor([makePossessionItem(wow)]);
		const cp = new CharacterPossessions(actor, makeMoves(), outfitItems);
		await cp.addSubChoice("weapons-of-war", "mace");
		expect(outfitItems.getSlugs("possession:weapons-of-war")).toContain("mace");
	});

	it("removeSubChoice syncs with the choice item removed", async () => {
		const outfitItems = makeOutfitItems();
		const actor = makeActor([makePossessionItem(wow)]);
		const cp = new CharacterPossessions(actor, makeMoves(), outfitItems);
		await cp.addSubChoice("weapons-of-war", "mace");
		await cp.removeSubChoice("weapons-of-war", "mace");
		expect(outfitItems.getSlugs("possession:weapons-of-war")).not.toContain("mace");
	});
});

// -- buildSnapshot — embedded items ────────────────────────────────────────────

describe("CharacterPossessions — buildSnapshot — embedded items", () => {
	function makeCpWithEmbedded(extraItems = []) {
		const [pouch, apiary, mastiffs] = basePossessions();
		const actor = makeActor([
			makePlaybookItem(baseSp()),
			makePossessionItem(pouch,    { preselected: true, selected: true, playbookSlug: "test-playbook" }),
			makePossessionItem(apiary,   { playbookSlug: "test-playbook" }),
			makePossessionItem(mastiffs, { playbookSlug: "test-playbook" }),
			...extraItems,
		]);
		return new CharacterPossessions(actor, makeMoves());
	}

	function droppedItem(slug, label = slug) {
		return {
			_id: slug + "-dropped", type: "possession",
			name: label,
			system: {
				slug, label, description: "", resource: null,
				outfitItems: [], choices: null, scaling: null, sortOrder: null,
				selected: false, preselected: false, uses: 0,
				pickValues: {}, choiceUses: {}, playbookSlug: null,
			},
		};
	}

	it("drag-dropped possession appears in snapshot items", async () => {
		const cp = makeCpWithEmbedded([droppedItem("smithy")]);
		const snap = await cp.buildSnapshot(1);
		expect(snap.items).toHaveLength(4);
	});

	it("drag-dropped possession is selected, not disabled, not preselected", async () => {
		const cp = makeCpWithEmbedded([droppedItem("smithy", "Smithy")]);
		const snap = await cp.buildSnapshot(1);
		const smithy = snap.items.find(i => i.slug === "smithy");
		expect(smithy.selected).toBe(true);
		expect(smithy.disabled).toBe(false);
		expect(smithy.preselected).toBe(false);
	});

	it("drag-dropped possession appears after playbook possessions", async () => {
		const cp = makeCpWithEmbedded([droppedItem("smithy")]);
		const snap = await cp.buildSnapshot(1);
		expect(snap.items[3].slug).toBe("smithy");
	});

	it("slug collision: playbook entry wins, no duplicate", async () => {
		const cp = makeCpWithEmbedded([droppedItem("apiary")]);
		const snap = await cp.buildSnapshot(1);
		expect(snap.items).toHaveLength(3);
	});
});

// -- addPossessionsFromPlaybook ────────────────────────────────────────────────

describe("CharacterPossessions — addPossessionsFromPlaybook", () => {
	it("embeds all possessions from the playbook slugs", async () => {
		const actor = makeActor();
		const cp = new CharacterPossessions(actor, makeMoves(), null, new FakePossessionRepository(basePossessions()));
		await cp.addPossessionsFromPlaybook(baseSp(), "the-blessed");
		const embedded = [...actor.items].filter(i => i.type === "possession");
		expect(embedded.map(i => i.system.slug)).toEqual(expect.arrayContaining(["sacred-pouch", "apiary", "mastiffs"]));
	});

	it("marks preselected possessions as selected and preselected", async () => {
		const actor = makeActor();
		const cp = new CharacterPossessions(actor, makeMoves(), null, new FakePossessionRepository(basePossessions()));
		await cp.addPossessionsFromPlaybook(baseSp(), "the-blessed");
		const pouch = [...actor.items].find(i => i.system?.slug === "sacred-pouch");
		expect(pouch.system.selected).toBe(true);
		expect(pouch.system.preselected).toBe(true);
	});

	it("non-preselected possessions are not selected", async () => {
		const actor = makeActor();
		const cp = new CharacterPossessions(actor, makeMoves(), null, new FakePossessionRepository(basePossessions()));
		await cp.addPossessionsFromPlaybook(baseSp(), "the-blessed");
		const apiary = [...actor.items].find(i => i.system?.slug === "apiary");
		expect(apiary.system.selected).toBe(false);
	});

	it("sets playbookSlug on all embedded possessions", async () => {
		const actor = makeActor();
		const cp = new CharacterPossessions(actor, makeMoves(), null, new FakePossessionRepository(basePossessions()));
		await cp.addPossessionsFromPlaybook(baseSp(), "the-blessed");
		const slugs = [...actor.items].filter(i => i.type === "possession").map(i => i.system.playbookSlug);
		expect(slugs.every(s => s === "the-blessed")).toBe(true);
	});

	it("skips a slug that is already in actor.items (drag-dropped)", async () => {
		const [, apiary] = basePossessions();
		const actor = makeActor([makePossessionItem(apiary, { playbookSlug: null })]);
		const cp = new CharacterPossessions(actor, makeMoves(), null, new FakePossessionRepository(basePossessions()));
		await cp.addPossessionsFromPlaybook(baseSp(), "the-blessed");
		const apiaryItems = [...actor.items].filter(i => i.system?.slug === "apiary");
		expect(apiaryItems).toHaveLength(1);
	});

	it("is a no-op when sp is null", async () => {
		const actor = makeActor();
		const cp = new CharacterPossessions(actor, makeMoves(), null, new FakePossessionRepository(basePossessions()));
		await cp.addPossessionsFromPlaybook(null, "the-blessed");
		expect([...actor.items].filter(i => i.type === "possession")).toHaveLength(0);
	});

	it("is a no-op when possessionRepo is null", async () => {
		const actor = makeActor();
		const cp = new CharacterPossessions(actor, makeMoves(), null, null);
		await cp.addPossessionsFromPlaybook(baseSp(), "the-blessed");
		expect([...actor.items].filter(i => i.type === "possession")).toHaveLength(0);
	});
});

// -- removePossessionsFromPlaybook ─────────────────────────────────────────────

describe("CharacterPossessions — removePossessionsFromPlaybook", () => {
	it("removes all possession items with matching playbookSlug", async () => {
		const [pouch, apiary] = basePossessions();
		const actor = makeActor([
			makePossessionItem(pouch,  { playbookSlug: "the-blessed" }),
			makePossessionItem(apiary, { playbookSlug: "the-blessed" }),
		]);
		const cp = new CharacterPossessions(actor, makeMoves());
		await cp.removePossessionsFromPlaybook("the-blessed");
		expect([...actor.items].filter(i => i.type === "possession")).toHaveLength(0);
	});

	it("does not remove drag-dropped possessions (playbookSlug=null)", async () => {
		const [, apiary] = basePossessions();
		const actor = makeActor([
			makePossessionItem(apiary, { playbookSlug: null }),
		]);
		const cp = new CharacterPossessions(actor, makeMoves());
		await cp.removePossessionsFromPlaybook("the-blessed");
		expect([...actor.items].filter(i => i.type === "possession")).toHaveLength(1);
	});

	it("does not remove possessions from a different playbook", async () => {
		const [pouch] = basePossessions();
		const actor = makeActor([
			makePossessionItem(pouch, { playbookSlug: "the-fox" }),
		]);
		const cp = new CharacterPossessions(actor, makeMoves());
		await cp.removePossessionsFromPlaybook("the-blessed");
		expect([...actor.items].filter(i => i.type === "possession")).toHaveLength(1);
	});

	it("is a no-op when playbookSlug is null", async () => {
		const [pouch] = basePossessions();
		const actor = makeActor([makePossessionItem(pouch, { playbookSlug: "the-blessed" })]);
		const cp = new CharacterPossessions(actor, makeMoves());
		await cp.removePossessionsFromPlaybook(null);
		expect([...actor.items].filter(i => i.type === "possession")).toHaveLength(1);
	});

	it("calls deleteBySource for each removed possession's outfit items", async () => {
		const [pouch, apiary] = basePossessions();
		const actor = makeActor([
			makePossessionItem(pouch,  { playbookSlug: "the-blessed" }),
			makePossessionItem(apiary, { playbookSlug: "the-blessed" }),
		]);
		const outfitItems = makeOutfitItems();
		const cp = new CharacterPossessions(actor, makeMoves(), outfitItems);
		await cp.removePossessionsFromPlaybook("the-blessed");
		expect(outfitItems.deletedSources).toContain("possession:sacred-pouch");
		expect(outfitItems.deletedSources).toContain("possession:apiary");
	});
});
