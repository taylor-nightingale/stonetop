// V2 disables every form element on a non-editable sheet — a locked compendium item, an actor a
// player can only observe. Controls marked data-view-state are pure view state (card flips,
// edit/view toggles, display filters), not edits, so they stay clickable and the sheet stays
// browsable. Shared by both sheet bases so the marker attribute has one meaning system-wide.
//
// `[data-action="tab"]` is core's built-in changeTab action, which only moves view state: no tab
// nav anywhere can be an edit, so it is re-enabled without needing the marker. Without this, a
// locked compendium playbook rendered its tab bar with every button disabled and no tab could be
// reached — the sheet was stuck on whichever tab happened to be initial.
export function reenableViewStateControls(root) {
	for (const el of root?.querySelectorAll('[data-view-state], [data-action="tab"]') ?? []) el.disabled = false;
}
