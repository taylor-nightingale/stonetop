import { valueTooltip } from "../data/value-tiers.js";
import { getHoverDescriptionSetting } from "../settings.js";

// Capital-V "Value" immediately followed by a tier number (optionally a range,
// "Value 0-2"). Capital V and the trailing digit are both required so the common
// lowercase noun is left alone — "the piercing value", "armor value by 1",
// "Values are not linear", "the Value of 0" never match.
// The stateless form is for the per-node `.test()` pre-filter; the global form
// (derived from it) drives `matchAll`. Neither carries `lastIndex` between calls.
const _VALUE_RE = /\bValue\s+(\d+)(?:\s*[-–—]\s*(\d+))?\b/;
const _VALUE_RE_G = new RegExp(_VALUE_RE, "g");

// Never wrap inside editable controls, content links (which carry their own
// tooltip), or an already-wrapped term (idempotency).
const _SKIP = ".stonetop-value-term, a, input, textarea, select, code, pre, .editor, prose-mirror, .ProseMirror";

/**
 * Give every "Value N" (and "Value N-M" range) in `container`'s prose a hover
 * tooltip explaining what that trade-value tier is worth. Walks text nodes and
 * wraps each match in a `<span class="stonetop-value-term" data-tooltip="…">`,
 * leaving the surrounding text untouched. Idempotent; safe to call on every render.
 *
 * Gated by the `hoverDescriptionsValues` setting (and the hover-descriptions master
 * toggle), so every caller — journals, the location/bestiary pages, the prose
 * dialogs, and the actor/item sheets — honours the one switch.
 * @param {HTMLElement} container
 */
export function markValueTooltips(container) {
	if (!container?.querySelectorAll) return;
	if (!getHoverDescriptionSetting("hoverDescriptionsValues")) return;

	// Cheap pre-check before the (relatively expensive) text-node walk: most sheet
	// re-renders carry no "Value N" at all, so a single textContent regex test lets
	// us skip building the TreeWalker and running `.closest(_SKIP)` per text node.
	if (!_VALUE_RE.test(container.textContent ?? "")) return;

	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
		acceptNode: node =>
			node.parentElement?.closest(_SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
	});
	const toReplace = [];
	let node;
	while ((node = walker.nextNode())) {
		if (_VALUE_RE.test(node.textContent)) toReplace.push(node);
	}

	for (const textNode of toReplace) {
		const text = textNode.textContent;
		const frag = document.createDocumentFragment();
		let lastIdx = 0;
		for (const match of text.matchAll(_VALUE_RE_G)) {
			if (match.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
			const tooltip = valueTooltip(match[1], match[2]);
			if (tooltip) {
				const span = document.createElement("span");
				span.className = "stonetop-value-term";
				span.dataset.tooltip = tooltip;
				span.dataset.tooltipDirection = "UP";
				span.textContent = match[0];
				frag.appendChild(span);
			} else {
				frag.appendChild(document.createTextNode(match[0]));
			}
			lastIdx = match.index + match[0].length;
		}
		if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
		textNode.parentNode?.replaceChild(frag, textNode);
	}
}
