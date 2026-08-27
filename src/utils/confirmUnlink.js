import { confirmAction, escapeHtml } from "./confirmAction.js";

// The prompt for dropping a row's linked document. Unlinking keeps the row and its text — only the
// `@UUID` link goes — so it asks in its own words rather than the delete wording. Pass the row's
// `name` to name it in the prompt. Right-clicking an unlink control bypasses this entirely (the
// caller skips the call).
export async function confirmUnlink(name) {
	const body = name
		? game.i18n.format("stonetop.confirm.unlinkNamed", { name: escapeHtml(name) })
		: game.i18n.localize("stonetop.confirm.unlinkGeneric");
	return confirmAction("stonetop.confirm.unlinkTitle", body);
}
