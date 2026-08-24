import { describe, it, expect } from "vitest";
import { LinkedNpc } from "../../../src/actors/steading/LinkedNpc.js";
import { NpcProvenance } from "../../../src/actors/steading/NpcProvenance.js";

const stamp = (name = "Willa", folderId = "f1") => new NpcProvenance("Actor.s", "p1", name, folderId);
const ours   = (name = "Willa", folderId = "f1", provenance = stamp(name, folderId)) =>
	new LinkedNpc("Actor.npc", name, folderId, provenance);
const theirs = (name = "Willa", folderId = "f1") => new LinkedNpc("Actor.npc", name, folderId, null);

describe("LinkedNpc.fromActor", () => {
	it("reads name, folder and stamp off the actor", () => {
		const npc = LinkedNpc.fromActor({
			uuid: "Actor.abc", name: "Willa", folder: { id: "f1" },
			flags: { stonetop: { linkedPerson: { steadingUuid: "Actor.s", personId: "p1", lastSyncedName: "Willa" } } },
		});
		expect(npc.uuid).toBe("Actor.abc");
		expect(npc.folderId).toBe("f1");
		expect(npc.provenance.personId).toBe("p1");
	});

	it("has no provenance for an actor we did not create", () => {
		const npc = LinkedNpc.fromActor({ uuid: "Actor.abc", name: "Willa", folder: null, flags: {} });
		expect(npc.provenance).toBeNull();
		expect(npc.folderId).toBeNull();
	});
});

describe("LinkedNpc.isManagedFor", () => {
	it("is true only for the steading and person it was stamped with", () => {
		expect(ours().isManagedFor("Actor.s", "p1")).toBe(true);
		expect(ours().isManagedFor("Actor.s", "p2")).toBe(false);
		expect(ours().isManagedFor("Actor.other", "p1")).toBe(false);
	});

	it("is false for an actor the GM linked by hand", () => {
		expect(theirs().isManagedFor("Actor.s", "p1")).toBe(false);
	});
});

describe("LinkedNpc.needsRenameTo", () => {
	it("renames one we created that still carries the name we wrote", () => {
		expect(ours("Willa").needsRenameTo("Willa Fletcher")).toBe(true);
	});

	it("does nothing when the name already matches", () => {
		expect(ours("Willa").needsRenameTo("Willa")).toBe(false);
	});

	it("never renames after the GM renamed it themselves", () => {
		const renamedByHand = ours("Willa the Baker", "f1", stamp("Willa", "f1"));
		expect(renamedByHand.nameDiverged).toBe(true);
		expect(renamedByHand.needsRenameTo("Willa Fletcher")).toBe(false);
	});

	it("never renames an actor we did not create", () => {
		expect(theirs("Willa").needsRenameTo("Willa Fletcher")).toBe(false);
	});
});

describe("LinkedNpc.needsMoveTo", () => {
	it("moves one we created that still sits where we put it", () => {
		expect(ours("Willa", "f1").needsMoveTo("f2")).toBe(true);
	});

	it("does nothing when it is already in the target folder", () => {
		expect(ours("Willa", "f1").needsMoveTo("f1")).toBe(false);
	});

	it("never moves after the GM dragged it elsewhere", () => {
		const movedByHand = ours("Willa", "villagers", stamp("Willa", "f1"));
		expect(movedByHand.folderDiverged).toBe(true);
		expect(movedByHand.needsMoveTo("f2")).toBe(false);
	});

	it("never moves an actor we did not create", () => {
		expect(theirs("Willa", "f1").needsMoveTo("f2")).toBe(false);
	});
});
