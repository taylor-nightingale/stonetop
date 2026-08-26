/**
 * The folder tree of one compendium: what each folder is called, and what it sits inside.
 *
 * Folders are how a pack says what its documents ARE to the system, not only how they are filed for
 * a human browsing them — `outfit-items` keeps the Inventory insert's gear under "Default" and the
 * rest of Book I's priced goods under "Special items", and only the first is what a character sheet
 * lays out. Answering "is this filed under X?" therefore belongs on the tree itself, rather than
 * every caller walking parents of its own.
 */
export class PackFolders {
	// Foundry hands a Folder's parent back as either a Folder document or a bare id, depending on
	// whether the pack is loaded or indexed; both are normalised to an id here.
	constructor(folders = []) {
		this._byId = new Map(folders.map(f => [f._id, { name: f.name, parent: _idOf(f.folder) }]));
	}

	nameOf(folderId) { return this._byId.get(folderId)?.name ?? null; }

	/** Whether `folderId` IS `rootId` or sits anywhere beneath it. */
	isUnder(folderId, rootId) {
		const seen = new Set();
		for (let id = folderId; id && !seen.has(id); id = this._byId.get(id)?.parent ?? null) {
			if (id === rootId) return true;
			seen.add(id);   // a pack whose folders somehow cycle must not hang the sheet
		}
		return false;
	}
}

function _idOf(folder) {
	return (typeof folder === "string" ? folder : folder?._id ?? folder?.id) ?? null;
}
