import { describe, it, expect } from "vitest";
import { NpcDraft } from "../../../src/actors/steading/NpcDraft.js";
import { NpcProvenance } from "../../../src/actors/steading/NpcProvenance.js";
import { Person } from "../../../src/actors/steading/Person.js";

const person = (over = {}) => Person.fromRaw({ id: "p1", name: "Willa", occupation: "Baker", traits: "Kind, gossipy", ...over });
const draft  = (p = person()) => NpcDraft.fromPerson(p, {
	folderId:   "f1",
	provenance: NpcProvenance.forPerson("Actor.s", p, "f1"),
});

describe("NpcDraft.describe", () => {
	it("joins occupation and traits into the seeded description", () => {
		expect(NpcDraft.describe(person())).toBe("Baker\n\nKind, gossipy");
	});

	it("drops the blank half", () => {
		expect(NpcDraft.describe(person({ traits: "" }))).toBe("Baker");
		expect(NpcDraft.describe(person({ occupation: "  " }))).toBe("Kind, gossipy");
	});

	it("is empty when the person carries neither", () => {
		expect(NpcDraft.describe(person({ occupation: "", traits: "" }))).toBe("");
	});
});

describe("NpcDraft.toCreateData", () => {
	it("creates an npc in the target folder", () => {
		const data = draft().toCreateData();
		expect(data.type).toBe("npc");
		expect(data.name).toBe("Willa");
		expect(data.folder).toBe("f1");
		expect(data.system.description).toBe("Baker\n\nKind, gossipy");
	});

	it("is readable by every player, and editable by none of them", () => {
		expect(draft().toCreateData().ownership).toEqual({ default: 2 });
	});

	it("carries the provenance stamp", () => {
		expect(draft().toCreateData().flags.stonetop.linkedPerson).toEqual({
			steadingUuid: "Actor.s", personId: "p1", lastSyncedName: "Willa", lastSyncedFolderId: "f1",
		});
	});

	it("sets no img, so the house icon and any portrait set later are left alone", () => {
		expect("img" in draft().toCreateData()).toBe(false);
	});
});
