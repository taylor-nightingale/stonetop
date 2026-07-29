import { describe, it, expect } from "vitest";
import {
	Arcanum, ArcanumSide, ArcanumItem,
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
	title: "A bow with no string",
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

// Front and back share one ArcanumSide shape: header chrome + a `choices` array of groups.
describe("ArcanumSide", () => {
	it("stores title, wraps item, carries disguise tags (default null)", () => {
		const side = new ArcanumSide(FRONT_DATA);
		expect(side.title).toBe("A bow with no string");
		expect(side.item).toBeInstanceOf(ArcanumItem);
		expect(side.tags).toBeNull();
		expect(new ArcanumSide({ ...FRONT_DATA, item: null, tags: "magical, terrifying" }).tags).toBe("magical, terrifying");
	});

	it("item is null when absent; resource wraps when present", () => {
		expect(new ArcanumSide({ ...FRONT_DATA, item: null }).item).toBeNull();
		const withRes = new ArcanumSide({ ...BACK_DATA, resource: { max: 3, maxStat: null, title: "Tonic", labels: [] } });
		expect(withRes.resource).toBeInstanceOf(Resource);
		expect(withRes.resource.title).toBe("Tonic");
		expect(new ArcanumSide(BACK_DATA).resource).toBeNull();
	});

	it("keeps choices as an ordered array of groups", () => {
		const side = new ArcanumSide(BACK_DATA);
		expect(side.choices.map(g => g.slug)).toEqual(["moves", "consequences"]);
		expect(side.choices[0].list[0].grants[0]).toEqual({ type: "move", slug: "thunderbolt", locations: ["inline"] });
	});

	it("choices defaults to [] when absent", () => {
		expect(new ArcanumSide({ ...BACK_DATA, choices: undefined }).choices).toEqual([]);
	});

	it("wraps a legacy single-group choices object into a one-element array", () => {
		const side = new ArcanumSide({ ...BACK_DATA, choices: { slug: "g", list: [] } });
		expect(side.choices).toHaveLength(1);
		expect(side.choices[0].slug).toBe("g");
	});
});

describe("Arcanum — itemSameAsFront", () => {
	it("resolves back.item from front.item when itemSameAsFront is true", () => {
		const arcanum = new Arcanum({
			slug: "staff",
			front: { title: "Staff", item: { name: "Staff", weight: 1, note: null, inventoryColumn: null } },
			back: { title: "Mysteries", itemSameAsFront: true },
		});
		expect(arcanum.back.item).toBeInstanceOf(ArcanumItem);
		expect(arcanum.back.item.name).toBe("Staff");
	});

	it("back.item is null via itemSameAsFront when front.item is null", () => {
		const arcanum = new Arcanum({
			slug: "markings",
			front: { title: "Storm Markings", item: null },
			back: { title: "Mysteries", itemSameAsFront: true },
		});
		expect(arcanum.back.item).toBeNull();
	});
});

describe("Arcanum", () => {
	it("stores slug; front and back are ArcanumSide", () => {
		const arcanum = new Arcanum(ARCANUM_DATA);
		expect(arcanum.slug).toBe("bow-with-no-string");
		expect(arcanum.front).toBeInstanceOf(ArcanumSide);
		expect(arcanum.back).toBeInstanceOf(ArcanumSide);
	});

	it("back.item.resource is Resource", () => {
		expect(new Arcanum(ARCANUM_DATA).back.item.resource).toBeInstanceOf(Resource);
	});

	it("name/img default to null when absent", () => {
		const arcanum = new Arcanum(ARCANUM_DATA);
		expect(arcanum.name).toBeNull();
		expect(arcanum.img).toBeNull();
	});
});
