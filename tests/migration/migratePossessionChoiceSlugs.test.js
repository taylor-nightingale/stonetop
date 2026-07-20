import { describe, it, expect } from "vitest";
import { migratePossessionChoiceSlugs } from "../../src/migration/migrateCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";

// Granted gear is computed by reading each choice group's values under THAT group's own slug. Both
// weapons-of-war possessions shipped `choices.slug: "weapons-of-war"` while their values are stored
// under the possession's own slug, so an un-migrated character silently stops granting its picked
// weapons. This stamps the group slug from the possession slug; stored picks are left alone, since
// they were already keyed by the possession slug.

function makePossessionItem(slug, groupSlug, pickValues = {}) {
	return {
		_id: slug, type: "possession", name: slug,
		system: {
			slug, selected: true, outfitItems: [],
			choices: groupSlug === undefined ? null : {
				slug: groupSlug,
				list: [{ type: "pick", pickCount: 3, options: [{ slug: "sword", text: "Sword" }] }],
			},
			pickValues,
		},
	};
}

const makeActor = (items = []) => new FakeCharacterActorBuilder().withItems(items).build();

describe("migratePossessionChoiceSlugs", () => {
	it("stamps the group slug from the possession slug", async () => {
		const actor = makeActor([makePossessionItem("weapons-of-war-heavy", "weapons-of-war")]);

		await migratePossessionChoiceSlugs(actor);

		expect(actor.updatedDocs.find(d => d._id === "weapons-of-war-heavy")?.system?.choices?.slug)
			.toBe("weapons-of-war-heavy");
	});

	it("preserves the group's list", async () => {
		const actor = makeActor([makePossessionItem("weapons-of-war-heavy", "weapons-of-war")]);

		await migratePossessionChoiceSlugs(actor);

		const choices = actor.updatedDocs.find(d => d._id === "weapons-of-war-heavy")?.system?.choices;
		expect(choices.list[0].options.map(o => o.slug)).toEqual(["sword"]);
	});

	it("leaves stored picks untouched — they were already keyed by the possession slug", async () => {
		const stored = { "weapons-of-war-heavy": { sword: 1 } };
		const actor  = makeActor([makePossessionItem("weapons-of-war-heavy", "weapons-of-war", stored)]);

		await migratePossessionChoiceSlugs(actor);

		const update = actor.updatedDocs.find(d => d._id === "weapons-of-war-heavy");
		expect(update.system.pickValues).toBeUndefined();
		expect(actor.items.get("weapons-of-war-heavy").system.pickValues).toEqual(stored);
	});

	it("is a no-op when the group slug already matches", async () => {
		const actor = makeActor([makePossessionItem("personal-token", "personal-token")]);

		await migratePossessionChoiceSlugs(actor);

		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("ignores possessions with no choice group", async () => {
		const actor = makeActor([makePossessionItem("plain-thing", undefined)]);

		await migratePossessionChoiceSlugs(actor);

		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("is idempotent — a second run changes nothing", async () => {
		const actor = makeActor([makePossessionItem("weapons-of-war-heavy", "weapons-of-war")]);
		await migratePossessionChoiceSlugs(actor);
		const afterFirst = actor.updatedDocs.length;

		await migratePossessionChoiceSlugs(actor);

		expect(actor.updatedDocs).toHaveLength(afterFirst);
	});
});
