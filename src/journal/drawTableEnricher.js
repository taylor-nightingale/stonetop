// Inline "Draw" buttons for the Wider World journal entries. The journal build emits a
// `@DrawTable[<uuid>]{<label>}` token next to each dice table; this registers a Foundry text
// enricher that renders it as a button, plus a GM-only delegated click handler that draws from the
// referenced RollTable straight to chat. Drawing from a compendium-locked table is fine — it posts
// the result without mutating the locked pack (replacement tables never mark results "drawn").

// @DrawTable[Compendium.stonetop.wonder-tables.RollTable.<id>]{Label}
const PATTERN = /@DrawTable\[([^\]]+)\]\{([^}]+)\}/g;
const LINK_CLASS = "stonetop-draw-table";

/** Build the roll button for one match: a FoundryVTT dice icon + the formula (e.g. 🎲 1d12). */
export function drawTableElement(match) {
	const [, uuid, label] = match;
	const a = document.createElement("a");
	a.classList.add(LINK_CLASS);
	a.dataset.uuid = uuid;
	const icon = document.createElement("i");
	icon.className = "fas fa-dice-d6";
	a.append(icon, ` ${label}`); // label is the dice formula; icon prepended
	return a;
}

/** GM-only delegated handler: draw from the RollTable named by a clicked `.stonetop-draw-table`. */
export async function onClickDrawTable(event) {
	const a = event.target?.closest?.(`a.${LINK_CLASS}`);
	if (!a) return;
	event.preventDefault?.();
	if (!game.user?.isGM) { ui.notifications?.warn("Only the GM can draw from this table."); return; }
	const table = await fromUuid(a.dataset.uuid);
	if (table?.draw) return table.draw();
	ui.notifications?.warn("Table not found — rebuild the wonder-tables pack.");
}

/** Register the enricher + delegated click handler. Call once from the `init` hook. */
export function registerDrawTableEnricher() {
	CONFIG.TextEditor ??= {};
	CONFIG.TextEditor.enrichers ??= [];
	CONFIG.TextEditor.enrichers.push({
		id: "stonetop-draw-table",
		pattern: PATTERN,
		enricher: (match) => drawTableElement(match),
	});
	document.addEventListener("click", onClickDrawTable);
}
