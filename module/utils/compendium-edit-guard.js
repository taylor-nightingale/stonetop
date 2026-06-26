// Stonetop ships its reference content — journals (Locations, Bestiary codex, Lore),
// monster stat blocks, and items — inside compendium packs. That content is immutable:
// it's owned by the system and re-shipped on every update, so an in-place edit would
// either fail (locked pack) or be silently lost on the next update. The intended
// workflow is to import the document into the world and edit that copy.
//
// These helpers enforce that across the custom Stonetop sheets: a compendium document
// is treated as non-editable, and any edit attempt explains how to edit a world copy
// (importing it first via the sheet's Import header button if it isn't in the world).

/** True when a document lives inside a compendium pack (directly or via its parent). */
export function isInCompendium(doc) {
	return !!(doc?.pack || doc?.parent?.pack || doc?.compendium || doc?.parent?.compendium);
}

// Per document type: a human noun for the content and the sidebar tab its world copy
// lives under. Pages report their own type, so map them to the parent journal's tab.
const TYPE_INFO = {
	JournalEntry:     { noun: "journal",    tab: "Journal" },
	JournalEntryPage: { noun: "journal",    tab: "Journal" },
	Actor:            { noun: "stat block", tab: "Actors" },
	Item:             { noun: "item",       tab: "Items" },
};

function describeDoc(doc) {
	return TYPE_INFO[doc?.documentName] ?? TYPE_INFO[doc?.parent?.documentName] ?? { noun: "entry", tab: "sidebar" };
}

let _dialogOpen = false; // don't stack identical dialogs on repeated edit clicks

/**
 * Tell the user a compendium document can't be edited in place, and how to edit a copy.
 * Guarded so rapid repeat edit attempts don't stack duplicate dialogs.
 * @param {ClientDocument} doc  The compendium document (or page) being edited.
 */
export function warnCompendiumImmutable(doc) {
	if (_dialogOpen) return;
	_dialogOpen = true;
	const { noun, tab } = describeDoc(doc);
	const name = doc?.name ?? doc?.parent?.name ?? `This ${noun}`;
	new Dialog({
		title: "Compendium content can't be edited",
		content: `
			<div class="stonetop-compendium-immutable">
				<p><strong>${foundry.utils.escapeHTML(name)}</strong> lives in a compendium — read-only
				reference content shipped with the system. It can't be edited here.</p>
				<p>To make changes, edit the copy in your world's <strong>${tab}</strong> tab.</p>
				<p>Don't have it in your world yet? Import it first with the <strong>Import</strong> button
				(<i class="fas fa-download"></i>) in this window's header, then edit that copy.</p>
			</div>`,
		buttons: { ok: { icon: '<i class="fas fa-check"></i>', label: "Got it" } },
		default: "ok",
		close: () => { _dialogOpen = false; },
	}, { classes: ["dialog", "stonetop", "stonetop-compendium-immutable-dialog"] }).render(true);
}

/**
 * If `doc` is in a compendium and the event hit one of `selector`'s edit affordances,
 * swallow the event and show the immutable-content dialog instead. Returns true when it
 * handled (and the caller should bail), false otherwise.
 * @param {ClientDocument} doc
 * @param {Event} ev
 * @param {string} selector  CSS selector matching the sheet's edit controls.
 */
export function blockCompendiumEdit(doc, ev, selector) {
	if (!isInCompendium(doc) || !ev.target.closest(selector)) return false;
	ev.preventDefault();
	ev.stopPropagation();
	warnCompendiumImmutable(doc);
	return true;
}
