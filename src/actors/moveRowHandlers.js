import { editOnly } from "../utils/sheetActions.js";

/**
 * How a rendered move row behaves, described once for every sheet that shows one.
 *
 * `move-item.hbs` and `resource-input.hbs` are rendered by both the character and the steading, and
 * already stamp these action names. Each sheet used to re-describe what they mean — the steading by
 * hand-wiring class selectors — so a change to the partial silently broke one of them.
 *
 * The host only has to be a typed actor answering the four move methods; nothing here knows what a
 * playbook move or a homefront move is.
 */

/** Click actions for a sheet's `DEFAULT_OPTIONS.actions`. */
export const MOVE_ROW_ACTIONS = {
	// Not edit-gated: posting a move's text to chat mutates nothing, so it works on a locked sheet.
	moveToChat(ev, target) {
		return this.typedActor.sendMoveToChat(target.dataset.moveSlug);
	},
	moveResourcePip: editOnly(function (ev, target) {
		return this.typedActor.toggleMoveResourcePip(
			target.dataset.moveSlug, target.dataset.index, target.classList.contains("is-checked"));
	}),
};

/** Change handlers to merge into a sheet's ChangeActionRouter map. */
export function moveRowChangeHandlers(typedActor) {
	return {
		moveCheck:        el => typedActor.setMoveChecked(el.dataset.categoryKey, el.dataset.moveSlug, el.checked),
		moveResourceText: el => typedActor.setMoveResourceText(el.dataset.moveSlug, el.value),
	};
}
