import { describe, expect, it } from "vitest";
import { migrateArcana } from "../../src/migration/migrateCharacter.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";
import { FakeArcanaRepository } from "../fakes/FakeArcanaRepository.js";
import { FakeFollowerRepository } from "../fakes/FakeFollowerRepository.js";

// migrateArcana(actor, arcanaRepo, followerRepo) — followerRepo, not a CharacterFollowers instance

const FRONT = { title: "Front", unlock: null, item: null, description: "desc" };
const BACK  = { title: "Back",  choices: null, moves: [], consequences: null, unlockAt: null, item: null, description: "" };

function makeActor(flags = {}, items = []) {
	const builder = new FakeActorBuilder().withItems(items);
	builder._flagsBuilder.withFlags(flags);
	return builder.build();
}

function makeArcanaRepo(arcana = []) {
	return new FakeArcanaRepository(arcana);
}

function makeFollowerRepo() {
	return new FakeFollowerRepository();
}

describe("migrateArcana — gate", () => {
	it("skips if arcanum items already exist on actor", async () => {
		const actor = makeActor({}, [
			{ _id: "a1", type: "arcanum", name: "Maw", system: { slug: "maw" } },
		]);
		actor.setFlag("stonetop", "arcana.owned", ["maw"]);
		await migrateArcana(actor, makeArcanaRepo([{ slug: "maw", name: "Maw", front: FRONT, back: BACK }]), makeFollowerRepo());
		expect(actor.createdDocs).toHaveLength(0);
	});
});

describe("migrateArcana — embedding", () => {
	it("creates arcanum items for each slug in arcana.owned flag", async () => {
		const actor = makeActor({ "arcana.owned": ["maw"] });
		const repo = makeArcanaRepo([{ slug: "maw", name: "Hungering Maw", major: false, front: FRONT, back: BACK }]);
		await migrateArcana(actor, repo, makeFollowerRepo());
		const arcana = actor.createdDocs.filter(d => d.type === "arcanum");
		expect(arcana).toHaveLength(1);
		expect(arcana[0].system.slug).toBe("maw");
	});

	it("does nothing when arcana.owned flag is empty", async () => {
		const actor = makeActor({});
		await migrateArcana(actor, makeArcanaRepo(), makeFollowerRepo());
		expect(actor.createdDocs.filter(d => d.type === "arcanum")).toHaveLength(0);
	});
});

describe("migrateArcana — mutable state", () => {
	it("applies flipped state from arcana.flipped flag", async () => {
		const actor = makeActor({
			"arcana.owned":   ["maw"],
			"arcana.flipped": ["maw"],
		});
		const repo = makeArcanaRepo([{ slug: "maw", name: "Maw", front: FRONT, back: BACK }]);
		await migrateArcana(actor, repo, makeFollowerRepo());
		const arcanum = [...actor.items].find(i => i.type === "arcanum" && i.system?.slug === "maw");
		expect(arcanum.system.flipped).toBe(true);
	});

	it("leaves flipped=false when slug not in arcana.flipped", async () => {
		const actor = makeActor({
			"arcana.owned":   ["maw"],
			"arcana.flipped": [],
		});
		const repo = makeArcanaRepo([{ slug: "maw", name: "Maw", front: FRONT, back: BACK }]);
		await migrateArcana(actor, repo, makeFollowerRepo());
		const arcanum = [...actor.items].find(i => i.type === "arcanum" && i.system?.slug === "maw");
		expect(arcanum.system.flipped).toBe(false);
	});

	it("applies unlockValues from arcana.unlock flag, nested under arcanum slug", async () => {
		const actor = makeActor({
			"arcana.owned":  ["maw"],
			"arcana.unlock": { "maw": { "opt-a": 1 } },
		});
		const repo = makeArcanaRepo([{ slug: "maw", name: "Maw", front: FRONT, back: BACK }]);
		await migrateArcana(actor, repo, makeFollowerRepo());
		const arcanum = [...actor.items].find(i => i.type === "arcanum" && i.system?.slug === "maw");
		expect(arcanum.system.unlockValues).toEqual({ "maw": { "opt-a": 1 } });
	});

	it("applies backChoiceValues from arcana.backChoices flag, nested under arcanum slug", async () => {
		const actor = makeActor({
			"arcana.owned":       ["maw"],
			"arcana.backChoices": { "maw": { "follower-adra": 1 } },
		});
		const repo = makeArcanaRepo([{ slug: "maw", name: "Maw", front: FRONT, back: BACK }]);
		await migrateArcana(actor, repo, makeFollowerRepo());
		const arcanum = [...actor.items].find(i => i.type === "arcanum" && i.system?.slug === "maw");
		expect(arcanum.system.backChoiceValues).toEqual({ "maw": { "follower-adra": 1 } });
	});
});
