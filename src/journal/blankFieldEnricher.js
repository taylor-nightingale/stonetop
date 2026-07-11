// Editable write-in fields for arcanum text. The book prints a blank line ("____") wherever the player
// writes something in — the storm die they assigned, the terms of a geas, the subject of a question.
// The build numbers each blank into a stable `@Blank[<key>]` token; this registers a Foundry text
// enricher that renders it as a small text input. The input starts empty here (the enricher is
// stateless); the character sheet fills it from the arcanum's stored value and persists edits (see
// StonetopCharacterSheet — it keys off `data-blank-key` within the owning `.stonetop-arcanum-card`).

// @Blank[<key>] — an editable write-in field; the bracket form is shielded from the markdown pass.
const PATTERN = /@Blank\[([^\]]+)\]/g;
const FIELD_CLASS = "stonetop-arcanum-blank";

/** Build the write-in input for one match: an empty text field tagged with its stable blank key. */
export function blankFieldElement(match) {
	const [, key] = match;
	const input = document.createElement("input");
	input.type = "text";
	input.classList.add(FIELD_CLASS);
	input.dataset.blankKey = key;
	input.setAttribute("spellcheck", "false");
	input.setAttribute("autocomplete", "off");
	input.setAttribute("aria-label", "write-in field");
	return input;
}

/** Register the blank-field enricher. Call once from the `init` hook. */
export function registerBlankFieldEnricher() {
	CONFIG.TextEditor ??= {};
	CONFIG.TextEditor.enrichers ??= [];
	CONFIG.TextEditor.enrichers.push(
		{ id: "stonetop-blank-field", pattern: PATTERN, enricher: (match) => blankFieldElement(match) },
	);
}
