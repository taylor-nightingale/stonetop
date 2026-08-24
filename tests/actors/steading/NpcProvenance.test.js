import { describe, it, expect } from "vitest";
import { NpcProvenance } from "../../../src/actors/steading/NpcProvenance.js";
import { Person } from "../../../src/actors/steading/Person.js";

describe("NpcProvenance.fromRaw", () => {
	it("returns null for an actor carrying no stamp", () => {
		expect(NpcProvenance.fromRaw(undefined)).toBeNull();
		expect(NpcProvenance.fromRaw({})).toBeNull();
	});

	it("returns null when the stamp is missing its identity", () => {
		expect(NpcProvenance.fromRaw({ steadingUuid: "Actor.s" })).toBeNull();
		expect(NpcProvenance.fromRaw({ personId: "p1" })).toBeNull();
	});

	it("round-trips a stamp", () => {
		const raw = { steadingUuid: "Actor.s", personId: "p1", lastSyncedName: "Willa", lastSyncedFolderId: "f1" };
		expect(NpcProvenance.fromRaw(raw).toRaw()).toEqual(raw);
	});

	it("defaults the synced fields when absent", () => {
		const p = NpcProvenance.fromRaw({ steadingUuid: "Actor.s", personId: "p1" });
		expect(p.lastSyncedName).toBe("");
		expect(p.lastSyncedFolderId).toBeNull();
	});
});

describe("NpcProvenance.forPerson", () => {
	it("stamps the person's current name and folder", () => {
		const person = Person.fromRaw({ id: "p1", name: "Willa" });
		const p = NpcProvenance.forPerson("Actor.s", person, "f1");
		expect(p.personId).toBe("p1");
		expect(p.lastSyncedName).toBe("Willa");
		expect(p.lastSyncedFolderId).toBe("f1");
	});
});

describe("NpcProvenance with-methods", () => {
	const base = new NpcProvenance("Actor.s", "p1", "Willa", "f1");

	it("withSyncedName replaces only the name", () => {
		const next = base.withSyncedName("Willa the Baker");
		expect(next.lastSyncedName).toBe("Willa the Baker");
		expect(next.lastSyncedFolderId).toBe("f1");
		expect(base.lastSyncedName).toBe("Willa");
	});

	it("withSyncedFolder replaces only the folder", () => {
		const next = base.withSyncedFolder("f2");
		expect(next.lastSyncedFolderId).toBe("f2");
		expect(next.lastSyncedName).toBe("Willa");
	});
});

describe("NpcProvenance.belongsTo", () => {
	const p = new NpcProvenance("Actor.s", "p1");

	it("matches its own steading and person", () => {
		expect(p.belongsTo("Actor.s", "p1")).toBe(true);
	});

	it("rejects another steading or another person", () => {
		expect(p.belongsTo("Actor.other", "p1")).toBe(false);
		expect(p.belongsTo("Actor.s", "p2")).toBe(false);
	});
});

describe("NpcProvenance.path", () => {
	it("is the flag path an actor update writes", () => {
		expect(NpcProvenance.path).toBe("flags.stonetop.linkedPerson");
	});
});
