import { describe, expect, it } from "vitest";
import { migrateFollowers } from "../../src/migration/migrateCharacter.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";
import { FakeFollowerRepository } from "../fakes/FakeFollowerRepository.js";
import { ResourceController } from "../../src/actors/character/ResourceController.js";

function makeActor(flags = {}, items = []) {
	const builder = new FakeActorBuilder().withItems(items);
	builder._flagsBuilder.withFlags(flags);
	return builder.build();
}

function makeResourceController(actor) {
	return new ResourceController(actor);
}

describe("migrateFollowers — gate", () => {
	it("skips if any owned npc item already exists", async () => {
		const actor = makeActor(
			{ "followers.owned": ["enfys"] },
			[{ _id: "f1", type: "npc", name: "Enfys", system: { slug: "enfys", owned: true } }],
		);
		const repo = new FakeFollowerRepository();
		await migrateFollowers(actor, repo, makeResourceController(actor));
		expect(actor.createdDocs).toHaveLength(0);
	});
});

describe("migrateFollowers — custom followers", () => {
	it("creates an npc item from custom follower state", async () => {
		const slug = "custom-1234567890";
		const actor = makeActor({
			"followers.owned": [slug],
			"followers.state": {
				[slug]: { name: "Grizzle", tags: "gruff", hp: 8, hpMax: 10, armor: 1, damage: "d6" },
			},
		});
		const repo = new FakeFollowerRepository();
		await migrateFollowers(actor, repo, makeResourceController(actor));
		const created = actor.createdDocs.find(d => d.system?.slug === slug);
		expect(created).toBeDefined();
		expect(created.name).toBe("Grizzle");
		expect(created.type).toBe("npc");
		expect(created.system.owned).toBe(true);
		expect(created.system.hp).toEqual({ value: 8, max: 10 });
		expect(created.system.armor).toBe("1");
		expect(created.system.damage).toBe("d6");
		expect(created.system.tagList).toBe("gruff");
	});

	it("uses fallback values when state fields are absent", async () => {
		const slug = "custom-0000000000";
		const actor = makeActor({
			"followers.owned": [slug],
			"followers.state": { [slug]: {} },
		});
		const repo = new FakeFollowerRepository();
		await migrateFollowers(actor, repo, makeResourceController(actor));
		const created = actor.createdDocs.find(d => d.system?.slug === slug);
		expect(created?.name).toBe("New Follower");
		expect(created?.system.hp).toEqual({ value: 0, max: 0 });
	});

	it("does not call followerRepo for custom followers", async () => {
		const slug = "custom-9999";
		const actor = makeActor({
			"followers.owned": [slug],
			"followers.state": { [slug]: { name: "X" } },
		});
		const repo = new FakeFollowerRepository();
		await migrateFollowers(actor, repo, makeResourceController(actor));
		expect(repo.queriedSlugs).not.toContain(slug);
	});

	it("migrates values.choices to choiceValues nested under 'choices' group slug", async () => {
		const slug = "custom-1111";
		const choices = { "damage-input": "d6 piercing", "cost-input": "loyalty", "notes-input": "note" };
		const actor = makeActor({
			"followers.owned": [slug],
			"followers.state": { [slug]: { name: "Test", values: { choices } } },
		});
		const repo = new FakeFollowerRepository();
		await migrateFollowers(actor, repo, makeResourceController(actor));
		const created = actor.createdDocs.find(d => d.system?.slug === slug);
		expect(created?.system.choiceValues).toEqual({ choices });
	});

	it("sets choices from the blank follower template", async () => {
		const slug = "custom-2222";
		const blankChoices = [{ slug: "choices", list: [
			{ type: "entry", slug: "damage", content: { title: null, text: "Damage" }, input: {} },
		]}];
		const actor = makeActor({
			"followers.owned": [slug],
			"followers.state": { [slug]: { name: "Test" } },
		});
		const repo = new FakeFollowerRepository([{ slug: "blank", name: "New Follower", choices: blankChoices }]);
		await migrateFollowers(actor, repo, makeResourceController(actor));
		const created = actor.createdDocs.find(d => d.system?.slug === slug);
		expect(created?.system.choices).toEqual(blankChoices);
	});
});

describe("migrateFollowers — static follower choice values", () => {
	it("migrates values.choices to choiceValues nested under 'choices' group slug", async () => {
		const choices = { "they": 1, "a-young-adult": 1, "curious": 1 };
		const followerData = {
			slug: "enfys", name: "Enfys", tags: "", hp: { value: 0, max: 6 },
			armor: "", damage: { value: "d4" }, loyalty: { max: 3 },
			instinct: "", choices: null, specialQuality: "",
		};
		const actor = makeActor({
			"followers.owned": ["enfys"],
			"followers.state": { "enfys": { values: { choices } } },
		});
		const repo = new FakeFollowerRepository([followerData]);
		await migrateFollowers(actor, repo, makeResourceController(actor));
		const update = actor.updatedDocs.find(u => u.system?.choiceValues);
		expect(update?.system.choiceValues).toEqual({ choices });
	});
});

describe("migrateFollowers — static followers still use repo", () => {
	it("creates a static follower via addFollower when slug has no custom- prefix", async () => {
		const followerData = {
			slug: "enfys", name: "Enfys", tags: "", hp: { value: 0, max: 6 },
			armor: "", damage: { value: "d4" }, loyalty: { max: 3 },
			instinct: "", choices: null, specialQuality: "",
		};
		const actor = makeActor({
			"followers.owned": ["enfys"],
			"followers.state": {},
		});
		const repo = new FakeFollowerRepository([followerData]);
		await migrateFollowers(actor, repo, makeResourceController(actor));
		const created = actor.createdDocs.find(d => d.system?.slug === "enfys");
		expect(created).toBeDefined();
		expect(created.system.owned).toBe(true);
	});
});
