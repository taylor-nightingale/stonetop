// Read a tag-adder box's value and blank it in the same step. Pressing Enter in a combobox tag
// box fires TWO change events — the browser's native value-commit AND the combobox's synthetic
// one — and a *toggle* handler that ran twice would add then immediately remove the tag. Blanking
// before the caller toggles makes the second change read an empty box and no-op.
// Returns the trimmed value, or null when the box was empty/whitespace.
export function takeTagInputValue(input) {
	const value = input.value.trim();
	input.value = "";
	return value || null;
}
