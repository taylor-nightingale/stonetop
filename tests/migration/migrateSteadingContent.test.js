import { describe, expect, it } from "vitest";
import { migrateSteadingContent } from "../../src/migration/migrateSteadingContent.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";

// The runner sees the actor AFTER SteadingData.migrateData healed its shape, so `system.content`
// already holds the folded lists (that path is covered in migrateSteadingShape.test.js). This pass
// only writes what is already true back to the database and drops the three text keys the lists
// replaced — which is the only way they ever leave a world, since schema cleaning has already
// removed them from the in-memory source.
function healedSteading(content = {}) {
	return new FakeActorBuilder().withType("steading").withSystem({
		steadfast: "stonetop",
		content: {
			excluded:        ["Harm to children, on screen"],
			veiled:          ["Torture"],
			specialHandling: [],
			...content,
		},
	}).build();
}

describe("migrateSteadingContent", () => {
	it("persists the three lists", async () => {
		const actor = healedSteading();
		await migrateSteadingContent(actor);
		expect(actor.system.content.excluded).toEqual(["Harm to children, on screen"]);
		expect(actor.system.content.veiled).toEqual(["Torture"]);
		expect(actor.system.content.specialHandling).toEqual([]);
	});

	// The payload is the right thing to assert here, and only here: schema cleaning has already taken
	// these keys out of the in-memory source, so the update is aimed at what is STORED and there is
	// nothing in `actor.system` left to watch disappear.
	it("asks for the three text fields the lists replaced to be deleted", async () => {
		const actor = healedSteading();
		const updates = [];
		const update = actor.update.bind(actor);
		actor.update = data => { updates.push(data); return update(data); };

		await migrateSteadingContent(actor);

		expect(updates[0]).toHaveProperty(["system.content.-=excludedText"], null);
		expect(updates[0]).toHaveProperty(["system.content.-=veiledText"], null);
		expect(updates[0]).toHaveProperty(["system.content.-=specialHandlingText"], null);
	});

	// And that the ask REMOVES rather than adds. Seeded deliberately — a healed actor no longer holds
	// these keys, so the fake stands in for the stored document here.
	it("removes them, rather than storing a key named -=", async () => {
		const actor = healedSteading({ excludedText: "Harm to children, on screen", veiledText: "Torture" });

		await migrateSteadingContent(actor);

		expect(actor.system.content.excludedText).toBeUndefined();
		expect(actor.system.content.veiledText).toBeUndefined();
		expect(Object.keys(actor.system.content).filter(k => k.startsWith("-="))).toEqual([]);
	});

	// It runs once per world upgrade, so running it twice must be the same as running it once — and
	// in particular must not append the folded entries a second time.
	it("is idempotent", async () => {
		const actor = healedSteading();
		await migrateSteadingContent(actor);
		const after = structuredClone(actor.system);
		await migrateSteadingContent(actor);
		expect(actor.system).toEqual(after);
	});

	it("copes with a steading whose content has never been touched", async () => {
		const actor = new FakeActorBuilder().withType("steading").withSystem({ steadfast: "stonetop" }).build();
		await migrateSteadingContent(actor);
		expect(actor.system.content).toEqual({ excluded: [], veiled: [], specialHandling: [] });
	});
});
