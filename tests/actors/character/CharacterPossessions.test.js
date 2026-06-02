import { describe, it, expect } from "vitest";
import { CharacterPossessions } from "../../../src/actors/character/CharacterPossessions.js";
import { PossessionsSnapshot } from "../../../src/model/snapshot/character/CharacterSnapshot.js";
import { StonetopFlags } from "../../../src/actors/character/StonetopFlags.js";
import { FakeFlags } from "../../fakes/FakeFlags.js";
import { FakeMoves } from "../../fakes/FakeMoves.js";
import { FakeOutfitItems } from "../../fakes/FakeOutfitItems.js";
import { FakePlaybook } from "../../fakes/FakePlaybook.js";
import { TestSpecialPossessionBuilder, TestSpecialPossessionsBuilder } from "../../fakes/TestSpecialPossessionBuilder.js";
import { TestChoiceGroupBuilder } from "../../fakes/TestChoiceGroupBuilder.js";
import { TestChoiceRowBuilder } from "../../fakes/TestChoiceRowBuilder.js";

function makeFlags()       { return new StonetopFlags(new FakeFlags(), "possessions"); }
function makeMoves()       { return new FakeMoves(); }
function makeOutfitItems() { return new FakeOutfitItems(); }
function makePlaybook(sp)  { return new FakePlaybook(sp); }

// ── Test data ─────────────────────────────────────────────────────────────────

function bonusSp() {
	return new TestSpecialPossessionsBuilder()
		.addOption(new TestSpecialPossessionBuilder()
			.withSlug("sacred-pouch").withResource(3)
			.withUsesBonus(1).withMoveBonus("big-magic", 2))
		.build();
}

function baseSp() {
	return new TestSpecialPossessionsBuilder()
		.withPickCount(2).withPickNote("Pick 2")
		.addPreselected("sacred-pouch")
		.addOption(new TestSpecialPossessionBuilder()
			.withSlug("sacred-pouch").withLabel("Sacred Pouch").withDescription("magic").withResource(3))
		.addOption(new TestSpecialPossessionBuilder()
			.withSlug("apiary").withLabel("Apiary").withDescription("bees"))
		.addOption(new TestSpecialPossessionBuilder()
			.withSlug("mastiffs").withLabel("Mastiffs").withDescription("dogs"))
		.build();
}

function outfitSp() {
	return new TestSpecialPossessionsBuilder()
		.addOption(new TestSpecialPossessionBuilder()
			.withSlug("smithy").withLabel("Smithy")
			.withOutfitItems(
				{ slug: "smithy-tongs",   name: "Tongs",   weight: 1, inventoryColumn: "regular" },
				{ slug: "smithy-bellows", name: "Bellows", weight: 1, inventoryColumn: "regular" },
			))
		.addOption(new TestSpecialPossessionBuilder()
			.withSlug("weapons-of-war").withLabel("Weapons of War")
			.withChoices(new TestChoiceGroupBuilder()
				.withSlug("weapons-of-war")
				.addChoice(TestChoiceRowBuilder.pick().withOptions(
					{ slug: "mace",     outfitItems: [{ slug: "mace",     name: "Mace",     weight: 1, inventoryColumn: "regular" }] },
					{ slug: "crossbow", outfitItems: [{ slug: "crossbow", name: "Crossbow", weight: 1, inventoryColumn: "regular" }] },
				))
				.build()))
		.addOption(new TestSpecialPossessionBuilder().withSlug("apiary").withLabel("Apiary"))
		.build();
}

function choicesSp() {
	return new TestSpecialPossessionsBuilder()
		.withPickCount(1).withPickNote("Pick 1")
		.addOption(new TestSpecialPossessionBuilder()
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
				.build()))
		.addOption(new TestSpecialPossessionBuilder().withSlug("apiary").withLabel("Apiary").withDescription("Bees"))
		.build();
}

// ── selection ─────────────────────────────────────────────────────────────────

describe("CharacterPossessions — selection", () => {
	it("selected is empty before any mutation", () => {
		const cp = new CharacterPossessions(makeFlags(), makeMoves());
		expect(cp.selected.size).toBe(0);
	});

	it("select adds slug to selected", async () => {
		const cp = new CharacterPossessions(makeFlags(), makeMoves());
		await cp.select("apiary");
		expect(cp.selected.has("apiary")).toBe(true);
	});

	it("deselect removes slug from selected", async () => {
		const cp = new CharacterPossessions(makeFlags(), makeMoves());
		await cp.select("apiary");
		await cp.select("mastiffs");
		await cp.deselect("apiary");
		expect(cp.selected.has("apiary")).toBe(false);
		expect(cp.selected.has("mastiffs")).toBe(true);
	});
});

// ── resource tracking ─────────────────────────────────────────────────────────

describe("CharacterPossessions — resource tracking", () => {
	it("uses is empty before any mutation", () => {
		const cp = new CharacterPossessions(makeFlags(), makeMoves());
		expect(cp.uses).toEqual({});
	});

	it("setUses stores count under the slug key", async () => {
		const cp = new CharacterPossessions(makeFlags(), makeMoves());
		await cp.setUses("sacred-pouch", 2);
		expect(cp.uses["sacred-pouch"]).toBe(2);
	});

	it("choiceUses is empty before any mutation", () => {
		const cp = new CharacterPossessions(makeFlags(), makeMoves());
		expect(cp.choiceUses).toEqual({});
	});

	it("setChoiceUses stores count under possessionSlug:choiceSlug key", async () => {
		const cp = new CharacterPossessions(makeFlags(), makeMoves());
		await cp.setChoiceUses("weapons-of-war", "crossbow", 1);
		expect(cp.choiceUses["weapons-of-war:crossbow"]).toBe(1);
	});

	it("setChoiceUses merges with existing choiceUses", async () => {
		const cp = new CharacterPossessions(makeFlags(), makeMoves());
		await cp.setChoiceUses("weapons-of-war", "sword", 0);
		await cp.setChoiceUses("weapons-of-war", "crossbow", 2);
		expect(cp.choiceUses["weapons-of-war:sword"]).toBe(0);
		expect(cp.choiceUses["weapons-of-war:crossbow"]).toBe(2);
	});
});

// ── sub-choices ───────────────────────────────────────────────────────────────

describe("CharacterPossessions — sub-choices", () => {
	function makeCp() {
		return new CharacterPossessions(makeFlags(), makeMoves(), null, makePlaybook(choicesSp()));
	}

	async function wowChoices(cp) {
		const snap = await cp.buildSnapshot(1);
		return snap.items.find(i => i.slug === "weapons-of-war").choices;
	}

	it("addSubChoice marks the option checked in the snapshot", async () => {
		const cp = makeCp();
		await cp.select("weapons-of-war");
		await cp.addSubChoice("weapons-of-war", "sword");
		const row = (await wowChoices(cp)).list[1];
		expect(row.options.find(o => o.slug === "sword").checked).toBe(true);
	});

	it("addSubChoice is idempotent — calling twice keeps the option checked", async () => {
		const cp = makeCp();
		await cp.select("weapons-of-war");
		await cp.addSubChoice("weapons-of-war", "sword");
		await cp.addSubChoice("weapons-of-war", "sword");
		const row = (await wowChoices(cp)).list[1];
		expect(row.options.find(o => o.slug === "sword").checked).toBe(true);
	});

	it("addSubChoice merges with existing selections across rows", async () => {
		const cp = makeCp();
		await cp.select("weapons-of-war");
		await cp.addSubChoice("weapons-of-war", "sword");
		await cp.addSubChoice("weapons-of-war", "shield");
		const choices = await wowChoices(cp);
		expect(choices.list[1].options.find(o => o.slug === "sword").checked).toBe(true);
		expect(choices.list[2].options.find(o => o.slug === "shield").checked).toBe(true);
	});

	it("removeSubChoice clears the option", async () => {
		const cp = makeCp();
		await cp.select("weapons-of-war");
		await cp.addSubChoice("weapons-of-war", "sword");
		await cp.removeSubChoice("weapons-of-war", "sword");
		const row = (await wowChoices(cp)).list[1];
		expect(row.options.find(o => o.slug === "sword").checked).toBe(false);
	});

	it("removeSubChoice is safe when slug was not previously set", async () => {
		const cp = makeCp();
		await cp.select("weapons-of-war");
		await cp.addSubChoice("weapons-of-war", "sword");
		await cp.removeSubChoice("weapons-of-war", "axe");
		const row = (await wowChoices(cp)).list[1];
		expect(row.options.find(o => o.slug === "sword").checked).toBe(true);
		expect(row.options.find(o => o.slug === "axe").checked).toBe(false);
	});

	it("selectExclusive selects the target and clears all siblings", async () => {
		const cp = makeCp();
		await cp.select("weapons-of-war");
		await cp.addSubChoice("weapons-of-war", "sword");
		await cp.selectExclusive("weapons-of-war", "axe", ["sword", "axe"]);
		const row = (await wowChoices(cp)).list[1];
		expect(row.options.find(o => o.slug === "axe").checked).toBe(true);
		expect(row.options.find(o => o.slug === "sword").checked).toBe(false);
	});
});

// ── computeMaxUses ────────────────────────────────────────────────────────────

describe("CharacterPossessions — computeMaxUses", () => {
	function makeCp(moves = makeMoves()) {
		return new CharacterPossessions(makeFlags(), moves);
	}

	it("no bonus at level 1 with no moves — entry absent", () => {
		expect(makeCp().computeMaxUses(bonusSp(), 1)["sacred-pouch"]).toBeUndefined();
	});

	it("level 2 adds +1 from even-level bonus", () => {
		expect(makeCp().computeMaxUses(bonusSp(), 2)["sacred-pouch"]).toBe(4);
	});

	it("level 4 adds +2 from two even levels", () => {
		expect(makeCp().computeMaxUses(bonusSp(), 4)["sacred-pouch"]).toBe(5);
	});

	it("owning Big Magic once adds +2", () => {
		expect(makeCp(makeMoves().ownMove("big-magic")).computeMaxUses(bonusSp(), 1)["sacred-pouch"]).toBe(5);
	});

	it("owning Big Magic twice adds +4", () => {
		expect(makeCp(makeMoves().ownMove("big-magic", 2)).computeMaxUses(bonusSp(), 1)["sacred-pouch"]).toBe(7);
	});

	it("Big Magic once + level 4 gives base 3 + 4", () => {
		expect(makeCp(makeMoves().ownMove("big-magic")).computeMaxUses(bonusSp(), 4)["sacred-pouch"]).toBe(7);
	});

	it("possession without usesBonus is not affected", () => {
		const sp = new TestSpecialPossessionsBuilder()
			.addOption(new TestSpecialPossessionBuilder().withSlug("apiary"))
			.build();
		expect(makeCp().computeMaxUses(sp, 10)["apiary"]).toBeUndefined();
	});

	it("merges persisted maxUses with computed bonus", () => {
		const ff = new FakeFlags();
		ff.storage.stonetop = { "possessions.maxUses": { "custom-item": 5 } };
		const cp = new CharacterPossessions(new StonetopFlags(ff, "possessions"), makeMoves());
		const result = cp.computeMaxUses(bonusSp(), 1);
		expect(result["custom-item"]).toBe(5);
		expect(result["sacred-pouch"]).toBeUndefined();
	});
});

// ── buildSnapshot ─────────────────────────────────────────────────────────────

describe("CharacterPossessions — buildSnapshot", () => {
	function makeCp() {
		return new CharacterPossessions(makeFlags(), makeMoves(), null, makePlaybook(baseSp()));
	}

	it("returns null when specialPossessions is null", async () => {
		const cp = new CharacterPossessions(makeFlags(), makeMoves());
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
		const cp = makeCp();
		await cp.select("apiary");
		const snap = await cp.buildSnapshot(1);
		const apiary = snap.items.find(i => i.slug === "apiary");
		expect(apiary.selected).toBe(true);
		expect(apiary.disabled).toBe(false);
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
		const cp = makeCp();
		await cp.setUses("apiary", 5);
		const snap = await cp.buildSnapshot(1);
		expect(snap.items.find(i => i.slug === "apiary").resource).toBeNull();
	});

	it("level-based uses bonus is applied to resource max", async () => {
		const sp = new TestSpecialPossessionsBuilder()
			.withPickCount(1).addPreselected("sacred-pouch")
			.addOption(new TestSpecialPossessionBuilder()
				.withSlug("sacred-pouch").withLabel("Sacred Pouch").withResource(3).withUsesBonus(1))
			.build();
		const cp = new CharacterPossessions(makeFlags(), makeMoves(), null, makePlaybook(sp));
		const snap = await cp.buildSnapshot(4);
		expect(snap.items.find(i => i.slug === "sacred-pouch").resource.max).toBe(5);
	});
});

// ── buildSnapshot — choices ───────────────────────────────────────────────────

describe("CharacterPossessions — buildSnapshot — choices", () => {
	function makeCp() {
		return new CharacterPossessions(makeFlags(), makeMoves(), null, makePlaybook(choicesSp()));
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
		expect(heading.type).toBe("heading");
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
		expect(list[0].type).toBe("heading");
		expect(list[1].options).toHaveLength(2);
		expect(list[2].options).toHaveLength(3);
	});
});

// ── syncPossessionItems ───────────────────────────────────────────────────────

describe("CharacterPossessions — syncPossessionItems", () => {
	it("is a no-op when specialPossessions is null", async () => {
		const outfitItems = makeOutfitItems();
		const cp = new CharacterPossessions(makeFlags(), makeMoves(), outfitItems);
		await cp.syncPossessionItems("smithy", null);
		expect(outfitItems.hasSource("possession:smithy")).toBe(false);
	});

	it("does not throw when outfitItems is null", async () => {
		const cp = new CharacterPossessions(makeFlags(), makeMoves(), null);
		await expect(cp.syncPossessionItems("smithy", outfitSp())).resolves.not.toThrow();
	});

	it("syncs possession-level outfit items under 'possession:smithy'", async () => {
		const outfitItems = makeOutfitItems();
		const cp = new CharacterPossessions(makeFlags(), makeMoves(), outfitItems);
		await cp.syncPossessionItems("smithy", outfitSp());
		expect(outfitItems.getSlugs("possession:smithy"))
			.toEqual(expect.arrayContaining(["smithy-tongs", "smithy-bellows"]));
	});

	it("syncs choice outfit item when the sub-choice is selected", async () => {
		const outfitItems = makeOutfitItems();
		const cp = new CharacterPossessions(makeFlags(), makeMoves(), outfitItems);
		await cp.addSubChoice("weapons-of-war", "mace");
		await cp.syncPossessionItems("weapons-of-war", outfitSp());
		expect(outfitItems.getSlugs("possession:weapons-of-war")).toContain("mace");
	});

	it("does not include choice outfit item when sub-choice is not selected", async () => {
		const outfitItems = makeOutfitItems();
		const cp = new CharacterPossessions(makeFlags(), makeMoves(), outfitItems);
		await cp.syncPossessionItems("weapons-of-war", outfitSp());
		expect(outfitItems.getSlugs("possession:weapons-of-war")).toHaveLength(0);
	});

	it("syncs an empty array when possession has no outfit items", async () => {
		const outfitItems = makeOutfitItems();
		const cp = new CharacterPossessions(makeFlags(), makeMoves(), outfitItems);
		await cp.syncPossessionItems("apiary", outfitSp());
		expect(outfitItems.getSlugs("possession:apiary")).toHaveLength(0);
		expect(outfitItems.hasSource("possession:apiary")).toBe(true);
	});
});

// ── outfit item integration ───────────────────────────────────────────────────

describe("CharacterPossessions — outfit item integration", () => {
	it("select syncs the possession's outfit items", async () => {
		const outfitItems = makeOutfitItems();
		const cp = new CharacterPossessions(makeFlags(), makeMoves(), outfitItems);
		await cp.select("smithy", outfitSp());
		expect(outfitItems.getSlugs("possession:smithy"))
			.toEqual(expect.arrayContaining(["smithy-tongs", "smithy-bellows"]));
	});

	it("deselect removes the possession's outfit items", async () => {
		const outfitItems = makeOutfitItems();
		const cp = new CharacterPossessions(makeFlags(), makeMoves(), outfitItems);
		await cp.select("smithy", outfitSp());
		await cp.deselect("smithy");
		expect(outfitItems.hasSource("possession:smithy")).toBe(false);
	});

	it("addSubChoice syncs with the newly selected choice item", async () => {
		const outfitItems = makeOutfitItems();
		const cp = new CharacterPossessions(makeFlags(), makeMoves(), outfitItems);
		await cp.addSubChoice("weapons-of-war", "mace", outfitSp());
		expect(outfitItems.getSlugs("possession:weapons-of-war")).toContain("mace");
	});

	it("removeSubChoice syncs with the choice item removed", async () => {
		const outfitItems = makeOutfitItems();
		const cp = new CharacterPossessions(makeFlags(), makeMoves(), outfitItems);
		await cp.addSubChoice("weapons-of-war", "mace", outfitSp());
		await cp.removeSubChoice("weapons-of-war", "mace", outfitSp());
		expect(outfitItems.getSlugs("possession:weapons-of-war")).not.toContain("mace");
	});
});
