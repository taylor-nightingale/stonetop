// Single-select Selection control (instinct, cost): one native <select> listing every option
// plus a final "✎ Type your own…" entry that reveals a text box for a custom value. A native
// <select> popup renders above the sheet's per-child stacking contexts and overflow (a custom
// dropdown could not — every follower-card child is its own z-index:1 context), so the list
// always shows on top and stays clickable.
//
// The text input carries the field class and is the single save point: picking a preset feeds
// its value to the input and fires the input's `change`, so the field's own listener saves it.
const CUSTOM = "__custom__";

export function activateSelectionControls(root) {
	root.addEventListener("change", ev => {
		const select = ev.target.closest(".stonetop-selection-select");
		if (!select) return;
		const wrap  = select.closest(".stonetop-selection");
		const input = wrap?.querySelector(".stonetop-selection-input");
		if (!input) return;
		if (select.value === CUSTOM) {
			// Reveal the text box (prefilled with the current value) to type a custom entry.
			wrap.classList.add("is-custom");
			input.focus();
			input.select?.();
			return;
		}
		// Preset (or "—"): route through the input so the field's change handler saves it.
		input.value = select.value;
		input.dispatchEvent(new Event("change", { bubbles: true }));
	}, true);

	// Leaving the custom box without a change (no save → no re-render) reverts to the select.
	root.addEventListener("focusout", ev => {
		const input = ev.target.closest?.(".stonetop-selection-input");
		input?.closest(".stonetop-selection")?.classList.remove("is-custom");
	}, true);
}
