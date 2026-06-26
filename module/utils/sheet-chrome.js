// Shared window-header chrome for the bestiary sheets (monster stat block +
// Bestiary Entry). Both wear the same edit/lock toggle, strip Foundry's
// document-id link, and collapse the portrait slot when its art fails to load.
// The only per-sheet variation is the header's BEM class and the toggle's noun,
// so those are parameters rather than two copies of the logic.

import { isInCompendium, warnCompendiumImmutable } from "./compendium-edit-guard.js";

/**
 * Drop the header portrait if its image fails to load, flagging the header so
 * CSS collapses the now-empty slot. No-op in edit mode (the slot stays so the
 * user can drop in art).
 * @param {Application} sheet      the host sheet (uses `_editMode`, `element`)
 * @param {string} headerClass     e.g. "stonetop-monster-header"
 */
export function hideBrokenPortrait(sheet, headerClass) {
	if (sheet._editMode) return;
	const img = sheet.element[0]?.querySelector(".stonetop-portrait");
	if (!img) return;
	const header = img.closest(`.${headerClass}`);
	const drop = () => {
		img.remove();
		header?.classList.add(`${headerClass}--no-portrait`);
	};
	if (img.complete && img.naturalWidth === 0) { drop(); return; }
	img.addEventListener("error", drop, { once: true });
}

/** Strip Foundry's document-id link from the window header. */
export function stripHeaderChrome(sheet) {
	const header = sheet.element[0]?.querySelector(".window-header");
	header?.querySelectorAll(".document-id-link").forEach(el => el.remove());
}

/**
 * Inject the edit/lock toggle into the window header. `noun` names the thing
 * being edited (e.g. "stat block" or "Entry") for the tooltip.
 * @param {Application} sheet
 * @param {string} noun
 */
export function injectHeaderToggle(sheet, noun) {
	const header = sheet.element[0]?.querySelector(".window-header");
	if (!header || !sheet.actor.isOwner) return;
	header.querySelector(".stonetop-header-toggle")?.remove();

	// Locked == viewed from a (read-only) compendium. Show a lock affordance; clicking
	// it explains that compendium content is immutable and to edit a world copy instead.
	const locked = !sheet.isEditable;

	const label = document.createElement("label");
	label.className = "stonetop-edit-toggle stonetop-header-toggle";
	label.title = locked
		? "Read-only — import to your world to edit"
		: (sheet._editMode ? `Lock ${noun}` : `Edit ${noun}`);

	const checkbox = document.createElement("input");
	checkbox.type = "checkbox";
	checkbox.checked = sheet._editMode;
	checkbox.addEventListener("change", () => toggleEdit(sheet, checkbox));

	const track = document.createElement("span");
	track.className = "stonetop-toggle-track";
	const thumb = document.createElement("span");
	thumb.className = "stonetop-toggle-thumb";
	const icon = document.createElement("i");
	icon.className = locked ? "fas fa-lock" : "fas fa-wrench";
	thumb.appendChild(icon);
	track.appendChild(thumb);
	label.appendChild(checkbox);
	label.appendChild(track);

	header.insertBefore(label, header.querySelector(".window-title"));
}

/**
 * Handle the edit/lock toggle: flip `_editMode` and re-render. A non-editable sheet
 * means a read-only compendium document (the toggle only shows for owners, so world
 * actors are always editable here); compendium content is immutable, so explain how to
 * edit a world copy instead of entering edit mode.
 */
export async function toggleEdit(sheet, checkbox) {
	const turningOn = checkbox.checked;
	if (turningOn && !sheet.isEditable) {
		checkbox.checked = false;
		if (isInCompendium(sheet.actor)) warnCompendiumImmutable(sheet.actor);
		return;
	}
	sheet._editMode = turningOn;
	sheet.render(false);
}
