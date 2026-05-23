import { describe, it, expect } from "vitest";
import { Move } from "../../module/model/data/Move.js";
import { Resource } from "../../module/model/data/Resource.js";

// -- Fixtures -----------------------------------------------------------------

const PLAYBOOK_ENTRY = {
	_id: "pb001",
	name: "Serenity",
	system: {
		playbook:       "The Blessed",
		rollType:       "wis",
		description:    "<p>Roll +WIS.</p>",
		isStartingMove: true,
		requirement:    { level: 2, moves: ["Serenity"], playbook: null },
		repeatMax:      2,
		resource:       { max: 3, maxStat: null, title: "Stock", labels: [] },
	},
};

const BASIC_ENTRY = {
	_id: "bm001",
	name: "Defy Danger",
	system: { rollType: "stat" },
};

// -- Tests --------------------------------------------------------------------

describe("Move", () => {
	it("stores id from _id", () => {
		expect(new Move(PLAYBOOK_ENTRY).id).toBe("pb001");
	});

	it("stores name", () => {
		expect(new Move(PLAYBOOK_ENTRY).name).toBe("Serenity");
	});

	it("stores playbook", () => {
		expect(new Move(PLAYBOOK_ENTRY).playbook).toBe("The Blessed");
	});

	it("stores rollType", () => {
		expect(new Move(PLAYBOOK_ENTRY).rollType).toBe("wis");
	});

	it("stores description", () => {
		expect(new Move(PLAYBOOK_ENTRY).description).toBe("<p>Roll +WIS.</p>");
	});

	it("stores isStarting from isStartingMove", () => {
		expect(new Move(PLAYBOOK_ENTRY).isStarting).toBe(true);
	});

	it("stores requirement", () => {
		expect(new Move(PLAYBOOK_ENTRY).requirement).toEqual({ level: 2, moves: ["Serenity"], playbook: null });
	});

	it("stores repeatMax", () => {
		expect(new Move(PLAYBOOK_ENTRY).repeatMax).toBe(2);
	});

	it("wraps resource in Resource when present", () => {
		expect(new Move(PLAYBOOK_ENTRY).resource).toBeInstanceOf(Resource);
		expect(new Move(PLAYBOOK_ENTRY).resource.max).toBe(3);
		expect(new Move(PLAYBOOK_ENTRY).resource.title).toBe("Stock");
	});

	it("resource is null when absent", () => {
		expect(new Move(BASIC_ENTRY).resource).toBeNull();
	});

	describe("defaults for absent system fields", () => {
		it("playbook defaults to null", () => {
			expect(new Move(BASIC_ENTRY).playbook).toBeNull();
		});

		it("rollType defaults to null", () => {
			expect(new Move({ _id: "x", name: "x", system: {} }).rollType).toBeNull();
		});

		it("description defaults to null", () => {
			expect(new Move(BASIC_ENTRY).description).toBeNull();
		});

		it("isStarting defaults to false", () => {
			expect(new Move(BASIC_ENTRY).isStarting).toBe(false);
		});

		it("requirement defaults to null", () => {
			expect(new Move(BASIC_ENTRY).requirement).toBeNull();
		});

		it("repeatMax defaults to null", () => {
			expect(new Move(BASIC_ENTRY).repeatMax).toBeNull();
		});
	});

	describe("computed properties", () => {
		it("requires returns first required move name", () => {
			expect(new Move(PLAYBOOK_ENTRY).requires).toBe("Serenity");
		});

		it("requires returns null when no requirement", () => {
			expect(new Move(BASIC_ENTRY).requires).toBeNull();
		});

		it("minLevel returns requirement level", () => {
			expect(new Move(PLAYBOOK_ENTRY).minLevel).toBe(2);
		});

		it("minLevel returns null when no requirement", () => {
			expect(new Move(BASIC_ENTRY).minLevel).toBeNull();
		});
	});
});
