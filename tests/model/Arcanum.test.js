import { describe, it, expect } from "vitest";
import {
	Arcanum, ArcanumFront, ArcanumBack, ArcanumItem,
} from "../../src/model/data/character/Arcanum.js";
import { Resource } from "../../src/model/data/Resource.js";

// -- Fixtures -----------------------------------------------------------------

const ITEM_DATA = {
	name: "Thunderbolt Bow",
	weight: 1,
	note: "<em>magical</em>",
	inventoryColumn: "regular",
	resource: { max: 3, maxStat: null, title: "Ammo", labels: ["plenty left", "low ammo", "all out"] },
};

const FRONT_DATA = {
	item: { name: "A bow with no string", weight: 1, note: null, inventoryColumn: "regular" },
	choices: [{ slug: "bow-with-no-string", list: [
		{ type: "entry", content: { text: "An ancient bow." } },
		{ type: "entry", slug: "marks", track: { max: 4 } },
	] }],
};

const BACK_DATA = {
	title: "Thunderbolt Bow",
	item: ITEM_DATA,
	resource: null,
	choices: [
		{ slug: "moves", title: "Moves", list: [{ type: "entry", slug: "thunderbolt", track: { max: 1 }, grants: [{ type: "move", slug: "thunderbolt", locations: ["inline"] }] }] },
		{ slug: "consequences", title: "Consequences", list: [{ type: "entry", slug: "c1", content: { text: "A cost." }, track: { max: 1 } }] },
	],
};

const ARCANUM_DATA = {
	slug: "bow-with-no-string",
	name: "A bow with no string",
	front: FRONT_DATA,
	back: BACK_DATA,
};

// -- Tests --------------------------------------------------------------------

describe("ArcanumItem", () => {
	it("stores name, weight, note, inventoryColumn", () => {
		const item = new ArcanumItem(ITEM_DATA);
		expect(item.name).toBe("Thunderbolt Bow");
		expect(item.weight).toBe(1);
		expect(item.note).toBe("<em>magical</em>");
		expect(item.inventoryColumn).toBe("regular");
	});

	it("wraps resource in Resource when present", () => {
		const item = new ArcanumItem(ITEM_DATA);
		expect(item.resource).toBeInstanceOf(Resource);
		expect(item.resource.max).toBe(3);
		expect(item.resource.title).toBe("Ammo");
	});

	it("resource is null when absent", () => {
		expect(new ArcanumItem({ ...ITEM_DATA, resource: undefined }).resource).toBeNull();
	});

	it("defaults weight/note/inventoryColumn to null", () => {
		const item = new ArcanumItem({ name: "x" });
		expect(item.weight).toBeNull();
		expect(item.note).toBeNull();
		expect(item.inventoryColumn).toBeNull();
	});
});

// The front carries header chrome + a `choices` array of groups, and NO title of its own — the arcanum's
// document name is its heading.
describe("ArcanumFront", () => {
	it("has no title field at all", () => {
		expect("title" in new ArcanumFront(FRONT_DATA)).toBe(false);
		// Even when stale pre-migration data still carries one, it is not picked up.
		expect(new ArcanumFront({ ...FRONT_DATA, title: "A bow with no string" }).title).toBeUndefined();
	});

	it("wraps item, carries disguise tags (default null)", () => {
		const front = new ArcanumFront(FRONT_DATA);
		expect(front.item).toBeInstanceOf(ArcanumItem);
		expect(front.tags).toBeNull();
		expect(new ArcanumFront({ ...FRONT_DATA, item: null, tags: "magical, terrifying" }).tags).toBe("magical, terrifying");
	});

	it("item is null when absent; resource wraps when present", () => {
		expect(new ArcanumFront({ ...FRONT_DATA, item: null }).item).toBeNull();
		expect(new ArcanumFront(FRONT_DATA).resource).toBeNull();
		const withRes = new ArcanumFront({ ...FRONT_DATA, resource: { max: 3, maxStat: null, title: "Tonic", labels: [] } });
		expect(withRes.resource).toBeInstanceOf(Resource);
		expect(withRes.resource.title).toBe("Tonic");
	});

	it("keeps choices as an ordered array of groups; defaults to []", () => {
		expect(new ArcanumFront(FRONT_DATA).choices.map(g => g.slug)).toEqual(["bow-with-no-string"]);
		expect(new ArcanumFront({ ...FRONT_DATA, choices: undefined }).choices).toEqual([]);
	});
});

// The back is the front's chrome plus its OWN title — the mystery's name — and the itemSameAsFront flag.
describe("ArcanumBack", () => {
	it("stores its own authored title (the mystery's name), default null", () => {
		expect(new ArcanumBack(BACK_DATA).title).toBe("Thunderbolt Bow");
		expect(new ArcanumBack({ ...BACK_DATA, title: undefined }).title).toBeNull();
	});

	it("wraps item and resource; carries tags", () => {
		const back = new ArcanumBack(BACK_DATA);
		expect(back.item).toBeInstanceOf(ArcanumItem);
		expect(back.item.resource).toBeInstanceOf(Resource);
		expect(back.resource).toBeNull();
		expect(back.tags).toBeNull();
		const withRes = new ArcanumBack({ ...BACK_DATA, tags: "eerie", resource: { max: 3, maxStat: null, title: "Tonic", labels: [] } });
		expect(withRes.tags).toBe("eerie");
		expect(withRes.resource).toBeInstanceOf(Resource);
		expect(withRes.resource.title).toBe("Tonic");
	});

	it("keeps choices as an ordered array of groups", () => {
		const back = new ArcanumBack(BACK_DATA);
		expect(back.choices.map(g => g.slug)).toEqual(["moves", "consequences"]);
		expect(back.choices[0].list[0].grants[0]).toEqual({ type: "move", slug: "thunderbolt", locations: ["inline"] });
	});

	it("choices defaults to [] when absent", () => {
		expect(new ArcanumBack({ ...BACK_DATA, choices: undefined }).choices).toEqual([]);
	});

	it("wraps a legacy single-group choices object into a one-element array", () => {
		const back = new ArcanumBack({ ...BACK_DATA, choices: { slug: "g", list: [] } });
		expect(back.choices).toHaveLength(1);
		expect(back.choices[0].slug).toBe("g");
	});

	it("takes its item from the passed front item data when itemSameAsFront is set", () => {
		const back = new ArcanumBack({ title: "Mysteries", itemSameAsFront: true }, { name: "Staff", weight: 1 });
		expect(back.item).toBeInstanceOf(ArcanumItem);
		expect(back.item.name).toBe("Staff");
	});

	it("item is null via itemSameAsFront when there is no front item", () => {
		expect(new ArcanumBack({ title: "Mysteries", itemSameAsFront: true }, null).item).toBeNull();
	});

	it("ignores the passed front item when itemSameAsFront is not set", () => {
		const back = new ArcanumBack({ title: "Mysteries", item: null }, { name: "Staff", weight: 1 });
		expect(back.item).toBeNull();
	});
});

describe("Arcanum", () => {
	it("stores slug/name; front is an ArcanumFront and back an ArcanumBack", () => {
		const arcanum = new Arcanum(ARCANUM_DATA);
		expect(arcanum.slug).toBe("bow-with-no-string");
		expect(arcanum.name).toBe("A bow with no string");
		expect(arcanum.front).toBeInstanceOf(ArcanumFront);
		expect(arcanum.back).toBeInstanceOf(ArcanumBack);
	});

	it("back.item.resource is Resource", () => {
		expect(new Arcanum(ARCANUM_DATA).back.item.resource).toBeInstanceOf(Resource);
	});

	it("hands the front's raw item data to the back for itemSameAsFront", () => {
		const arcanum = new Arcanum({
			slug: "staff",
			name: "Staff of the Lidless Orb",
			front: { item: { name: "Staff", weight: 1, note: null, inventoryColumn: null } },
			back: { title: "Mysteries of the Staff", itemSameAsFront: true },
		});
		expect(arcanum.back.item.name).toBe("Staff");
	});

	it("name/img default to null when absent", () => {
		const arcanum = new Arcanum({ ...ARCANUM_DATA, name: undefined });
		expect(arcanum.name).toBeNull();
		expect(arcanum.img).toBeNull();
	});

	// `front`/`back` are nullable ObjectFields — an unauthored side is stored as null, not undefined.
	it.each([["absent", undefined], ["null", null]])("tolerates a %s front/back", (_label, side) => {
		const arcanum = new Arcanum({ slug: "x", name: "X", front: side, back: side });
		expect(arcanum.front.choices).toEqual([]);
		expect(arcanum.front.item).toBeNull();
		expect(arcanum.back.title).toBeNull();
		expect(arcanum.back.choices).toEqual([]);
	});
});
