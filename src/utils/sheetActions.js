import { confirmDelete } from "./confirmDelete.js";

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
 * The destructive-delete convention: left-click asks first (showing the control's `data-name`),
 * right-click skips the question. Core dispatches contextmenu through the actions pipeline only
 * when the action declares `buttons: [0, 2]`.
 */
export function confirmedDelete(perform) {
	return {
		buttons: [0, 2],
		handler: editOnly(async function (ev, target) {
			ev.preventDefault(); // suppress the browser menu on the right-click path
			const skipConfirm = ev.type === "contextmenu" || ev.button === 2;
			if (!skipConfirm && !(await confirmDelete(target.dataset.name))) return;
			await perform.call(this, target);
		}),
	};
}
