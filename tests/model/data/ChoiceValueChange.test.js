import { describe, it, expect } from "vitest";
import { ChoiceValueChange } from "../../../src/model/data/ChoiceValueChange.js";
import { ChoiceValues } from "../../../src/model/snapshot/character/ChoiceGroup.js";

// One event is published per write and every subscriber sees it; each decides what it cares about.
// The event carries enough context that a subscriber never needs the controller's help resolving it,
// and resolves the group/row lazily so N subscribers don't each pay for the lookup.

const ITEM = {
	_id: "arc-1", type: "arcanum",
	system: {
		slug: "ring-of-daagon",
		front: { unlock: { slug: "ring-of-daagon", list: [
			{ type: "entry", slug: "the-ring", followers: { slugs: ["the-ring"] }, track: { max: 1 } },
		]}},
		back: { choices: { slug: "back", list: [
			{ type: "pick", pickCount: 1, options: [{ slug: "blade", text: "Blade" }] },
		]}},
	},
};

const change = (over = {}) => new ChoiceValueChange({
	item: ITEM, namespace: "ring-of-daagon", optionSlug: "the-ring",
	count: 1, values: new ChoiceValues({}), kind: "count", ...over,
});

describe("ChoiceValueChange", () => {
	it("carries the item that was written to", () => {
		expect(change().item).toBe(ITEM);
	});

	it("resolves the group definition structurally, including groups outside system.choices", () => {
		expect(change().groupDef.slug).toBe("ring-of-daagon");
	});

	it("resolves the row the write targeted", () => {
		expect(change().target.slug).toBe("the-ring");
	});

	it("resolves a pick option as the target too", () => {
		expect(change({ namespace: "back", optionSlug: "blade" }).target.text).toBe("Blade");
	});

	it("target is null when nothing matches, so subscribers can bail", () => {
		expect(change({ optionSlug: "nope" }).target).toBeNull();
		expect(change({ namespace: "nope" }).groupDef).toBeNull();
	});

	it("finds the target when several groups share the namespace (arcana front + back)", () => {
		// front.unlock and back.choices both carry the arcanum's slug and share one value store.
		const item = {
			_id: "arc-2", type: "arcanum",
			system: {
				slug: "cracked-flute",
				front: { unlock: { slug: "cracked-flute", list: [] } },
				back:  { choices: { slug: "cracked-flute", list: [
					{ type: "entry", slug: "andalau", followers: { slugs: ["andalau"] }, track: { max: 1 } },
				]}},
			},
		};
		const c = new ChoiceValueChange({
			item, namespace: "cracked-flute", optionSlug: "andalau",
			count: 1, values: new ChoiceValues({}), kind: "count",
		});
		expect(c.target.slug).toBe("andalau");
		expect(c.groupDef.list).toHaveLength(1);   // the group that actually holds it
	});

	it("resolves lazily and only once, however many subscribers ask", () => {
		const c = change();
		expect(c.groupDef).toBe(c.groupDef);
		expect(c.target).toBe(c.target);
	});

	it("count and clear writes affect counts; text writes do not", () => {
		expect(change({ kind: "count" }).affectsCounts).toBe(true);
		expect(change({ kind: "clear" }).affectsCounts).toBe(true);
		expect(change({ kind: "text"  }).affectsCounts).toBe(false);
	});

	it("a clear names its namespace but no option", () => {
		const c = change({ kind: "clear", optionSlug: null, count: null });
		expect(c.namespace).toBe("ring-of-daagon");
		expect(c.target).toBeNull();
	});
});
