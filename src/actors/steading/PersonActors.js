import { NpcDraft } from "./NpcDraft.js";
import { NpcProvenance } from "./NpcProvenance.js";
import { PersonActorPlan } from "./PersonActorPlan.js";

/**
 * Keeps a steading person's NPC actor in step with their row without ever overwriting a GM's own
 * work. Three rules carry the whole design:
 *
 *  • only actors we created (they carry an NpcProvenance stamp) are ever written to — a document
 *    dropped onto a row is read-only to us, forever;
 *  • a stamped actor is written to only while it still looks the way we left it, so renaming one by
 *    hand or dragging it to another folder hands that field over permanently;
 *  • nothing is ever deleted, and the description is seeded at creation and never re-synced.
 *
 * The caller supplies the location per person, because who lives where is the concrete list's
 * knowledge: residents share the steading's own name, a neighbour carries their home.
 */
export class PersonActors {
	constructor(steading, npcs) {
		this._steading = steading;
		this._npcs     = npcs;
	}

	/** The person to write back when their link changed, or null when the row already stands correct. */
	async sync(person, location) {
		if (!PersonActors._isNamed(person)) return null;
		if (person.linkUuid) {
			await this._syncLinked(person, location);
			return null;
		}
		return person.withLink(await this._linkOrCreate(person, location));
	}

	/** What `sync` would do, without creating a folder, an actor, or anything else. */
	async preview(person, location) {
		if (!PersonActors._isNamed(person)) return new PersonActorPlan(person.name, location, PersonActorPlan.UNNAMED);
		if (person.linkUuid)               return new PersonActorPlan(person.name, location, PersonActorPlan.LINKED);
		const existing = await this._findInFolder(person.name, await this._npcs.folderId(location));
		return new PersonActorPlan(person.name, location, existing ? PersonActorPlan.LINK : PersonActorPlan.CREATE);
	}

	async _syncLinked(person, location) {
		let npc = await this._npcs.byUuid(person.linkUuid);
		if (!npc?.isManagedFor(this._steading.uuid, person.id)) return;
		// Each write hands back the npc as it now stands: a rename followed by a move working from the
		// stale one would re-stamp the name we just replaced, and the row would look GM-edited forever.
		if (npc.needsRenameTo(person.name)) {
			npc = await this._npcs.rename(npc, person.name);
			if (!npc) return;
		}
		// A folder is only created for someone who is going to be filed in it — never as a side effect
		// of a rename, and never for an actor the GM has already filed somewhere of their own.
		if (npc.folderDiverged) return;
		const folderId = await this._npcs.ensureFolder(location);
		if (npc.needsMoveTo(folderId)) await this._npcs.move(npc, folderId);
	}

	async _linkOrCreate(person, location) {
		const folderId = await this._npcs.ensureFolder(location);
		const existing = await this._findInFolder(person.name, folderId);
		if (existing) return existing.uuid;
		const created = await this._npcs.create(NpcDraft.fromPerson(person, {
			folderId,
			provenance: NpcProvenance.forPerson(this._steading.uuid, person, folderId),
		}));
		return created.uuid;
	}

	// An actor the GM already made under that name is linked rather than duplicated — but it stays
	// unstamped, so linking it grants us no right to rename or move it later.
	async _findInFolder(name, folderId) {
		return folderId ? this._npcs.byNameInFolder(name, folderId) : null;
	}

	static _isNamed(person) {
		return !!person?.name?.trim();
	}
}
