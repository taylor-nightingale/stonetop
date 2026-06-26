// Makes the baked "Steading Improvement" cards in journal prose draggable onto the
// Stonetop steading sheet. The cards are emitted by the gazetteer generator (see
// scripts/local/shared/gazetteer.mjs `renderSteadingImprovementCard`) with a
// `data-steading-improvement` attribute carrying the structured definition as JSON.
//
// Baked HTML can't populate `dataTransfer`, so — like the bestiary's
// `_bindStatBlockDrag` — this runtime pass attaches a `dragstart`. Unlike that one
// (which emits Foundry's native `{type:"Actor", uuid}` payload for the canvas drop
// handler), here we serialize the card's full definition into a custom payload the
// steading sheet's own drop handler recognizes. Wired
// from every journal render path (the generic journal hook for Lore/prose pages and
// the Location page sheet, which renders through its own sheet).

export const STEADING_IMPROVEMENT_DRAG_TYPE = "StonetopSteadingImprovement";

/** Read + parse a card's improvement definition, or null if malformed. */
export function readImprovementCard(card) {
	const raw = card?.dataset?.steadingImprovement;
	if (!raw) return null;
	try {
		const def = JSON.parse(raw);
		return def && def.name ? def : null;
	} catch (_e) {
		return null;
	}
}

/**
 * Attach drag behaviour to every steading-improvement card under `root`.
 * Idempotent — re-binding a card is skipped, so it's safe on every render.
 * @param {HTMLElement|jQuery} root
 */
export function bindSteadingImprovementDrag(root) {
	const el = root?.jquery ? root[0] : root;
	if (!el?.querySelectorAll) return;

	for (const card of el.querySelectorAll(".stonetop-journal-improvement[data-steading-improvement]")) {
		if (card.dataset.stImprovementBound) continue;
		card.dataset.stImprovementBound = "1";
		card.addEventListener("dragstart", ev => {
			const improvement = readImprovementCard(card);
			if (!improvement) return;
			ev.dataTransfer.setData("text/plain", JSON.stringify({
				type: STEADING_IMPROVEMENT_DRAG_TYPE,
				improvement,
			}));
			ev.dataTransfer.effectAllowed = "copy";
		});
	}
}
