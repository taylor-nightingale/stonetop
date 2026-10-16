import { describe, it, expect, vi, afterEach } from "vitest";
import { migrateWorldImprovementRules } from "../../src/migration/migrateWorldImprovementRules.js";
import { ImprovementRequirements } from "../../src/model/data/steading/ImprovementRequirements.js";
import { warn } from "../../src/utils/logger.js";

vi.mock("../../src/utils/logger.js", () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }));

const improvement = (id, system, type = "improvement") => ({ id, type, system: { slug: `slug-${id}`, ...system } });
const tracked = (...slugs) => ({ slug: "w", list: [
	{ type: "entry", slug: "intro", track: null },
	...slugs.map(slug => ({ type: "entry", slug, track: { max: 1 } })),
] });

function stub(items) {
	const updateDocuments = vi.fn(async () => {});
	vi.stubGlobal("game", { ...globalThis.game, items });
	vi.stubGlobal("Item", { updateDocuments });
	return updateDocuments;
}

afterEach(() => vi.unstubAllGlobals());

/**
 * A custom improvement saved before 1.6.0 has rows and no rule. Then, finishing one meant ticking
 * every box; since, no rule reads as "requires nothing", and the card counts it finished before a
 * single box is ticked. The rule written is the one the improvement always meant.
 */
describe("migrateWorldImprovementRules", () => {
	it("writes every tracked row as the rule of an improvement that has none", async () => {
		const update = stub([improvement("a", { choices: tracked("timber", "raise"), requires: null })]);
		await migrateWorldImprovementRules();
		expect(update).toHaveBeenCalledWith([{ _id: "a", system: { requires: { all: ["timber", "raise"] } } }]);
	});

	// The editor reads every rule as sections of the rows; the migration is one of the writers held to
	// that, whatever the layout — tracked rows split by lines of text included.
	it("writes a rule the editor reads back exactly, however the rows are laid out", async () => {
		const choices = { slug: "w", list: [
			{ type: "entry", content: { text: "Requires:" }, track: null },
			{ type: "entry", slug: "a", track: { max: 1 } },
			{ type: "entry", content: { text: "And then:" }, track: null },
			{ type: "entry", slug: "b", track: { max: 2 } },
			{ type: "entry", slug: "c", track: { max: 1 } },
		] };
		const update = stub([improvement("a", { choices, requires: null })]);
		await migrateWorldImprovementRules();
		const written = update.mock.calls[0][0][0].system.requires;
		const read = ImprovementRequirements.fromStored(choices, written, { heading: () => null }, "w");
		expect(read.toRequires()).toEqual(written);
		expect(warn).not.toHaveBeenCalled();
	});

	it("leaves a rule the author wrote alone, even one requiring nothing", async () => {
		const update = stub([
			improvement("a", { choices: tracked("timber"), requires: { any: 1, of: ["timber"] } }),
			improvement("b", { choices: tracked("timber"), requires: { all: [] } }),
		]);
		await migrateWorldImprovementRules();
		expect(update).not.toHaveBeenCalled();
	});

	it("writes nothing for an improvement with no tracked rows, which no rule would change", async () => {
		const update = stub([improvement("a", { choices: tracked(), requires: null })]);
		await migrateWorldImprovementRules();
		expect(update).not.toHaveBeenCalled();
	});

	// The sheet used to mint a slug while it rendered; one nobody opened never got one.
	it("gives an improvement with no slug one of its own, and a choices group under it", async () => {
		const update = stub([{ id: "a", type: "improvement", system: { slug: null, choices: null, requires: null } }]);
		await migrateWorldImprovementRules();
		const [[{ system }]] = update.mock.calls[0];
		expect(system.slug).toMatch(/^custom-improvement-/);
		expect(system.choices).toEqual({ slug: system.slug, list: [] });
	});

	it("touches only improvements", async () => {
		const update = stub([improvement("a", { choices: tracked("timber"), requires: null }, "move")]);
		await migrateWorldImprovementRules();
		expect(update).not.toHaveBeenCalled();
	});
});
