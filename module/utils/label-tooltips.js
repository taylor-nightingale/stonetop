import { getHoverDescriptionSetting } from "../settings.js";

/**
 * Wire hover tooltips onto sheet labels whose meaning is explained by a lookup
 * table. For each element matching `selector`, set `data-tooltip` (and direction)
 * from `table[el.dataset[datasetKey]]`. The hover-description toggle named by
 * `settingKey` is checked once up front, so it's a cheap no-op when off. Used by
 * the character vitals/stats, steading stats, etc. — same shape everywhere.
 *
 * @param {HTMLElement|JQuery} html  Sheet root (jQuery wrapper or element).
 * @param {object}   opts
 * @param {string}   opts.selector    CSS selector for the labels.
 * @param {string}   opts.datasetKey  camelCase dataset key holding the lookup id.
 * @param {Record<string,string>} opts.table  lookup id → tooltip text.
 * @param {string}   opts.settingKey  hoverDescriptions* setting that gates it.
 * @param {"UP"|"DOWN"} [opts.direction="UP"]  tooltip placement.
 */
export function applyLabelTooltips(html, { selector, datasetKey, table, settingKey, direction = "UP" }) {
	if (!getHoverDescriptionSetting(settingKey)) return;
	const root = html?.[0] ?? html;
	if (!root?.querySelectorAll) return;
	for (const el of root.querySelectorAll(selector)) {
		const tooltip = table[el.dataset[datasetKey]];
		if (tooltip) {
			el.dataset.tooltip = tooltip;
			el.dataset.tooltipDirection = direction;
		}
	}
}
