import { describe, it, expect, vi, afterEach } from "vitest";
import { FoundryNpcRepository } from "../../../../src/actors/steading/repositories/FoundryNpcRepository.js";
import { NpcDraft } from "../../../../src/actors/steading/NpcDraft.js";
import { NpcProvenance } from "../../../../src/actors/steading/NpcProvenance.js";
import { LinkedNpc } from "../../../../src/actors/steading/LinkedNpc.js";
import { Person } from "../../../../src/actors/steading/Person.js";

const folder = (id, name, parent = null) => ({ id, name, type: "Actor", folder: parent ? { id: parent } : null });
const actor  = (uuid, name, folderId = null, flags = {}) => ({
	uuid, name, folder: folderId ? { id: folderId } : null, flags, update: vi.fn(async () => {}),
});

function stubGame({ folders = [], actors = [] } = {}) {
	const created = { folders: [], actors: [] };
	vi.stubGlobal("game", { folders, actors });
	vi.stubGlobal("Folder", { create: vi.fn(async data => { created.folders.push(data); return folder(`new-${data.name}`, data.name, data.folder); }) });
	vi.stubGlobal("Actor",  { create: vi.fn(async data => { created.actors.push(data); return actor("Actor.new", data.name, data.folder, data.flags); }) });
	vi.stubGlobal("fromUuid", async uuid => actors.find(a => a.uuid === uuid) ?? null);
	return created;
}

afterEach(() => vi.unstubAllGlobals());

describe("FoundryNpcRepository.ensureFolder", () => {
	it("creates NPCs and the location folder under it when neither exists", async () => {
		const created = stubGame();
		const id = await new FoundryNpcRepository().ensureFolder("Stonetop");
		expect(created.folders).toEqual([
			{ name: "NPCs", type: "Actor" },
			{ name: "Stonetop", type: "Actor", folder: "new-NPCs" },
		]);
		expect(id).toBe("new-Stonetop");
	});

	it("reuses the existing folders", async () => {
		const created = stubGame({ folders: [folder("root", "NPCs"), folder("st", "Stonetop", "root")] });
		expect(await new FoundryNpcRepository().ensureFolder("Stonetop")).toBe("st");
		expect(created.folders).toHaveLength(0);
	});

	it("does not mistake a same-named folder outside NPCs for ours", async () => {
		const created = stubGame({ folders: [folder("root", "NPCs"), folder("loose", "Stonetop")] });
		expect(await new FoundryNpcRepository().ensureFolder("Stonetop")).toBe("new-Stonetop");
		expect(created.folders).toHaveLength(1);
	});
});

describe("FoundryNpcRepository.folderId", () => {
	it("returns null without creating anything when the folder is absent", async () => {
		const created = stubGame();
		expect(await new FoundryNpcRepository().folderId("Stonetop")).toBeNull();
		expect(created.folders).toHaveLength(0);
	});

	it("finds an existing location folder", async () => {
		stubGame({ folders: [folder("root", "NPCs"), folder("st", "Stonetop", "root")] });
		expect(await new FoundryNpcRepository().folderId("Stonetop")).toBe("st");
	});
});

describe("FoundryNpcRepository.byNameInFolder", () => {
	it("finds a single match in the folder", async () => {
		stubGame({ actors: [actor("Actor.a", "Willa", "st")] });
		expect((await new FoundryNpcRepository().byNameInFolder("Willa", "st")).uuid).toBe("Actor.a");
	});

	it("ignores a same-named actor in another folder", async () => {
		stubGame({ actors: [actor("Actor.a", "Willa", "elsewhere")] });
		expect(await new FoundryNpcRepository().byNameInFolder("Willa", "st")).toBeNull();
	});

	it("refuses to guess between duplicates", async () => {
		stubGame({ actors: [actor("Actor.a", "Willa", "st"), actor("Actor.b", "Willa", "st")] });
		expect(await new FoundryNpcRepository().byNameInFolder("Willa", "st")).toBeNull();
	});
});

describe("FoundryNpcRepository.create", () => {
	it("creates the actor from the draft and returns it stamped", async () => {
		const created = stubGame();
		const person  = Person.fromRaw({ id: "p1", name: "Willa", occupation: "Baker" });
		const npc = await new FoundryNpcRepository().create(NpcDraft.fromPerson(person, {
			folderId: "st", ownership: { default: 2 }, provenance: NpcProvenance.forPerson("Actor.s", person, "st"),
		}));
		expect(created.actors[0]).toMatchObject({ name: "Willa", type: "npc", folder: "st" });
		expect(npc.provenance.personId).toBe("p1");
	});
});

describe("FoundryNpcRepository writes", () => {
	it("rename writes the name and re-stamps what was written", async () => {
		const doc = actor("Actor.a", "Willa", "st");
		stubGame({ actors: [doc] });
		const npc = new LinkedNpc("Actor.a", "Willa", "st", new NpcProvenance("Actor.s", "p1", "Willa", "st"));
		await new FoundryNpcRepository().rename(npc, "Willa Fletcher");
		expect(doc.update).toHaveBeenCalledWith({
			name: "Willa Fletcher",
			"flags.stonetop.linkedPerson": { steadingUuid: "Actor.s", personId: "p1", lastSyncedName: "Willa Fletcher", lastSyncedFolderId: "st" },
		});
	});

	it("move writes the folder and re-stamps it", async () => {
		const doc = actor("Actor.a", "Willa", "st");
		stubGame({ actors: [doc] });
		const npc = new LinkedNpc("Actor.a", "Willa", "st", new NpcProvenance("Actor.s", "p1", "Willa", "st"));
		await new FoundryNpcRepository().move(npc, "mar");
		expect(doc.update).toHaveBeenCalledWith({
			folder: "mar",
			"flags.stonetop.linkedPerson": { steadingUuid: "Actor.s", personId: "p1", lastSyncedName: "Willa", lastSyncedFolderId: "mar" },
		});
	});

	it("reports nothing written when the actor has been deleted", async () => {
		stubGame({ actors: [] });
		const npc = new LinkedNpc("Actor.gone", "Willa", "st", new NpcProvenance("Actor.s", "p1", "Willa", "st"));
		await expect(new FoundryNpcRepository().rename(npc, "Willa Fletcher")).resolves.toBeNull();
	});
});
