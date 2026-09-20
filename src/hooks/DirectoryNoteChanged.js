/**
 * The sidebar's note beside a character's name is the playbook they play, and taking Big Damn Hero
 * changes what it says. Neither fact is stored on the ACTOR: the playbook and the moves are embedded
 * items, and a directory only re-renders when its own collection changes — so choosing a playbook or
 * buying the move that renames it would leave the list stale until the next reload.
 *
 * Debounced, because the events arrive in bursts: applying a playbook creates the playbook item, its
 * moves, its followers and its inserts in one go, and the list only has to be right once they land.
 */

/** The embedded item types the note is computed from. */
const NOTE_TYPES = new Set(["playbook", "move"]);

let scheduled = null;

/** Built on first use: `foundry.utils` is not there when this module is imported. */
function renderActorDirectory() {
	scheduled ??= globalThis.foundry?.utils?.debounce?.(() => globalThis.ui?.actors?.render(), 100)
		?? (() => globalThis.ui?.actors?.render());
	scheduled();
}

export function onDirectoryNoteItemChanged(item) {
	if (item?.parent?.documentName !== "Actor") return;
	if (item.parent.type !== "character") return;
	if (!NOTE_TYPES.has(item.type)) return;
	renderActorDirectory();
}
