import { confirmAction, escapeHtml } from "./confirmAction.js";

// The destructive-delete prompt. Pass the item's `name` to show it in the prompt so the player knows
// exactly what they're removing. Right-clicking a delete control bypasses this entirely (the caller
// skips the call).
export async function confirmDelete(name) {
	const body = name
		? game.i18n.format("stonetop.confirm.deleteNamed", { name: escapeHtml(name) })
		: game.i18n.localize("stonetop.confirm.deleteGeneric");
	return confirmAction("stonetop.confirm.deleteTitle", body);
}
