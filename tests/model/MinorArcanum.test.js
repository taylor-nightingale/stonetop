import { describe, it, expect } from "vitest";
import {
	MinorArcanum, MinorArcanumFront, MinorArcanumBack,
	MinorArcanumItem, MinorArcanumMove,
} from "../../module/model/MinorArcanum.js";
import { ResourceDef } from "../../module/model/Resource.js";

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
	move: { name: "When you speak the secret word", rollType: null, description: "<p>Lightning appears.</p>" },
	options: [],
};

const ARCANUM_DATA = {
	slug: "bow-with-no-string",
	front: FRONT_DATA,
	back: BACK_DATA,
};

// -- Tests --------------------------------------------------------------------

describe("MinorArcanumItem", () => {
	it("stores name, weight, note, inventoryColumn", () => {
		const item = new MinorArcanumItem(ITEM_DATA);
		expect(item.name).toBe("Thunderbolt Bow");
		expect(item.weight).toBe(1);
		expect(item.note).toBe("<em>magical</em>");
		expect(item.inventoryColumn).toBe("regular");
	});

	it("wraps resource in ResourceDef when present", () => {
		const item = new MinorArcanumItem(ITEM_DATA);
		expect(item.resource).toBeInstanceOf(ResourceDef);
		expect(item.resource.max).toBe(3);
		expect(item.resource.title).toBe("Ammo");
	});

	it("resource is null when absent", () => {
		const item = new MinorArcanumItem({ ...ITEM_DATA, resource: undefined });
		expect(item.resource).toBeNull();
	});

	it("defaults weight to null", () => {
		expect(new MinorArcanumItem({ name: "x" }).weight).toBeNull();
	});

	it("defaults note to null", () => {
		expect(new MinorArcanumItem({ name: "x" }).note).toBeNull();
	});

	it("defaults inventoryColumn to null", () => {
		expect(new MinorArcanumItem({ name: "x" }).inventoryColumn).toBeNull();
	});
});

describe("MinorArcanumMove", () => {
	it("stores name, rollType, description", () => {
		const move = new MinorArcanumMove(BACK_DATA.move);
		expect(move.name).toBe("When you speak the secret word");
		expect(move.rollType).toBeNull();
		expect(move.description).toBe("<p>Lightning appears.</p>");
	});

	it("defaults rollType to null", () => {
		expect(new MinorArcanumMove({ name: "x", description: "y" }).rollType).toBeNull();
	});
});

describe("MinorArcanumFront", () => {
	it("stores title and description", () => {
		const front = new MinorArcanumFront(FRONT_DATA);
		expect(front.title).toBe("A bow with no string");
		expect(front.description).toBe("<p>An ancient bow.</p>");
	});

	it("wraps item in MinorArcanumItem when present", () => {
		expect(new MinorArcanumFront(FRONT_DATA).item).toBeInstanceOf(MinorArcanumItem);
	});

	it("item is null when absent", () => {
		expect(new MinorArcanumFront({ ...FRONT_DATA, item: null }).item).toBeNull();
	});

	it("passes unlock through unchanged", () => {
		const front = new MinorArcanumFront(FRONT_DATA);
		expect(front.unlock).toBe(FRONT_DATA.unlock);
	});
});

describe("MinorArcanumBack", () => {
	it("stores title and description", () => {
		const back = new MinorArcanumBack(BACK_DATA);
		expect(back.title).toBe("Thunderbolt Bow");
		expect(back.description).toBe("<p>Crackles with lightning.</p>");
	});

	it("wraps item in MinorArcanumItem when present", () => {
		expect(new MinorArcanumBack(BACK_DATA).item).toBeInstanceOf(MinorArcanumItem);
	});

	it("item is null when absent", () => {
		expect(new MinorArcanumBack({ ...BACK_DATA, item: null }).item).toBeNull();
	});

	it("wraps resource in ResourceDef when present", () => {
		const back = new MinorArcanumBack({ ...BACK_DATA, resource: { max: 3, maxStat: null, title: "Tonic", labels: [] } });
		expect(back.resource).toBeInstanceOf(ResourceDef);
		expect(back.resource.title).toBe("Tonic");
	});

	it("resource is null when absent", () => {
		expect(new MinorArcanumBack(BACK_DATA).resource).toBeNull();
	});

	it("wraps move in MinorArcanumMove when present", () => {
		expect(new MinorArcanumBack(BACK_DATA).move).toBeInstanceOf(MinorArcanumMove);
	});

	it("move is null when absent", () => {
		expect(new MinorArcanumBack({ ...BACK_DATA, move: null }).move).toBeNull();
	});

	it("options defaults to []", () => {
		expect(new MinorArcanumBack({ ...BACK_DATA, options: undefined }).options).toEqual([]);
	});
});

describe("MinorArcanum", () => {
	it("stores slug", () => {
		expect(new MinorArcanum(ARCANUM_DATA).slug).toBe("bow-with-no-string");
	});

	it("front is MinorArcanumFront", () => {
		expect(new MinorArcanum(ARCANUM_DATA).front).toBeInstanceOf(MinorArcanumFront);
	});

	it("back is MinorArcanumBack", () => {
		expect(new MinorArcanum(ARCANUM_DATA).back).toBeInstanceOf(MinorArcanumBack);
	});

	it("back.item.resource is ResourceDef", () => {
		const arcanum = new MinorArcanum(ARCANUM_DATA);
		expect(arcanum.back.item.resource).toBeInstanceOf(ResourceDef);
	});
});
