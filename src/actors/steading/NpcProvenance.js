// The stamp left on an NPC actor the system created for a steading person. `lastSyncedName` and
// `lastSyncedFolderId` record what we last wrote, which is what lets a later pass tell "still as we
// left it" from "the GM has changed this by hand" — the second is never overwritten.
export class NpcProvenance {
	static SCOPE = "stonetop";
	static KEY   = "linkedPerson";

	/** The dot path an actor update writes the stamp to. */
	static get path() {
		return `flags.${NpcProvenance.SCOPE}.${NpcProvenance.KEY}`;
	}

	constructor(steadingUuid, personId, lastSyncedName = "", lastSyncedFolderId = null) {
		this.steadingUuid       = steadingUuid;
		this.personId           = personId;
		this.lastSyncedName     = lastSyncedName;
		this.lastSyncedFolderId = lastSyncedFolderId;
	}

	/** The stamp stored on an actor, or null for an actor we did not create. */
	static fromRaw(raw) {
		if (!raw?.steadingUuid || !raw?.personId) return null;
		return new NpcProvenance(raw.steadingUuid, raw.personId, raw.lastSyncedName ?? "", raw.lastSyncedFolderId ?? null);
	}

	static forPerson(steadingUuid, person, folderId) {
		return new NpcProvenance(steadingUuid, person.id, person.name, folderId);
	}

	withSyncedName(name)       { return new NpcProvenance(this.steadingUuid, this.personId, name, this.lastSyncedFolderId); }
	withSyncedFolder(folderId) { return new NpcProvenance(this.steadingUuid, this.personId, this.lastSyncedName, folderId); }

	belongsTo(steadingUuid, personId) {
		return this.steadingUuid === steadingUuid && this.personId === personId;
	}

	toRaw() {
		return {
			steadingUuid:       this.steadingUuid,
			personId:           this.personId,
			lastSyncedName:     this.lastSyncedName,
			lastSyncedFolderId: this.lastSyncedFolderId,
		};
	}
}
