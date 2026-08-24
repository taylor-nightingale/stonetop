// Render the "Common & Special Items" reference journal page: Book I's Value guide (printed
// pp. 92-93) followed by both value tables (pp. 94-97), grouped item type → category → Value.
//
// Every row that resolves to a pack item is written as a @UUID content link, which Foundry renders
// as a draggable chip — dragging one onto a character sheet is the whole point of the page, so the
// link IS the row's name rather than an icon beside it. Rows the book prints as cross-references
// ("Weapons of war (see above)") have no item and stay plain text.

import { escapeHtml } from "./html.js";

/** The book's ○ track as it prints it: consecutive unlabelled slots ride along with the next label,
 *  so `["", "", "hours"]` reads "○○○ hours" and not "○, ○, ○ hours". */
export function renderResource(resource) {
	if (!resource?.labels?.length) return [];
	const out = [];
	let circles = "";
	for (const label of resource.labels) {
		circles += "○";
		if (!label) continue;
		out.push(`${circles} ${escapeHtml(label)}`);
		circles = "";
	}
	if (circles) out.push(circles);
	return out;
}

/** The parenthetical the book sets after an item's name — tags in italics, mechanical notes roman,
 *  then the resource track. */
export function renderDetail(item) {
	const parts = [
		...item.tagList.map((t) => `<em>${escapeHtml(t)}</em>`),
		...(item.note ? [escapeHtml(item.note)] : []),
		...renderResource(item.resource),
	];
	return parts.length ? `<span class="item-ref-detail">(${parts.join(", ")})</span>` : "";
}

/** Emphasis markers as the stat blocks carry them (`_hand_`) → HTML. Everything else is escaped. */
export function renderInline(markdown) {
	return escapeHtml(markdown).replace(/_([^_]+)_/g, "<em>$1</em>");
}

/** An item's name, as a draggable content link when it resolves to a pack item. */
function renderName(row) {
	const name = escapeHtml(row.item.name);
	return row.uuid ? `@UUID[${row.uuid}]{${name}}` : name;
}

const loadCell = (item) => (item.weight > 0 ? "◇".repeat(item.weight) : "□");

/** One category's table. Rows are ordered by Value (the book's order breaks ties), so a category
 *  that spans several Values reads cheapest-first. */
export function renderCategory(section, rows, { title }) {
	const ordered = rows.map((r, i) => [r, i])
		.sort(([a, i], [b, j]) => a.item.value - b.item.value || i - j)
		.map(([r]) => r);
	const body = ordered.map((row) => {
		const stat = row.item.statBlock ? `<div class="item-ref-stats">${renderInline(row.item.statBlock)}</div>` : "";
		return `<tr>`
			+ `<td>${renderName(row)} ${renderDetail(row.item)}${stat}</td>`
			+ `<td class="item-ref-load">${loadCell(row.item)}</td>`
			+ `<td class="item-ref-value">${row.item.value}${row.item.footnoted ? "*" : ""}</td>`
			+ `</tr>`;
	}).join("");
	const footnote = section.footnote ? `<p class="item-ref-footnote">${escapeHtml(section.footnote)}</p>` : "";
	return `<section class="item-ref-category">`
		+ `<h3>${escapeHtml(title)}</h3>`
		+ `<table class="item-ref-table">`
		+ `<thead><tr><th>Item</th><th class="item-ref-load">Load</th><th class="item-ref-value">Value</th></tr></thead>`
		+ `<tbody>${body}</tbody></table>${footnote}</section>`;
}

/** The Value ladder and the Coins sidebar — what a price MEANS, before the tables that set prices. */
export function renderValueGuide(guide) {
	const tiers = guide.tiers.map((t) =>
		`<section class="item-ref-tier"><h3>Value ${t.value}</h3><ul>`
		+ t.equivalences.map((e) => `<li>${renderInline(e)}</li>`).join("")
		+ `</ul></section>`).join("");
	const notes = guide.notes.map((n) => `<p class="item-ref-note">${renderInline(n)}</p>`).join("");
	const coins = `<section class="item-ref-coins"><h2>Coins</h2>`
		+ guide.coins.paragraphs.map((p) => `<p>${renderInline(p)}</p>`).join("")
		+ (guide.coins.bullets.length
			? `<ul>${guide.coins.bullets.map((b) => `<li>${renderInline(b)}</li>`).join("")}</ul>` : "")
		+ `</section>`;
	return `<section class="item-ref-values"><h2>What a Value is worth</h2>`
		+ (guide.lead ? `<p class="item-ref-lead">${renderInline(guide.lead)}</p>` : "")
		+ `<div class="item-ref-tiers">${tiers}</div>${notes}</section>${coins}`;
}

/**
 * The whole page.
 *
 * `tables` are the parsed value tables in book order; `rowsFor` hands back the resolved rows for a
 * section, so resolution (item-docs.js) stays out of the rendering.
 */
export function renderItemReference({ guide, tables, rowsFor, sectionTitle, bookPages }) {
	const tableHtml = tables.map((table) =>
		`<section class="item-ref-group">`
		+ `<h2>${escapeHtml(table.name)}</h2>`
		+ (table.lead ? `<p class="item-ref-lead">${renderInline(table.lead)}</p>` : "")
		+ table.sections.map((s) => renderCategory(s, rowsFor(s), { title: sectionTitle(s.title) })).join("")
		+ `</section>`).join("");
	return `<div class="stonetop-item-reference">`
		+ `<p class="item-ref-pageref">Stonetop — p.${bookPages}</p>`
		+ renderValueGuide(guide)
		+ tableHtml
		+ `</div>`;
}
