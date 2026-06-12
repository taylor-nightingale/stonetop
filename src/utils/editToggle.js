// Single-slot display↔edit toggle for rich game-text fields. A `.stonetop-editable`
// wrapper holds an enriched-HTML `.stonetop-editable__display` and a raw-markdown
// `.stonetop-editable__edit` input/textarea; the `.stonetop-edit-toggle` pencil swaps them.
// Saving is handled by the field's own change listener; the sheet re-renders afterward.
export function activateEditToggles(root) {
	root.addEventListener("click", ev => {
		const btn = ev.target.closest(".stonetop-edit-toggle");
		if (!btn) return;
		ev.preventDefault();
		ev.stopPropagation();
		const wrap = btn.closest(".stonetop-editable");
		if (!wrap) return;
		const editing = wrap.classList.toggle("is-editing");
		const field = wrap.querySelector(".stonetop-editable__edit");
		if (editing && field) {
			field.focus();
			field.select?.();
		}
	}, true);

	// Leave edit mode when the field loses focus (its change handler has already saved).
	// If focus is moving to this field's own pencil, let the click handler toggle instead —
	// otherwise the two fight and clicking the pencil to close just re-opens it.
	root.addEventListener("focusout", ev => {
		const field = ev.target.closest?.(".stonetop-editable__edit");
		if (!field) return;
		const wrap = field.closest(".stonetop-editable");
		if (wrap?.contains(ev.relatedTarget)) return;
		wrap?.classList.remove("is-editing");
	}, true);
}
