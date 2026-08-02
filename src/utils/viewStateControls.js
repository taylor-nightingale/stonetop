// V2 disables every form element on a non-editable sheet — a locked compendium item, an actor a
// player can only observe. Controls marked data-view-state are pure view state (card flips,
// edit/view toggles, display filters), not edits, so they stay clickable and the sheet stays
// browsable. Shared by both sheet bases so the marker attribute has one meaning system-wide.
export function reenableViewStateControls(root) {
	for (const el of root?.querySelectorAll("[data-view-state]") ?? []) el.disabled = false;
}
