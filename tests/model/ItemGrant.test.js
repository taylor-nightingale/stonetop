import { describe, it, expect } from "vitest";
import { GrantSource, GrantStamp, ItemGrant, ItemGrantSet } from "../../src/model/data/ItemGrant.js";

describe("ItemGrant", () => {
	it("keys itself from the payload it carries", () => {
		const grant = new ItemGrant({ name: "Bulwark", type: "move", system: { slug: "bulwark" } });
		expect(grant.key).toBe("move:bulwark");
		expect(grant.itemData.name).toBe("Bulwark");
	});

	it("stamps its source and key onto a copy of the payload", () => {
		const data  = { name: "Bulwark", type: "move", system: { slug: "bulwark" } };
		const grant = new ItemGrant(data);
		expect(grant.stamped("playbook:the-heavy").flags.stonetop.grant)
			.toEqual({ source: "playbook:the-heavy", key: "move:bulwark" });
		expect(data.flags).toBeUndefined();
	});

	it("keeps flags the payload already carries", () => {
		const grant = new ItemGrant({
			name: "Revenant", type: "insert", system: { slug: "revenant" },
			flags: { core: { sourceId: "x" }, stonetop: { pinned: true } },
		});
		const stamped = grant.stamped("playbook:the-blessed");
		expect(stamped.flags.core).toEqual({ sourceId: "x" });
		expect(stamped.flags.stonetop.pinned).toBe(true);
		expect(stamped.flags.stonetop.grant.key).toBe("insert:revenant");
	});
});

describe("ItemGrant.keyOf", () => {
	// One derivation for both sides: a grant and an item on the actor cannot disagree about what the
	// same thing is called.
	it("keys an item on the actor the same way a grant keys itself", () => {
		const item = { type: "move", name: "Bulwark", system: { slug: "bulwark" } };
		expect(ItemGrant.keyOf(item)).toBe(new ItemGrant(item).key);
	});

	it("keeps the same slug distinct across item types", () => {
		expect(ItemGrant.keyOf({ type: "move", name: "Crew", system: { slug: "crew" } }))
			.not.toBe(ItemGrant.keyOf({ type: "follower", name: "Crew", system: { slug: "crew" } }));
	});

	it("falls back to the name when the item stores no slug", () => {
		expect(ItemGrant.keyOf({ type: "move", name: "Invoke the Gods" })).toBe("move:invoke-the-gods");
	});

	it("prefers the stored slug over the name — a renamed move is still the same move", () => {
		expect(ItemGrant.keyOf({ type: "move", name: "Renamed", system: { slug: "bulwark" } })).toBe("move:bulwark");
	});

	it("is null for an item with no type or nothing to slug", () => {
		expect(ItemGrant.keyOf({ name: "typeless" })).toBeNull();
		expect(ItemGrant.keyOf({ type: "move", name: "" })).toBeNull();
		expect(ItemGrant.keyOf(null)).toBeNull();
	});
});

describe("ItemGrantSet.mergeBySource", () => {
	it("merges every set that shares a source into one", () => {
		const merged = ItemGrantSet.mergeBySource([
			new ItemGrantSet("playbook:the-heavy", [new ItemGrant({ type: "move", system: { slug: "bulwark" } })]),
			new ItemGrantSet("playbook:the-heavy", [new ItemGrant({ type: "follower", system: { slug: "crew" } })]),
		]);
		expect(merged).toHaveLength(1);
		expect(merged[0].keys).toEqual(["move:bulwark", "follower:crew"]);
	});

	// The regression this exists for: applied separately, the empty set reads as "this playbook wants
	// nothing" and deletes what the set before it just granted.
	it("does not let an empty set from the same source stand alone", () => {
		const merged = ItemGrantSet.mergeBySource([
			new ItemGrantSet("playbook:the-heavy", [new ItemGrant({ type: "move", system: { slug: "bulwark" } })]),
			ItemGrantSet.empty("playbook:the-heavy"),
		]);
		expect(merged).toHaveLength(1);
		expect(merged[0].keys).toEqual(["move:bulwark"]);
	});

	it("keeps different sources apart, in first-seen order", () => {
		const merged = ItemGrantSet.mergeBySource([
			new ItemGrantSet("arcana:the-ring", [new ItemGrant({ type: "move", system: { slug: "call-forth" } })]),
			new ItemGrantSet("playbook:the-heavy", [new ItemGrant({ type: "move", system: { slug: "bulwark" } })]),
		]);
		expect(merged.map(s => s.source)).toEqual(["arcana:the-ring", "playbook:the-heavy"]);
	});

	it("returns nothing for no sets", () => {
		expect(ItemGrantSet.mergeBySource([])).toEqual([]);
	});
});

describe("GrantSource", () => {
	it("names each kind of granting source", () => {
		expect(GrantSource.playbook("the-heavy")).toBe("playbook:the-heavy");
		expect(GrantSource.insert("revenant")).toBe("insert:revenant");
		expect(GrantSource.arcanum("the-ring")).toBe("arcana:the-ring");
		expect(GrantSource.reference("basic")).toBe("reference:basic");
	});

	it("keeps the same slug distinct across source kinds", () => {
		expect(GrantSource.playbook("x")).not.toBe(GrantSource.insert("x"));
	});

	// A card's gear and the followers the same card grants would otherwise answer to one source, and
	// clearing the gear on a flip would take the followers with it.
	it("gives a container's gear a source of its own", () => {
		expect(GrantSource.outfit("arcana:the-ring")).toBe("outfit:arcana:the-ring");
		expect(GrantSource.outfit("arcana:the-ring")).not.toBe(GrantSource.arcanum("the-ring"));
	});

	it("reads the source out of a move's category key", () => {
		expect(GrantSource.forCategoryKey("playbook-the-heavy")).toBe("playbook:the-heavy");
		expect(GrantSource.forCategoryKey("insert-revenant")).toBe("insert:revenant");
		expect(GrantSource.forCategoryKey("arcana-the-ring")).toBe("arcana:the-ring");
		expect(GrantSource.forCategoryKey("basic")).toBe("reference:basic");
	});

	it("gives no source for a move the player dropped in", () => {
		expect(GrantSource.forCategoryKey("other")).toBeNull();
		expect(GrantSource.forCategoryKey(null)).toBeNull();
	});

	it("recognises a playbook source — what makes a possession one of its picks", () => {
		expect(GrantSource.isPlaybook(GrantSource.playbook("the-heavy"))).toBe(true);
		expect(GrantSource.isPlaybook(GrantSource.arcanum("the-ring"))).toBe(false);
		expect(GrantSource.isPlaybook(undefined)).toBe(false);
	});
});

describe("ItemGrantSet", () => {
	it("exposes its source, grants and keys", () => {
		const set = new ItemGrantSet("playbook:the-heavy", [
			new ItemGrant({ name: "Bulwark", type: "move", system: { slug: "bulwark" } }),
			new ItemGrant({ name: "Armored", type: "move", system: { slug: "armored" } }),
		]);
		expect(set.source).toBe("playbook:the-heavy");
		expect(set.keys).toEqual(["move:bulwark", "move:armored"]);
		expect(set.isEmpty).toBe(false);
	});

	it("empty() is a set with nothing to say — not an instruction to delete", () => {
		const set = ItemGrantSet.empty("playbook:the-heavy");
		expect(set.source).toBe("playbook:the-heavy");
		expect(set.grants).toEqual([]);
		expect(set.isEmpty).toBe(true);
	});

	it("defaults to no grants", () => {
		expect(new ItemGrantSet("arcana:the-ring").isEmpty).toBe(true);
	});
});

describe("GrantStamp", () => {
	it("reads the stamp off an item", () => {
		const stamp = GrantStamp.of({ flags: { stonetop: { grant: { source: "playbook:the-heavy", key: "move:bulwark" } } } });
		expect(stamp.source).toBe("playbook:the-heavy");
		expect(stamp.key).toBe("move:bulwark");
	});

	it("returns null for an unstamped item — an authored item is nobody's grant", () => {
		expect(GrantStamp.of({ name: "A follower the player added" })).toBeNull();
		expect(GrantStamp.of({ flags: { stonetop: {} } })).toBeNull();
		expect(GrantStamp.of(null)).toBeNull();
	});

	it("ignores a partial stamp (source or key missing)", () => {
		expect(GrantStamp.of({ flags: { stonetop: { grant: { source: "playbook:x" } } } })).toBeNull();
		expect(GrantStamp.of({ flags: { stonetop: { grant: { key: "move:y" } } } })).toBeNull();
	});

	it("matches an item against a source", () => {
		const item = { flags: { stonetop: { grant: { source: "arcana:the-ring", key: "move:call-forth" } } } };
		expect(GrantStamp.matches(item, "arcana:the-ring")).toBe(true);
		expect(GrantStamp.matches(item, "playbook:the-heavy")).toBe(false);
		expect(GrantStamp.matches({ name: "authored" }, "arcana:the-ring")).toBe(false);
	});
});
