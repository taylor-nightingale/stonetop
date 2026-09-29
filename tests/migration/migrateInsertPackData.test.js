import { describe, it, expect } from "vitest";
import { migrateInsertPackData } from "../../src/migration/migrateInsertPackData.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeInsertRepository } from "../fakes/FakeInsertRepository.js";
import { TestInsertItemBuilder } from "../fakes/TestInsertItemBuilder.js";

// An owned insert is a copy taken when it was gained, so a pack fix never reaches it: the Terrible
// Purpose blanks were added after Ghosts, Revenants and Thralls were already in play.

const INSTINCT = { slug: "instinct", list: [{ type: "choice", radio: true, options: [{ slug: "denial", text: "Denial" }] }] };

const purpose = withBlanks => ({
	slug: "terrible-purpose",
	list: [
		{ type: "entry", content: { title: "Terrible Purpose", text: "Choose 1:" } },
		{ type: "entry", slug: "longing", content: { text: "LONGING — Name the person…" }, track: { max: 1 },
			...(withBlanks ? { input: { type: "inline" } } : {}) },
	],
});

const pack = () => new TestInsertItemBuilder()
	.withId("pack-revenant").withSlug("revenant")
	.withDescription("When you refuse to go…")
	.withInstinct(INSTINCT)
	.withChoices([purpose(true)])
	.build();

const owned = over => new TestInsertItemBuilder()
	.withId("owned-revenant").withSlug("revenant").withName("My Revenant")
	.withDescription("stale")
	.withInstinct(INSTINCT)
	.withChoices([purpose(false)])
	.withChoiceValues({ "terrible-purpose": { longing: 1 }, instinct: { denial: 1 } })
	.build();

function setup(items = [owned()], packs = [pack()]) {
	const actor = new FakeCharacterActorBuilder().withItems(items).build();
	return { actor, repo: new FakeInsertRepository(packs) };
}

const itemIn = (actor, id = "owned-revenant") => actor.items.get(id);

describe("migrateInsertPackData", () => {
	it("brings the pack's choice groups onto an insert already in play", async () => {
		const { actor, repo } = setup();
		await migrateInsertPackData(actor, repo);
		const longing = itemIn(actor).system.choices[0].list.find(r => r.slug === "longing");
		expect(longing.input).toEqual({ type: "inline" });
	});

	it("refreshes the description", async () => {
		const { actor, repo } = setup();
		await migrateInsertPackData(actor, repo);
		expect(itemIn(actor).system.description).toBe("When you refuse to go…");
	});

	// Foundry merges an object-field update, so a plain write would keep a key the pack has dropped.
	it("drops an instinct key the pack removed", async () => {
		const stale = owned();
		stale.system.instinct = { ...INSTINCT, title: "A heading the pack has since dropped" };
		const { actor, repo } = setup([stale]);
		await migrateInsertPackData(actor, repo);
		expect(itemIn(actor).system.instinct).toEqual(INSTINCT);
	});

	it("keeps what the player chose and what they called it", async () => {
		const { actor, repo } = setup();
		await migrateInsertPackData(actor, repo);
		expect(itemIn(actor).system.choiceValues).toEqual({ "terrible-purpose": { longing: 1 }, instinct: { denial: 1 } });
		expect(itemIn(actor).name).toBe("My Revenant");
		for (const update of actor.updatedDocs) {
			expect(update).not.toHaveProperty("name");
			expect(update.system ?? {}).not.toHaveProperty("choiceValues");
		}
	});

	it("skips an insert the pack has never heard of", async () => {
		const homebrew = new TestInsertItemBuilder().withId("owned-banshee").withSlug("banshee").build();
		const { actor, repo } = setup([homebrew]);
		await migrateInsertPackData(actor, repo);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("ignores items that are not inserts", async () => {
		const { actor, repo } = setup([{ _id: "m1", type: "move", name: "Revenant", system: { slug: "revenant" } }]);
		await migrateInsertPackData(actor, repo);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("is idempotent", async () => {
		const { actor, repo } = setup();
		await migrateInsertPackData(actor, repo);
		const once = structuredClone(itemIn(actor).system);
		await migrateInsertPackData(actor, repo);
		expect(itemIn(actor).system).toEqual(once);
	});
});
