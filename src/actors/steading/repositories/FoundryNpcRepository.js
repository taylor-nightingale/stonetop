import { LinkedNpc } from "../LinkedNpc.js";
import { NpcProvenance } from "../NpcProvenance.js";

const ROOT_FOLDER = "NPCs";

/**
 * The only place that touches Foundry's Actor and Folder documents on behalf of steading people.
 * Keeping every create/rename/move behind this seam is what lets PersonActors' rules — which decide
 * whether a write is allowed at all — be tested without a game running.
 *
 * Every write here is privileged: actor creation defaults to the Assistant GM role and folder
 * creation cannot be granted to players at all, which is why the caller runs this on the active GM's
 * client rather than the client that made the edit.
 */
export class FoundryNpcRepository {
	/** The `NPCs/<location>` folder id, or null when it does not exist yet. Creates nothing. */
	async folderId(location) {
		const root = this._folder(ROOT_FOLDER, null);
		return root ? this._folder(location, root.id)?.id ?? null : null;
	}

	async ensureFolder(location) {
		const root  = this._folder(ROOT_FOLDER, null) ?? await Folder.create({ name: ROOT_FOLDER, type: "Actor" });
		const child = this._folder(location, root.id) ?? await Folder.create({ name: location, type: "Actor", folder: root.id });
		return child.id;
	}

	async byUuid(uuid) {
		const actor = await fromUuid(uuid);
		return actor ? LinkedNpc.fromActor(actor) : null;
	}

	/** Only an unambiguous match counts — two actors of the same name means the GM decides, not us. */
	async byNameInFolder(name, folderId) {
		const matches = (game.actors ?? []).filter(a => a.name === name && (a.folder?.id ?? null) === folderId);
		return matches.length === 1 ? LinkedNpc.fromActor(matches[0]) : null;
	}

	async create(draft) {
		return LinkedNpc.fromActor(await Actor.create(draft.toCreateData()));
	}

	/** The npc as it now stands — so a caller making two writes never works from a stale one — or
	 *  null when the actor turned out to be gone. */
	async rename(npc, name) {
		const provenance = npc.provenance.withSyncedName(name);
		if (!await this._write(npc, { name }, provenance)) return null;
		return new LinkedNpc(npc.uuid, name, npc.folderId, provenance);
	}

	async move(npc, folderId) {
		const provenance = npc.provenance.withSyncedFolder(folderId);
		if (!await this._write(npc, { folder: folderId }, provenance)) return null;
		return new LinkedNpc(npc.uuid, npc.name, folderId, provenance);
	}

	// The stamp is re-written with the change it describes, so "what we last wrote" and the document
	// never drift apart — a stamp left behind would read as a GM edit and freeze the field forever.
	async _write(npc, changes, provenance) {
		const actor = await fromUuid(npc.uuid);
		if (!actor) return false;
		await actor.update({ ...changes, [NpcProvenance.path]: provenance.toRaw() });
		return true;
	}

	_folder(name, parentId) {
		return (game.folders ?? []).find(f => f.type === "Actor" && f.name === name && (f.folder?.id ?? null) === parentId) ?? null;
	}
}
