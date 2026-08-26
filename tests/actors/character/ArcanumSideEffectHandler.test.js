import { describe, it, expect } from "vitest";
import { ArcanumSideEffectHandler } from "../../../src/actors/character/ArcanumSideEffectHandler.js";
import { ChoiceValueChange } from "../../../src/model/data/ChoiceValueChange.js";
import { ChoiceValues } from "../../../src/model/snapshot/character/ChoiceGroup.js";

// The arcanum effect is a subscriber: it owns its own relevance test, so it must ignore writes that
// carry no row (a namespace clear) and writes that cannot change a count (text). Unlike a follower, the
// card is owned BECAUSE of the mark — clearing the mark hands it back.

class FakeArcana {
	constructor() { this._owned = new Set(); }
	async addArcanum(slug)    { this._owned.add(slug); }
	async removeArcanum(slug) { this._owned.delete(slug); }
	isOwned(slug) { return this._owned.has(slug); }
	get owned()   { return [...this._owned]; }
}

/** An item whose one choice group holds `row` — so the change resolves a real target. */
function changeFor(row, { count = 1, kind = "count", optionSlug = "opt" } = {}) {
	const item = {
		_id: "i1", type: "playbook",
		system: { choices: { slug: "ns", list: [{ type: "entry", slug: "opt", ...row }] } },
	};
	return new ChoiceValueChange({
		item, namespace: "ns", optionSlug, count, kind, values: new ChoiceValues({}),
	});
}

const arcanumGrant = slug => ({ grants: [{ type: "arcanum", slug, locations: ["tab"] }] });

describe("ArcanumSideEffectHandler", () => {
	it("marking a row hands the character the arcanum it grants (count > 0)", async () => {
		const arcana = new FakeArcana();
		await new ArcanumSideEffectHandler(arcana).handle(changeFor(arcanumGrant("red-scepter"), { count: 1 }));
		expect(arcana.isOwned("red-scepter")).toBe(true);
	});

	it("marks every arcanum a row grants", async () => {
		const arcana = new FakeArcana();
		await new ArcanumSideEffectHandler(arcana).handle(changeFor({
			grants: [
				{ type: "arcanum", slug: "azure-hand", locations: ["tab"] },
				{ type: "arcanum", slug: "mindgem", locations: ["tab"] },
			],
		}, { count: 1 }));
		expect(arcana.owned.sort()).toEqual(["azure-hand", "mindgem"]);
	});

	it("un-marking takes the card back (count === 0)", async () => {
		const arcana = new FakeArcana();
		await arcana.addArcanum("red-scepter");
		await new ArcanumSideEffectHandler(arcana).handle(changeFor(arcanumGrant("red-scepter"), { count: 0 }));
		expect(arcana.isOwned("red-scepter")).toBe(false);
	});

	it("ignores a text write, which cannot change what a row grants", async () => {
		const arcana = new FakeArcana();
		await new ArcanumSideEffectHandler(arcana).handle(
			changeFor(arcanumGrant("red-scepter"), { kind: "text", count: null }));
		expect(arcana.owned).toHaveLength(0);
	});

	it("ignores a namespace clear, which targets no single row", async () => {
		const arcana = new FakeArcana();
		await arcana.addArcanum("red-scepter");
		await new ArcanumSideEffectHandler(arcana).handle(
			changeFor(arcanumGrant("red-scepter"), { kind: "clear", optionSlug: null, count: null }));
		expect(arcana.isOwned("red-scepter")).toBe(true);
	});

	it("leaves another type's grants to that type's own handler", async () => {
		const arcana = new FakeArcana();
		await new ArcanumSideEffectHandler(arcana).handle(changeFor({
			grants: [{ type: "follower", slug: "enfys", locations: ["tab"] }],
		}, { count: 1 }));
		expect(arcana.owned).toHaveLength(0);
	});

	it("no-ops on a row that grants nothing", async () => {
		const arcana = new FakeArcana();
		await new ArcanumSideEffectHandler(arcana).handle(changeFor({}));
		expect(arcana.owned).toHaveLength(0);
	});
});
