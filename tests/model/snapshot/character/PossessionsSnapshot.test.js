import { describe, it, expect } from "vitest";
import { PossessionsSnapshot, PossessionItemSnapshotBuilder } from "../../../../src/model/snapshot/character/InventorySnapshot.js";

// How many special possessions are still to pick: the playbook's count, less the ones picked. What
// the playbook hands over (the Lightbearer's sacred pouch) and what was dropped on from outside it
// are not picks.
const item = (slug, { checked = false, preselected = false, removable = false } = {}) => new PossessionItemSnapshotBuilder()
	.withSlug(slug).withChecked(checked).withSelected(checked).withPreselected(preselected).withDisabled(preselected)
	.withRemovable(removable).build();

describe("PossessionsSnapshot.owed", () => {
	it("is the playbook's count while nothing is picked", () => {
		expect(new PossessionsSnapshot(2, "Pick 2", [item("a"), item("b"), item("c")]).owed).toBe(2);
	});

	it("goes down with each pick", () => {
		expect(new PossessionsSnapshot(2, "Pick 2", [item("a", { checked: true }), item("b")]).owed).toBe(1);
	});

	it("does not count what the playbook hands over, or what was dropped on", () => {
		const items = [item("pouch", { checked: true, preselected: true }), item("found", { checked: true, removable: true }), item("a")];
		expect(new PossessionsSnapshot(2, "Pick 2", items).owed).toBe(2);
	});

	it("is never below nothing", () => {
		expect(new PossessionsSnapshot(1, "Pick 1", [item("a", { checked: true }), item("b", { checked: true })]).owed).toBe(0);
	});

	it("names its door by whether anything is taken yet", () => {
		expect(new PossessionsSnapshot(1, "", [item("a", { checked: true })]).door).toBe("change");
		expect(new PossessionsSnapshot(1, "", [item("a")]).door).toBe("choose");
	});

	it("is nothing where the playbook sets no count", () => {
		expect(new PossessionsSnapshot(null, "", [item("a")]).owed).toBe(0);
	});
});
