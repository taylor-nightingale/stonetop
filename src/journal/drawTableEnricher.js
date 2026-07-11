// Inline "Draw" buttons for dice tables (Wider World journal entries and player-facing arcana). The
// build emits a `@DrawTable[<uuid>]{<label>}` token next to each dice table; this registers a Foundry
// text enricher that renders it as a button, plus a delegated click handler (any user) that draws
// from the referenced RollTable straight to chat. Drawing from a compendium-locked table is fine — it
// posts the result without mutating the locked pack (replacement tables never mark results "drawn"),
// so it's safe for players to roll their own arcanum tables, not just the GM.

// @DrawTable[Compendium.stonetop.wonder-tables.RollTable.<id>]{Label}       — roll button only (journal)
// @DrawTableInline[Compendium…RollTable.<id>]{Formula} — roll button + the table's rows shown inline (arcana)
const PATTERN = /@DrawTable\[([^\]]+)\]\{([^}]+)\}/g;
const INLINE_PATTERN = /@DrawTableInline\[([^\]]+)\]\{([^}]+)\}/g;
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

/** The displayed roll span for one result: "3" or "3–4" from its [low, high] range. */
function resultRange(result) {
	const [lo, hi] = result.range ?? [];
	if (lo == null) return "";
	return lo === hi ? String(lo) : `${lo}–${hi}`;
}

/** Build the inline table block for one match: the roll button (caption) + a row per result. Async
 *  because it fetches the RollTable; falls back to a bare roll button if the pack can't be read. */
export async function drawTableInlineElement(match) {
	const [, uuid] = match;
	const table = await fromUuid(uuid);
	if (!table?.results) return drawTableElement(match); // pack unreadable / not built — button only

	const figure = document.createElement("figure");
	figure.classList.add("stonetop-inline-table");
	const caption = document.createElement("figcaption");
	caption.append(drawTableElement(match)); // reuse the roll button (clickable → draws to chat)
	figure.append(caption);

	const tbl = document.createElement("table");
	const tbody = document.createElement("tbody");
	for (const result of table.results) {
		const tr = document.createElement("tr");
		const range = document.createElement("td");
		range.classList.add("roll");
		range.textContent = resultRange(result);
		const text = document.createElement("td");
		text.textContent = result.description ?? result.text ?? result.name ?? "";
		tr.append(range, text);
		tbody.append(tr);
	}
	tbl.append(tbody);
	figure.append(tbl);
	return figure;
}

/** Delegated handler (any user): draw from the RollTable named by a clicked `.stonetop-draw-table`. */
export async function onClickDrawTable(event) {
	const a = event.target?.closest?.(`a.${LINK_CLASS}`);
	if (!a) return;
	event.preventDefault?.();
	const table = await fromUuid(a.dataset.uuid);
	if (table?.draw) return table.draw();
	ui.notifications?.warn("Table not found — rebuild the wonder-tables pack.");
}

/** Register the enricher + delegated click handler. Call once from the `init` hook. */
export function registerDrawTableEnricher() {
	CONFIG.TextEditor ??= {};
	CONFIG.TextEditor.enrichers ??= [];
	CONFIG.TextEditor.enrichers.push(
		{ id: "stonetop-draw-table", pattern: PATTERN, enricher: (match) => drawTableElement(match) },
		{ id: "stonetop-draw-table-inline", pattern: INLINE_PATTERN, enricher: (match) => drawTableInlineElement(match) },
	);
	document.addEventListener("click", onClickDrawTable);
}
