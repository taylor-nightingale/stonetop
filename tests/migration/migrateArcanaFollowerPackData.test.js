import { describe, it, expect } from "vitest";
import { migrateArcanaFollowerPackData } from "../../src/migration/migrateCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeFollowerRepository } from "../fakes/FakeFollowerRepository.js";

// The repo returns Follower-entity-shaped objects: tagList is exposed as `tags`; selection fields are
// the stored { selected, options } objects (see model/data/character/Follower.js).
const packTulpa = {
	slug: "tulpa", name: "Tulpa", img: "systems/stonetop/assets/content/wonders/markers/marker-triskele.png",
	tags:     { selected: ["Spirit"], options: ["Spirit", "eager", "fierce"], multi: true, allowCustom: true },
	instinct: { selected: [], options: ["to play", "to learn"], multi: false, allowCustom: true },
	cost:     { selected: [], options: ["respect given", "comfort"], multi: false, allowCustom: true },
	moves:    "- Manifest a form",
	choices:  [{ slug: "choices", list: [{ type: "entry", slug: "produce-light", content: { title: null, text: "Produce light" }, track: { max: 1 } }] }],
	armor: "0", damage: "d4", specialQuality: "", description: "a thoughtform", hp: { value: 0, max: 8 },
};

function makeFollowerItem(slug, overrides = {}) {
	return {
		_id: slug, type: "follower", name: slug,
		img: "systems/stonetop/assets/content/icons/npc.png",
		system: {
			slug, arcanaSlug: "beautiful-scroll", owned: true,
			tagList:  { selected: ["Spirit"], options: [], multi: true, allowCustom: true },
			instinct: { selected: ["to play to learn"], options: [], multi: false, allowCustom: true }, // stale mashed value
			cost:     { selected: [], options: [], multi: false, allowCustom: true },
			moves:    "- Manifest a form\n- Produce light",  // stale: pickable move still in the list
			choices:  [{ slug: "choices", list: [] }],
			hp:       { value: 3, max: 8 },
			loyalty:  { value: 2, max: 3 },
			choiceValues: { unlock: { foo: 1 } },
			...overrides,
		},
	};
}

const actorWith = (items) => new FakeCharacterActorBuilder().withItems(items).build();
const repo = (followers = [packTulpa]) => new FakeFollowerRepository(followers);

describe("migrateArcanaFollowerPackData", () => {
	it("does nothing when the actor has no follower items", async () => {
		const actor = actorWith([]);
		await migrateArcanaFollowerPackData(actor, repo());
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("refreshes the authored stat block: options, selectable-move choice group, and marker icon", async () => {
		const actor = actorWith([makeFollowerItem("tulpa")]);
		await migrateArcanaFollowerPackData(actor, repo());
		const u = actor.updatedDocs.find(d => d._id === "tulpa");
		expect(u.system.tagList.options).toEqual(["Spirit", "eager", "fierce"]);
		expect(u.system.instinct.options).toEqual(["to play", "to learn"]);
		expect(u.system.cost.options).toEqual(["respect given", "comfort"]);
		expect(u.system.moves).toBe("- Manifest a form"); // pickable move no longer in the list
		expect(u.system.choices[0].list.map(e => e.content.text)).toEqual(["Produce light"]);
		expect(u.img).toContain("marker-triskele.png");
	});

	it("preserves player state — current HP, loyalty, owned, choiceValues are never in the update", async () => {
		const actor = actorWith([makeFollowerItem("tulpa")]);
		await migrateArcanaFollowerPackData(actor, repo());
		const u = actor.updatedDocs.find(d => d._id === "tulpa");
		expect(u.system.hp).toEqual({ value: 3, max: 8 }); // current HP kept, max refreshed
		expect(u.system).not.toHaveProperty("loyalty");
		expect(u.system).not.toHaveProperty("owned");
		expect(u.system).not.toHaveProperty("choiceValues");
	});

	it("ignores non-arcana followers (no arcanaSlug) and unknown slugs", async () => {
		const playbook = makeFollowerItem("crew", { arcanaSlug: null });
		const unknown  = makeFollowerItem("ghost");
		const actor = actorWith([playbook, unknown]);
		await migrateArcanaFollowerPackData(actor, repo()); // repo only knows tulpa
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("batches multiple arcana followers into one update call", async () => {
		const packOther = { ...packTulpa, slug: "andalau", name: "Andalau" };
		const actor = actorWith([
			makeFollowerItem("tulpa"),
			makeFollowerItem("andalau", { arcanaSlug: "cracked-flute" }),
		]);
		await migrateArcanaFollowerPackData(actor, repo([packTulpa, packOther]));
		expect(actor.updatedDocs).toHaveLength(2);
	});
});
