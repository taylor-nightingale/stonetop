import { NpcProvenance } from "./NpcProvenance.js";

// An NPC actor as the sync rules see it. Every "may I touch this?" question is asked of the npc
// itself: an actor without a provenance stamp is one a GM linked by hand and is never written to,
// and a stamped actor whose name or folder no longer matches what we last wrote has been changed
// deliberately — that field belongs to them from then on.
export class LinkedNpc {
	constructor(uuid, name, folderId = null, provenance = null) {
		this.uuid       = uuid;
		this.name       = name;
		this.folderId   = folderId;
		this.provenance = provenance;
	}

	/** Built from a Foundry actor; `provenance` is null unless we created it. */
	static fromActor(actor) {
		return new LinkedNpc(
			actor.uuid,
			actor.name,
			actor.folder?.id ?? null,
			NpcProvenance.fromRaw(actor.flags?.[NpcProvenance.SCOPE]?.[NpcProvenance.KEY]),
		);
	}

	/** True only for an actor this system created for that person on that steading. */
	isManagedFor(steadingUuid, personId) {
		return !!this.provenance?.belongsTo(steadingUuid, personId);
	}

	get nameDiverged()   { return !!this.provenance && this.name !== this.provenance.lastSyncedName; }
	get folderDiverged() { return !!this.provenance && this.folderId !== this.provenance.lastSyncedFolderId; }

	needsRenameTo(name) {
		return !!this.provenance && !this.nameDiverged && name !== this.name;
	}

	needsMoveTo(folderId) {
		return !!this.provenance && !this.folderDiverged && folderId !== this.folderId;
	}
}
