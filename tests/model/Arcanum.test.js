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
	title: "A bow with no string",
	item: { name: "A bow with no string", weight: 1, note: null, inventoryColumn: "regular" },
	description: "<p>An ancient bow.</p>",
	unlock: { description: "Unlock by…", requirements: [] },
};

const BACK_DATA = {
	title: "Thunderbolt Bow",
	item: ITEM_DATA,
	description: "<p>Crackles with lightning.</p>",
	resource: null,
	moves: [{ name: "When you speak the secret word", text: "<p>Lightning appears.</p>" }],
	options: [],
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
		const item = new ArcanumItem({ ...ITEM_DATA, resource: undefined });
		expect(item.resource).toBeNull();
	});

	it("defaults weight to null", () => {
		expect(new ArcanumItem({ name: "x" }).weight).toBeNull();
	});

	it("defaults note to null", () => {
		expect(new ArcanumItem({ name: "x" }).note).toBeNull();
	});

	it("defaults inventoryColumn to null", () => {
		expect(new ArcanumItem({ name: "x" }).inventoryColumn).toBeNull();
	});
});


describe("ArcanumFront", () => {
	it("stores title and description", () => {
		const front = new ArcanumFront(FRONT_DATA);
		expect(front.title).toBe("A bow with no string");
		expect(front.description).toBe("<p>An ancient bow.</p>");
	});

	it("wraps item in ArcanumItem when present", () => {
		expect(new ArcanumFront(FRONT_DATA).item).toBeInstanceOf(ArcanumItem);
	});

	it("item is null when absent", () => {
		expect(new ArcanumFront({ ...FRONT_DATA, item: null }).item).toBeNull();
	});

	it("passes unlock through unchanged", () => {
		const front = new ArcanumFront(FRONT_DATA);
		expect(front.unlock).toBe(FRONT_DATA.unlock);
	});

});

describe("ArcanumBack", () => {
	it("stores title and description", () => {
		const back = new ArcanumBack(BACK_DATA);
		expect(back.title).toBe("Thunderbolt Bow");
		expect(back.description).toBe("<p>Crackles with lightning.</p>");
	});

	it("wraps item in ArcanumItem when present", () => {
		expect(new ArcanumBack(BACK_DATA).item).toBeInstanceOf(ArcanumItem);
	});

	it("item is null when absent", () => {
		expect(new ArcanumBack({ ...BACK_DATA, item: null }).item).toBeNull();
	});

	it("wraps resource in Resource when present", () => {
		const back = new ArcanumBack({ ...BACK_DATA, resource: { max: 3, maxStat: null, title: "Tonic", labels: [] } });
		expect(back.resource).toBeInstanceOf(Resource);
		expect(back.resource.title).toBe("Tonic");
	});

	it("resource is null when absent", () => {
		expect(new ArcanumBack(BACK_DATA).resource).toBeNull();
	});

	it("wraps moves in ArcanumMysteryMove", () => {
		const back = new ArcanumBack(BACK_DATA);
		expect(back.moves).toHaveLength(1);
		expect(back.moves[0].name).toBe("When you speak the secret word");
		expect(back.moves[0].text).toBe("<p>Lightning appears.</p>");
	});

	it("options defaults to []", () => {
		expect(new ArcanumBack({ ...BACK_DATA, options: undefined }).options).toEqual([]);
	});

	it("moves defaults to [] when absent", () => {
		expect(new ArcanumBack({ ...BACK_DATA, moves: undefined }).moves).toEqual([]);
	});

	it("consequences defaults to null when absent", () => {
		expect(new ArcanumBack(BACK_DATA).consequences).toBeNull();
	});

	it("unlockAt defaults to null when absent", () => {
		expect(new ArcanumBack(BACK_DATA).unlockAt).toBeNull();
	});
});

describe("Arcanum — itemSameAsFront", () => {
	it("resolves back.item from front.item when itemSameAsFront is true", () => {
		const data = {
			slug: "staff",
			front: { title: "Staff", item: { name: "Staff", weight: 1, note: null, inventoryColumn: null } },
			back: { title: "Mysteries", itemSameAsFront: true },
		};
		const arcanum = new Arcanum(data);
		expect(arcanum.back.item).toBeInstanceOf(ArcanumItem);
		expect(arcanum.back.item.name).toBe("Staff");
	});

	it("back.item is null via itemSameAsFront when front.item is null", () => {
		const data = {
			slug: "markings",
			front: { title: "Storm Markings", item: null },
			back: { title: "Mysteries", itemSameAsFront: true },
		};
		expect(new Arcanum(data).back.item).toBeNull();
	});
});

describe("Arcanum", () => {
	it("stores slug", () => {
		expect(new Arcanum(ARCANUM_DATA).slug).toBe("bow-with-no-string");
	});

	it("front is ArcanumFront", () => {
		expect(new Arcanum(ARCANUM_DATA).front).toBeInstanceOf(ArcanumFront);
	});

	it("back is ArcanumBack", () => {
		expect(new Arcanum(ARCANUM_DATA).back).toBeInstanceOf(ArcanumBack);
	});

	it("back.item.resource is Resource", () => {
		const arcanum = new Arcanum(ARCANUM_DATA);
		expect(arcanum.back.item.resource).toBeInstanceOf(Resource);
	});

	it("name defaults to null when absent", () => {
		expect(new Arcanum(ARCANUM_DATA).name).toBeNull();
	});

	it("img defaults to null when absent", () => {
		expect(new Arcanum(ARCANUM_DATA).img).toBeNull();
	});
});
