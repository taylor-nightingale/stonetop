import { describe, it, expect } from "vitest";
import { InstinctReadout } from "../../../../src/model/snapshot/character/InstinctReadout.js";
import { PlaybookSnapshotBuilder } from "../../../../src/model/snapshot/character/PlaybookSnapshot.js";
import { InsertSnapshotBuilder } from "../../../../src/model/snapshot/character/InsertSnapshot.js";

// D7: there is always exactly one instinct label, and the readout routes to where it is edited.
const playbook = (instinct = "Duty") => new PlaybookSnapshotBuilder()
	.withSlug("the-marshal").withName("The Marshal").withInstinctSelected(instinct).build();
const insert = (slug, name, instinct) => new InsertSnapshotBuilder()
	.withSlug(slug).withName(name).withInstinctSelected(instinct).build();

describe("InstinctReadout.from", () => {
	it("is the playbook's instinct, edited on the Playbook tab", () => {
		const r = InstinctReadout.from(playbook("Duty"), []);
		expect([r.label, r.source, r.tab, r.isEmpty]).toEqual(["Duty", "The Marshal", "playbook", false]);
	});

	it("is an insert's instinct once it carries one, edited on that insert's tab", () => {
		const r = InstinctReadout.from(playbook("Duty"), [insert("ghost", "The Ghost", "Longing")]);
		expect([r.label, r.source, r.tab]).toEqual(["Longing", "The Ghost", "insert-ghost"]);
	});

	it("takes the latest insert that carries one", () => {
		const r = InstinctReadout.from(playbook(), [insert("a", "A", "First"), insert("b", "B", "Second")]);
		expect(r.label).toBe("Second");
	});

	// Where the masthead's route lands: the section that edits the instinct in force.
	it("names the section that edits it, and says whether an insert's is in force", () => {
		const own = InstinctReadout.from(playbook("Duty"), []);
		const ghost = InstinctReadout.from(playbook("Duty"), [insert("ghost", "The Ghost", "Longing")]);
		expect([own.sectionKey, own.isFromInsert]).toEqual(["instinct", false]);
		expect([ghost.sectionKey, ghost.isFromInsert]).toEqual(["insert-ghost-instinct", true]);
	});

	it("keeps the playbook's while an insert has nothing picked yet", () => {
		const r = InstinctReadout.from(playbook("Duty"), [insert("ghost", "The Ghost", null)]);
		expect([r.label, r.tab]).toEqual(["Duty", "playbook"]);
	});

	it("is empty with nothing picked anywhere, and with no playbook at all", () => {
		expect(InstinctReadout.from(playbook(null), []).isEmpty).toBe(true);
		expect(InstinctReadout.from(null, []).isEmpty).toBe(true);
	});

	it("keeps its fields as own properties, since partials flatten getters away", () => {
		expect(Object.keys(InstinctReadout.from(playbook(), []))).toEqual(
			expect.arrayContaining(["label", "source", "tab", "sectionKey", "isFromInsert", "isEmpty"]));
	});
});
