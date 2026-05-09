import { describe, it, expect } from "vitest";
import { createStonetopActorClass } from "../../module/actor/actor.js";

class MockActorPbta {
	constructor(data = {}) {
		Object.assign(this, data);
	}
	prepareData() {}
	async _onCreateDescendantDocuments() {}
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
		it("clamps hp.value to hp.max when it exceeds the max", () => {
			const actor = new StonetopActor({
				system: { attributes: { hp: { value: 20, max: 16 } } },
			});
			actor.prepareData();
			expect(actor.system.attributes.hp.value).toBe(16);
		});

		it("leaves hp.value unchanged when within range", () => {
			const actor = new StonetopActor({
				system: { attributes: { hp: { value: 10, max: 16 } } },
			});
			actor.prepareData();
			expect(actor.system.attributes.hp.value).toBe(10);
		});
	});

	describe("_onCreateDescendantDocuments", () => {
		const makeActor = () => {
			const updates = [];
			const actor = new StonetopActor({
				system: { attributes: { hp: { value: 10, max: 16 }, damage: { value: "d4" } } },
			});
			actor.update = async (data) => updates.push(data);
			return { actor, updates };
		};

		const blessedPlaybook = {
			type: "playbook",
			flags: { stonetop: { hp: 18, damage: "d6" } },
			system: { slug: "the-blessed" },
		};

		it("sets hp.max and damage.value from the playbook item", async () => {
			const { actor, updates } = makeActor();
			await actor._onCreateDescendantDocuments(actor, "items", [blessedPlaybook], [], {}, "user1");
			expect(updates[0]["system.attributes.hp.max"]).toBe(18);
			expect(updates[0]["system.attributes.damage.value"]).toBe("d6");
		});

		it("resets hp.value to the new max", async () => {
			const { actor, updates } = makeActor();
			await actor._onCreateDescendantDocuments(actor, "items", [blessedPlaybook], [], {}, "user1");
			expect(updates[0]["system.attributes.hp.value"]).toBe(18);
		});

		it("does nothing when no playbook item is in the created documents", async () => {
			const { actor, updates } = makeActor();
			const moveDoc = { type: "move", system: {} };
			await actor._onCreateDescendantDocuments(actor, "items", [moveDoc], [], {}, "user1");
			expect(updates).toHaveLength(0);
		});

		it("does nothing when collection is not items", async () => {
			const { actor, updates } = makeActor();
			await actor._onCreateDescendantDocuments(actor, "effects", [blessedPlaybook], [], {}, "user1");
			expect(updates).toHaveLength(0);
		});

		it("does nothing when the playbook has no stonetop flags", async () => {
			const { actor, updates } = makeActor();
			const playbookWithoutFlags = { type: "playbook", system: { slug: "the-fox" } };
			await actor._onCreateDescendantDocuments(actor, "items", [playbookWithoutFlags], [], {}, "user1");
			expect(updates).toHaveLength(0);
		});
	});
});
