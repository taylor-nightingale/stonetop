import { GEAR_TERMS, PIERCING_STEADING_NOTE } from "../data/gear-terms.js";

/**
 * Given a single raw tag string (e.g. "+1 damage", "x piercing", "○ low ammo", "forceful"),
 * return the tooltip description string, or null if not a known gear term.
 *
 * `omitSteadingNote` drops the Prosperity clause from the piercing tooltip — used
 * on the bestiary sheet, where a monster's "x piercing" doesn't scale with the
 * steading's Prosperity.
 */
export function findGearTerm(rawText, { omitSteadingNote = false } = {}) {
	// Strip inventory/resource symbols, then normalise whitespace.
	const text = rawText.replace(/[○◇□]/g, "").trim().toLowerCase();

	if (GEAR_TERMS[text]) return GEAR_TERMS[text];

	// Parameterised patterns
	if (/^[+]?\d+\s+armor$/.test(text)) return GEAR_TERMS.armor;
	if (/^[x\d]+\s*piercing$/.test(text))                   return GEAR_TERMS.piercing + (omitSteadingNote ? "" : PIERCING_STEADING_NOTE);
	if (/^[+]?\d+\s+damage$/.test(text))                    return GEAR_TERMS.damage;
	if (/^\d*\s*hours?$/.test(text))                        return GEAR_TERMS.hours;
	if (/^\d+\s*uses?$/.test(text))                         return GEAR_TERMS.uses;

	return null;
}

/**
 * Wrap the text content of a single <em> element with tooltip spans.
 * Handles three patterns:
 *   - Single term:        <em>forceful</em>
 *   - Comma-separated:    <em>close, messy</em>  or  <em>(close, messy)</em>
 *   - Slash-separated:    <em>near/far</em>
 */
function processEm(em) {
	// Skip any <em> that already contains child elements — those are complex HTML
	// structures (PBTA partials, nested formatting) we should not modify.
	if (em.childElementCount > 0) return;

	const rawText = em.textContent.trim();

	// Strip outer parens if present
	const hasParen = rawText.startsWith("(") && rawText.endsWith(")");
	const inner    = hasParen ? rawText.slice(1, -1) : rawText;

	// Determine separator (comma takes priority over slash)
	const sep = inner.includes(",") ? "," : inner.includes("/") ? "/" : null;

	// ── Single term ────────────────────────────────────────────────────────────
	if (!sep) {
		const desc = findGearTerm(inner);
		if (desc) {
			em.classList.add("stonetop-gear-term");
			em.dataset.tooltip = desc;
		}
		return;
	}

	// ── Multi-term (comma or slash separated) ──────────────────────────────────
	const parts    = inner.split(sep);
	// Resolve all terms in one pass — avoids calling findGearTerm twice per part.
	const resolved = parts.map(p => ({ raw: p, trimmed: p.trim(), desc: findGearTerm(p.trim()) }));
	if (!resolved.some(r => r.desc !== null)) return;

	const fragment = document.createDocumentFragment();
	if (hasParen) fragment.appendChild(document.createTextNode("("));

	resolved.forEach(({ raw: part, trimmed, desc }, i) => {
		const leading = part.match(/^\s*/)[0];

		if (desc) {
			if (leading) fragment.appendChild(document.createTextNode(leading));
			const span = document.createElement("span");
			span.className       = "stonetop-gear-term";
			span.dataset.tooltip = desc;
			span.textContent     = trimmed;
			fragment.appendChild(span);
		} else {
			fragment.appendChild(document.createTextNode(part));
		}

		if (i < resolved.length - 1) fragment.appendChild(document.createTextNode(sep));
	});

	if (hasParen) fragment.appendChild(document.createTextNode(")"));
	em.replaceChildren(fragment);
}

/**
 * Walk every <em> inside rootElement and apply gear-term tooltips.
 * Safe to call multiple times; already-processed elements are skipped.
 */
export function applyGearTermTooltips(rootElement) {
	rootElement.querySelectorAll("em").forEach(em => {
		if (em.dataset.gearProcessed) return;
		em.dataset.gearProcessed = "1";
		processEm(em);
	});
}
