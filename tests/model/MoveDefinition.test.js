import { describe, it, expect } from "vitest";
import { MoveDefinition } from "../../module/model/MoveDefinition.js";
import { ResourceDef } from "../../module/model/Resource.js";

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

describe("MoveDefinition", () => {
	it("stores id from _id", () => {
		expect(new MoveDefinition(PLAYBOOK_ENTRY).id).toBe("pb001");
	});

	it("stores name", () => {
		expect(new MoveDefinition(PLAYBOOK_ENTRY).name).toBe("Serenity");
	});

	it("stores playbook", () => {
		expect(new MoveDefinition(PLAYBOOK_ENTRY).playbook).toBe("The Blessed");
	});

	it("stores rollType", () => {
		expect(new MoveDefinition(PLAYBOOK_ENTRY).rollType).toBe("wis");
	});

	it("stores description", () => {
		expect(new MoveDefinition(PLAYBOOK_ENTRY).description).toBe("<p>Roll +WIS.</p>");
	});

	it("stores isStarting from isStartingMove", () => {
		expect(new MoveDefinition(PLAYBOOK_ENTRY).isStarting).toBe(true);
	});

	it("stores requirement", () => {
		expect(new MoveDefinition(PLAYBOOK_ENTRY).requirement).toEqual({ level: 2, moves: ["Serenity"], playbook: null });
	});

	it("stores repeatMax", () => {
		expect(new MoveDefinition(PLAYBOOK_ENTRY).repeatMax).toBe(2);
	});

	it("wraps resource in ResourceDef when present", () => {
		expect(new MoveDefinition(PLAYBOOK_ENTRY).resource).toBeInstanceOf(ResourceDef);
		expect(new MoveDefinition(PLAYBOOK_ENTRY).resource.max).toBe(3);
		expect(new MoveDefinition(PLAYBOOK_ENTRY).resource.title).toBe("Stock");
	});

	it("resource is null when absent", () => {
		expect(new MoveDefinition(BASIC_ENTRY).resource).toBeNull();
	});

	describe("defaults for absent system fields", () => {
		it("playbook defaults to null", () => {
			expect(new MoveDefinition(BASIC_ENTRY).playbook).toBeNull();
		});

		it("rollType defaults to null", () => {
			expect(new MoveDefinition({ _id: "x", name: "x", system: {} }).rollType).toBeNull();
		});

		it("description defaults to null", () => {
			expect(new MoveDefinition(BASIC_ENTRY).description).toBeNull();
		});

		it("isStarting defaults to false", () => {
			expect(new MoveDefinition(BASIC_ENTRY).isStarting).toBe(false);
		});

		it("requirement defaults to null", () => {
			expect(new MoveDefinition(BASIC_ENTRY).requirement).toBeNull();
		});

		it("repeatMax defaults to null", () => {
			expect(new MoveDefinition(BASIC_ENTRY).repeatMax).toBeNull();
		});
	});
});
