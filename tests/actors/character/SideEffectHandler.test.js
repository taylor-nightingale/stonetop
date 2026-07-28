import { describe, it, expect } from "vitest";
import { FollowerSideEffectHandler } from "../../../src/actors/character/SideEffectHandler.js";
import { ChoiceValueChange } from "../../../src/model/data/ChoiceValueChange.js";
import { ChoiceValues } from "../../../src/model/snapshot/character/ChoiceGroup.js";
import { FakeFollowers } from "../../fakes/FakeFollowers.js";

// The follower effect is a subscriber: it owns its own relevance test, so it must ignore writes that
// carry no row (a namespace clear) and writes that cannot change a count (text).

/** An item whose one choice group holds `row` — so the change resolves a real target. */
function changeFor(row, { count = 1, kind = "count", optionSlug = "opt" } = {}) {
	const item = {
		_id: "i1", type: "insert",
		system: { choices: { slug: "ns", list: [{ type: "entry", slug: "opt", ...row }] } },
	};
	return new ChoiceValueChange({
		item, namespace: "ns", optionSlug, count, kind, values: new ChoiceValues({}),
	});
}

describe("FollowerSideEffectHandler", () => {
	it("marking a row puts its followers on the tab (count > 0)", async () => {
		const followers = new FakeFollowers();
		await new FollowerSideEffectHandler(followers).handle(
			changeFor({ grants: [{ type: "follower", slug: "enfys", locations: ["tab"] }, { type: "follower", slug: "afon", locations: ["tab"] }] }, { count: 1 }));
		expect(followers.showOnTab("enfys")).toBe(true);
		expect(followers.showOnTab("afon")).toBe(true);
	});

	it("un-marking toggles the follower off the tab but keeps it owned (count === 0)", async () => {
		const followers = new FakeFollowers();
		await followers.addFollower("enfys");
		await new FollowerSideEffectHandler(followers).handle(
			changeFor({ grants: [{ type: "follower", slug: "enfys", locations: ["tab"] }] }, { count: 0 }));
		expect(followers.isOwned("enfys")).toBe(true);
		expect(followers.showOnTab("enfys")).toBe(false);
	});

	it("a card-bound follower (no tab location) stays off the tab even when marked", async () => {
		const followers = new FakeFollowers();
		await new FollowerSideEffectHandler(followers).handle(
			changeFor({ grants: [{ type: "follower", slug: "the-cloak", locations: ["inline"] }] }, { count: 1 }));
		expect(followers.isOwned("the-cloak")).toBe(true);
		expect(followers.showOnTab("the-cloak")).toBe(false);
	});

	it("no-ops when the target row has no followers field", async () => {
		const followers = new FakeFollowers();
		await new FollowerSideEffectHandler(followers).handle(changeFor({}));
		expect(followers.owned).toHaveLength(0);
	});

	it("no-ops when the follower link has no slugs", async () => {
		const followers = new FakeFollowers();
		await new FollowerSideEffectHandler(followers).handle(
			changeFor({ followers: { slugs: [], inlineDisplay: true } }));
		expect(followers.owned).toHaveLength(0);
	});

	it("no-ops on an unmigrated legacy slug array (migration owns the conversion)", async () => {
		const followers = new FakeFollowers();
		await new FollowerSideEffectHandler(followers).handle(changeFor({ followers: ["enfys"] }));
		expect(followers.owned).toHaveLength(0);
	});

	it("ignores a text write — text never changes what a choice grants", async () => {
		const followers = new FakeFollowers();
		await new FollowerSideEffectHandler(followers).handle(
			changeFor({ followers: { slugs: ["enfys"] } }, { kind: "text" }));
		expect(followers.owned).toHaveLength(0);
	});

	it("ignores a namespace clear — it names no row to act on", async () => {
		const followers = new FakeFollowers();
		await new FollowerSideEffectHandler(followers).handle(
			changeFor({ followers: { slugs: ["enfys"] } }, { kind: "clear", optionSlug: null }));
		expect(followers.owned).toHaveLength(0);
	});

	it("no-ops when no row matches the option that changed", async () => {
		const followers = new FakeFollowers();
		await new FollowerSideEffectHandler(followers).handle(
			changeFor({ followers: { slugs: ["enfys"] } }, { optionSlug: "nope" }));
		expect(followers.owned).toHaveLength(0);
	});
});
