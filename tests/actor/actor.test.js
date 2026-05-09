import { describe, it, expect } from "vitest";
import { createStonetopActorClass } from "../../module/actor/actor.js";

class MockActorPbta {
	constructor(data = {}) {
		Object.assign(this, data);
	}
	prepareData() {}
	get playbook() { return { name: "", slug: "", uuid: "" }; }
	get conditions() { return []; }
	get conditionGroups() { return []; }
	getRollData() { return { ...this.system }; }
	getRollFormula() { return "2d6"; }
	get sheetType() { return this.system?.customType ?? this.type; }
	get baseType() { return this.system?.baseType; }
}

const StonetopActor = createStonetopActorClass(MockActorPbta);

describe("StonetopActor", () => {
	describe("prepareData", () => {
		it("Set HP to playbook value", () => {

		});

	});
});
