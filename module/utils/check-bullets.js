// A list counts as a check-off list when its lead-in — the block just above it —
// reads as an introduction to requirements/options ("Requires all of the
// following:", "…you must:", "To do so, they must:") rather than descriptive
// prose. Such lists use the checkbox marker instead of the spiral.
//
// The locations/lore generators already bake `class="check-bullet"` into their
// content (scripts/local/shared/gazetteer.mjs); this is the runtime counterpart
// that does the same for the hand-authored prose journals (the Setting Overview),
// so every shipped journal styles requirement lists the same way. Kept in sync
// with the generator: identical lead-in test, same checkbox class.
const CHECKLIST_LEADIN = /\brequires?\b|\b(?:you|they|each of you)\s+must\b|\ball of the following\b|\bto do so\b/i;
const SOFT_LEADIN = /\b(?:involve|involves|involving|include|includes|including|such as|for example|e\.g\.|perhaps|might)\b/i;
const LEADIN_END = /(?::|…|\.\.\.)\s*$/;

function isLeadIn(text) {
	// Only the lead-in's final clause introduces the list; example/suggestion
	// lists ("Perhaps it involves:", "…might involve…") are not check-offs.
	const last = (text ?? "").trim().split(/(?<=[.!?])\s+/).pop() ?? "";
	return LEADIN_END.test(last) && CHECKLIST_LEADIN.test(last) && !SOFT_LEADIN.test(last);
}

/**
 * Marks the <li> items of requirement/option check-lists with "check-bullet" so
 * CSS swaps in the checkbox marker. A top-level list qualifies when its preceding
 * sibling is a lead-in paragraph, or another check-list it continues (the PDF
 * extraction often splits one list into several consecutive single-item <ul>s).
 * Nested sub-lists are marked along with their items. Idempotent.
 * @param {Element} root
 */
export function markCheckBullets(root) {
	for (const ul of root.querySelectorAll("ul")) {
		if (ul.parentElement?.closest("li")) continue; // nested — handled with its parent
		const prev = ul.previousElementSibling;
		const isCheck = (prev?.tagName === "P" && isLeadIn(prev.textContent))
			|| (prev?.tagName === "UL" && prev.querySelector("li.check-bullet"));
		if (!isCheck) continue;
		ul.querySelectorAll("li").forEach(li => li.classList.add("check-bullet"));
	}
}
