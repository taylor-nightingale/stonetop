// The sheets' "are you sure?" gate, as one dialog. Resolves `true` to proceed, `false` to cancel
// (including dismissing the dialog). Uses Foundry's DialogV2 so it matches the app's look; the safe
// choice (No) is the default. `body` is HTML — escape anything that came from the player.
export function escapeHtml(s) {
	return String(s).replace(/[&<>"']/g, c => (
		{ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
	));
}

export async function confirmAction(titleKey, body) {
	// DialogV2.confirm defaults the No button and resolves undefined on dismissal — normalize both
	// to a strict boolean so callers only ever see true/false.
	const result = await foundry.applications.api.DialogV2.confirm({
		window: { title: game.i18n.localize(titleKey) },
		content: `<p>${body}</p>`,
	});
	return result === true;
}
