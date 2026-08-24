import { LinkedNpc } from "../../src/actors/steading/LinkedNpc.js";

/**
 * An in-memory stand-in for FoundryNpcRepository. Records every write so a test can assert not just
 * the resulting state but that nothing was written at all — the point of most of these rules.
 */
export class FakeNpcRepository {
	constructor() {
		this.folders  = new Map();   // location -> folder id
		this.npcs     = new Map();   // uuid -> LinkedNpc
		this.created  = [];          // NpcDraft
		this.renames  = [];          // { uuid, name }
		this.moves    = [];          // { uuid, folderId }
		this._nextId  = 0;
	}

	withFolder(location, id) { this.folders.set(location, id); return this; }
	withNpc(npc)             { this.npcs.set(npc.uuid, npc);   return this; }

	get(uuid) { return this.npcs.get(uuid) ?? null; }

	async folderId(location) {
		return this.folders.get(location) ?? null;
	}

	async ensureFolder(location) {
		if (!this.folders.has(location)) this.folders.set(location, `folder-${location}`);
		return this.folders.get(location);
	}

	async byUuid(uuid) {
		return this.npcs.get(uuid) ?? null;
	}

	async byNameInFolder(name, folderId) {
		const matches = [...this.npcs.values()].filter(n => n.name === name && n.folderId === folderId);
		return matches.length === 1 ? matches[0] : null;
	}

	async create(draft) {
		this.created.push(draft);
		const npc = new LinkedNpc(`Actor.npc-${this._nextId++}`, draft.name, draft.folderId, draft.provenance);
		this.npcs.set(npc.uuid, npc);
		return npc;
	}

	async rename(npc, name) {
		this.renames.push({ uuid: npc.uuid, name });
		return this._store(new LinkedNpc(npc.uuid, name, npc.folderId, npc.provenance.withSyncedName(name)));
	}

	async move(npc, folderId) {
		this.moves.push({ uuid: npc.uuid, folderId });
		return this._store(new LinkedNpc(npc.uuid, npc.name, folderId, npc.provenance.withSyncedFolder(folderId)));
	}

	_store(npc) {
		this.npcs.set(npc.uuid, npc);
		return npc;
	}
}
