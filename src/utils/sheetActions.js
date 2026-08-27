import { confirmDelete } from "./confirmDelete.js";
import { confirmUnlink } from "./confirmUnlink.js";

/**
 * Wrappers that turn a plain handler into an entry for an ApplicationV2 `actions` map.
 *
 * Both gate on `isEditable` at EVENT time rather than wiring time: a sheet can gain or lose
 * ownership mid-session, and the actions map is built once per class.
 */

/** Run `handler` only while the sheet is editable. */
export function editOnly(handler) {
	return function (ev, target) {
		if (this.isEditable) return handler.call(this, ev, target);
	};
}

/**
 * The destructive-action convention: left-click asks first via `ask` (showing the control's
 * `data-name`), right-click skips the question. Core dispatches contextmenu through the actions
 * pipeline only when the action declares `buttons: [0, 2]`.
 */
function confirmedAction(ask) {
	return perform => ({
		buttons: [0, 2],
		handler: editOnly(async function (ev, target) {
			ev.preventDefault(); // suppress the browser menu on the right-click path
			const skipConfirm = ev.type === "contextmenu" || ev.button === 2;
			if (!skipConfirm && !(await ask(target.dataset.name))) return;
			await perform.call(this, target);
		}),
	});
}

/** Delete something outright — asks "Delete X?" unless right-clicked. */
export const confirmedDelete = confirmedAction(confirmDelete);

/** Drop a row's linked document, keeping the row — asks unless right-clicked. */
export const confirmedUnlink = confirmedAction(confirmUnlink);
