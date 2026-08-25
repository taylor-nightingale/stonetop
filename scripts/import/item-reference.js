// Render one of Book I's value tables as the reference page shows it.
//
// The page itself comes from the shared book pipeline (build-book-one.js), which reproduces the
// article's own formatting and images but renders these tables generically — dropping the ◇ load
// column, truncating wrapped rows, and leaving every name as plain text. This rebuilds them from the
// geometric parse (pdf/items.js), which gets all of that right, and writes each name as a @UUID
// content link so the row is a draggable item rather than a description of one.

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
