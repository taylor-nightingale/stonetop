import { describe, it, expect } from "vitest";
import { MoveData } from "../../src/data/MoveData.js";

describe("MoveData defaults", () => {
	it("defaults rollStat, moveType, playbook, slug to null", () => {
		const d = new MoveData();
		expect(d.rollStat).toBeNull();
		expect(d.moveType).toBeNull();
		expect(d.playbook).toBeNull();
		expect(d.slug).toBeNull();
	});

	it("defaults description to empty string", () => {
		expect(new MoveData().description).toBe("");
	});

	it("defaults moveResults with correct labels", () => {
		const { moveResults } = new MoveData();
		expect(moveResults.success.label).toBe("10+");
		expect(moveResults.partial.label).toBe("7-9");
		expect(moveResults.failure.label).toBe("6-");
		expect(moveResults.success.value).toBe("");
	});

	it("defaults requirement with empty moves array and null level/playbook", () => {
		const { requirement } = new MoveData();
		expect(requirement.moves).toEqual([]);
		expect(requirement.level).toBeNull();
		expect(requirement.playbook).toBeNull();
	});

	it("defaults repeatMax to 1 and isStartingMove to false", () => {
		const d = new MoveData();
		expect(d.repeatMax).toBe(1);
		expect(d.isStartingMove).toBe(false);
	});

	it("defaults resource, choices, sortOrder to null", () => {
		const d = new MoveData();
		expect(d.resource).toBeNull();
		expect(d.choices).toBeNull();
		expect(d.sortOrder).toBeNull();
	});

	it("defaults categoryKey to null", () => expect(new MoveData().categoryKey).toBeNull());
	it("defaults acquired to false",   () => expect(new MoveData().acquired).toBe(false));
	it("defaults instanceCount to 0",  () => expect(new MoveData().instanceCount).toBe(0));
});
