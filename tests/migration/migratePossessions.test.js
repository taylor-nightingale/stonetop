import { describe, expect, it } from "vitest";
import { migratePossessions } from "../../src/migration/migrateCharacter.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";
import { FakePossessionRepository } from "../fakes/FakePossessionRepository.js";
import { FakeOutfitItems } from "../fakes/FakeOutfitItems.js";
import { FakeMoves } from "../fakes/FakeMoves.js";

function makeActor(flags = {}, items = []) {
	const builder = new FakeActorBuilder().withItems(items);
	builder._flagsBuilder.withFlags(flags);
	return builder.build();
}

function makeRepo(possessions = []) {
	return new FakePossessionRepository(possessions);
}

function makePossessionSpec() {
	return {
		slug:        "apiary",
		label:       "Apiary",
		description: "A place for bees.",
		resource:    null,
		outfitItems: [],
		choices:     null,
		scaling:     null,
		sortOrder:   0,
	};
}

// Fake specialPossessions.options[] in old 0.9.1 format on a playbook item
function makePlaybookItem(options = [], pickCount = 2, pickNote = "Pick 2", preselected = []) {
	return {
		_id:    "pb1",
		type:   "playbook",
		name:   "The Blessed",
		system: {
			slug:               "blessed",
			specialPossessions: { options, pickCount, pickNote, preselected },
		},
	};
}

describe("migratePossessions — gate", () => {
	it("skips if possession items already exist on actor", async () => {
		const actor = makeActor({}, [
			{ _id: "pb1", type: "playbook", name: "The Blessed", system: { slug: "blessed", specialPossessions: { slugs: ["apiary"] } } },
			{ _id: "p1",  type: "possession", name: "Apiary", system: { slug: "apiary", playbookSlug: "blessed" } },
		]);
		const repo = makeRepo([makePossessionSpec()]);
		await migratePossessions(actor, repo, new FakeMoves(), new FakeOutfitItems());
		expect(actor.createdDocs.filter(d => d.type === "possession")).toHaveLength(0);
	});

	it("skips if no playbook item on actor", async () => {
		const actor = makeActor({});
		await migratePossessions(actor, makeRepo(), new FakeMoves(), new FakeOutfitItems());
		expect(actor.createdDocs.filter(d => d.type === "possession")).toHaveLength(0);
	});

	it("skips if playbook item has no specialPossessions", async () => {
		const actor = makeActor({}, [
			{ _id: "pb1", type: "playbook", name: "The Blessed", system: { slug: "blessed" } },
		]);
		await migratePossessions(actor, makeRepo(), new FakeMoves(), new FakeOutfitItems());
		expect(actor.createdDocs.filter(d => d.type === "possession")).toHaveLength(0);
	});
});

describe("migratePossessions — item creation", () => {
	it("creates a possession item for each slug in old options[]", async () => {
		const options = [{ slug: "apiary", label: "Apiary", preselected: false }];
		const actor = makeActor({}, [makePlaybookItem(options)]);
		const repo = makeRepo([makePossessionSpec()]);
		await migratePossessions(actor, repo, new FakeMoves(), new FakeOutfitItems());
		const possessions = actor.createdDocs.filter(d => d.type === "possession");
		expect(possessions).toHaveLength(1);
		expect(possessions[0].system.slug).toBe("apiary");
	});

	it("sets playbookSlug on created items", async () => {
		const options = [{ slug: "apiary", label: "Apiary" }];
		const actor = makeActor({}, [makePlaybookItem(options)]);
		const repo = makeRepo([makePossessionSpec()]);
		await migratePossessions(actor, repo, new FakeMoves(), new FakeOutfitItems());
		expect(actor.createdDocs[0].system.playbookSlug).toBe("blessed");
	});
});

describe("migratePossessions — mutable state from flags", () => {
	it("marks possession as selected if slug was in possessions.selected flag", async () => {
		const options = [{ slug: "apiary", label: "Apiary" }];
		const actor = makeActor(
			{ "possessions.selected": ["apiary"] },
			[makePlaybookItem(options)],
		);
		const repo = makeRepo([makePossessionSpec()]);
		await migratePossessions(actor, repo, new FakeMoves(), new FakeOutfitItems());
		const possItem = [...actor.items].find(i => i.system?.slug === "apiary");
		expect(possItem.system.selected).toBe(true);
	});

	it("leaves possession unselected if not in possessions.selected flag", async () => {
		const options = [{ slug: "apiary", label: "Apiary" }];
		const actor = makeActor(
			{ "possessions.selected": [] },
			[makePlaybookItem(options)],
		);
		const repo = makeRepo([makePossessionSpec()]);
		await migratePossessions(actor, repo, new FakeMoves(), new FakeOutfitItems());
		const possItem = [...actor.items].find(i => i.system?.slug === "apiary");
		expect(possItem.system.selected).toBe(false);
	});

	it("applies uses from possessions.uses flag", async () => {
		const options = [{ slug: "apiary", label: "Apiary" }];
		const actor = makeActor(
			{ "possessions.uses": { "apiary": 3 } },
			[makePlaybookItem(options)],
		);
		const repo = makeRepo([makePossessionSpec()]);
		await migratePossessions(actor, repo, new FakeMoves(), new FakeOutfitItems());
		const possItem = [...actor.items].find(i => i.system?.slug === "apiary");
		expect(possItem.system.uses).toBe(3);
	});

	it("applies pickValues from possessions.pickValues flag", async () => {
		const options = [{ slug: "apiary", label: "Apiary" }];
		const actor = makeActor(
			{ "possessions.pickValues": { "apiary": { "choice-a": 1 } } },
			[makePlaybookItem(options)],
		);
		const repo = makeRepo([makePossessionSpec()]);
		await migratePossessions(actor, repo, new FakeMoves(), new FakeOutfitItems());
		const possItem = [...actor.items].find(i => i.system?.slug === "apiary");
		expect(possItem.system.pickValues).toEqual({ "choice-a": 1 });
	});
});
