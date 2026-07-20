import { describe, it, expect } from "vitest";
import { migratePossessionPackData } from "../../src/migration/migrateCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakePossessionRepository } from "../fakes/FakePossessionRepository.js";
import { ContainerOutfitSync } from "../../src/actors/character/ContainerOutfitSync.js";
import { CharacterPossessions } from "../../src/actors/character/CharacterPossessions.js";
import { FakeOutfitItems } from "../fakes/FakeOutfitItems.js";

// An embedded possession is a COPY taken when the playbook granted it, so regenerating the pack never
// reaches it: a description added later never appears, and gear hung off a pick that the player already
// ticked never materialises. Arcana and arcana followers each have a refresh for exactly this; this is
// the possession one. Authored fields come from the repo; player state survives by omission.

const PACK = {
	slug: "weapons-of-war-heavy",
	name: "Weapons of war",
	description: "choose up to 3 (now or later)",
	outfitItems: [],
	choices: {
		slug: "weapons-of-war-heavy",
		list: [{
			type: "pick", pickCount: 3,
			options: [
				{ slug: "sword", text: "Sword", outfitItems: [{ slug: "sword", name: "Sword, iron", weight: 1 }] },
				{ slug: "axe",   text: "Axe",   outfitItems: [{ slug: "axe",   name: "Battleaxe",   weight: 1 }] },
			],
		}],
	},
	resource: null,
	scaling: null,
	sortOrder: 4,
};

// How the item looked when it was embedded: no description, and no gear on its options.
function staleItem(overrides = {}) {
	return {
		_id: "pos1", type: "possession", name: "Weapons of war",
		system: {
			slug: "weapons-of-war-heavy",
			description: "",
			outfitItems: [],
			choices: {
				slug: "weapons-of-war-heavy",
				list: [{
					type: "pick", pickCount: 3,
					options: [{ slug: "sword", text: "Sword" }, { slug: "axe", text: "Axe" }],
				}],
			},
			selected: true, preselected: true, playbookSlug: "the-heavy",
			uses: 2, pickValues: { "weapons-of-war-heavy": { sword: 1 } }, choiceUses: { sword: 1 },
			...overrides,
		},
	};
}

function setup(items = [staleItem()], packs = [PACK]) {
	const actor  = new FakeCharacterActorBuilder().withItems(items).build();
	const outfit = new FakeOutfitItems();
	const sync   = new ContainerOutfitSync(outfit).register("possession", CharacterPossessions.outfitGrantFor);
	return { actor, outfit, sync, repo: new FakePossessionRepository(packs) };
}

const itemIn = (actor, id = "pos1") => actor.items.get(id);

describe("migratePossessionPackData", () => {
	it("refreshes the description from the pack", async () => {
		const { actor, repo, sync } = setup();

		await migratePossessionPackData(actor, repo, sync);

		expect(itemIn(actor).system.description).toBe("choose up to 3 (now or later)");
	});

	it("refreshes the choice group, bringing across gear the pack added later", async () => {
		const { actor, repo, sync } = setup();

		await migratePossessionPackData(actor, repo, sync);

		const options = itemIn(actor).system.choices.list[0].options;
		expect(options.find(o => o.slug === "sword").outfitItems).toHaveLength(1);
	});

	it("preserves player state — selection, uses and picks are untouched", async () => {
		const { actor, repo, sync } = setup();

		await migratePossessionPackData(actor, repo, sync);

		const update = actor.updatedDocs.find(d => d._id === "pos1");
		for (const field of ["selected", "uses", "pickValues", "choiceUses", "preselected", "playbookSlug"]) {
			expect(update.system, `refresh must not write ${field}`).not.toHaveProperty(field);
		}
		expect(itemIn(actor).system.pickValues).toEqual({ "weapons-of-war-heavy": { sword: 1 } });
		expect(itemIn(actor).system.uses).toBe(2);
	});

	// The point of the whole migration: the player already ticked "sword", so once the pack's gear
	// arrives it has to actually appear in their inventory. Nothing else recomputes the grant.
	it("materialises gear for a pick that was already ticked", async () => {
		const { actor, repo, sync, outfit } = setup();

		await migratePossessionPackData(actor, repo, sync);

		expect(outfit.getSlugs("possession:weapons-of-war-heavy")).toContain("sword");
	});

	it("does not grant gear for picks that were not ticked", async () => {
		const { actor, repo, sync, outfit } = setup();

		await migratePossessionPackData(actor, repo, sync);

		expect(outfit.getSlugs("possession:weapons-of-war-heavy")).not.toContain("axe");
	});

	it("leaves the item's name alone, so a rename survives", async () => {
		const { actor, repo, sync } = setup([staleItem()].map(i => ({ ...i, name: "My renamed kit" })));

		await migratePossessionPackData(actor, repo, sync);

		expect(itemIn(actor).name).toBe("My renamed kit");
	});

	it("skips a possession the repo does not know (drag-dropped custom)", async () => {
		const custom = staleItem();
		custom._id = "pos2";
		custom.system.slug = "my-custom-thing";
		const { actor, repo, sync } = setup([custom]);

		await migratePossessionPackData(actor, repo, sync);

		expect(actor.updatedDocs.find(d => d._id === "pos2")).toBeUndefined();
	});

	it("ignores non-possession items", async () => {
		const { actor, repo, sync } = setup([{ _id: "a1", type: "arcanum", system: { slug: "mindgem" } }]);

		await migratePossessionPackData(actor, repo, sync);

		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("is idempotent — a second run grants nothing further", async () => {
		const { actor, repo, sync, outfit } = setup();
		await migratePossessionPackData(actor, repo, sync);

		await migratePossessionPackData(actor, repo, sync);

		expect(outfit.getSlugs("possession:weapons-of-war-heavy").filter(s => s === "sword")).toHaveLength(1);
	});
});
