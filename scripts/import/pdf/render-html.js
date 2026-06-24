import { escapeHtml } from "../html.js";
import { isAvara, isItalic, isBoldBody, isDingbat } from "./fonts.js";

// Renders the structured article document produced by `extractArticle` (layout.js) to HTML. The
// document is renderer-agnostic — assets are referenced by an opaque ref and resolved here via
// `opts.asset`, so the same document drives both the dev HTML preview and the Foundry journal pack
// (each supplies its own asset paths and stylesheet for the shared class names).

// ─── inline emphasis ─────────────────────────────────────────────────────────
const emphOf = (f) => (isItalic(f) && isBoldBody(f) ? "bi" : isItalic(f) ? "i" : isBoldBody(f) ? "b" : "");
const WRAP = { b: ["<strong>", "</strong>"], i: ["<em>", "</em>"], bi: ["<strong><em>", "</em></strong>"] };
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Render a line's spans to HTML, merging adjacent same-emphasis runs, ws outside tags. */
function renderSpans(spans) {
	const toks = [];
	for (const s of spans) {
		if (isDingbat(s.font)) continue;
		const emph = emphOf(s.font);
		const last = toks[toks.length - 1];
		if (last && last.emph === emph) last.text += s.text;
		else toks.push({ emph, text: s.text });
	}
	let html = "";
	for (const t of toks) {
		const raw = escapeHtml(t.text);
		if (!t.emph) { html += raw; continue; }
		const [, lead, core, trail] = raw.match(/^(\s*)(.*?)(\s*)$/s);
		html += core ? `${lead}${WRAP[t.emph][0]}${core}${WRAP[t.emph][1]}${trail}` : raw;
	}
	return html;
}

/** Join lines into one HTML string, de-hyphenating words split across line ends. */
export function joinLines(lines) {
	let html = "", prevRaw = null;
	for (const l of lines) {
		const h = renderSpans(l.spans).trim();
		const raw = l.text.trim();
		if (prevRaw == null) html = h;
		// An ellipsis-led line is a pick-list / trade option: keep the lead-in and put it on its own
		// line. The book writes it as either the "…" glyph or three literal dots.
		else if (/^(?:…|\.\.\.)/.test(raw)) html += "<br>" + h;
		// De-hyphenate a word split across lines — even when the word is emphasized, so the
		// trailing hyphen sits just inside a closing tag (e.g. "<strong>Dan-</strong>" + "gers").
		else if (/[A-Za-z]-$/.test(prevRaw) && /^[a-z]/.test(raw)) html = html.replace(/-((?:<\/(?:strong|em)>)*)$/, "$1") + h;
		else html += " " + h;
		prevRaw = raw;
	}
	return html.replace(/[ \t]{2,}/g, " ").trim();
}

// ─── stat blocks ─────────────────────────────────────────────────────────────
const isStatName = (l) => isAvara(l.font) && l.size < 11;
const isItalicLine = (l) => l.spans.length > 0 && l.spans.every((s) => isItalic(s.font) || !s.text.trim());
const isFieldLine = (l) => /^(HP\b|Armor\b|Damage\b|Instinct\b|Special qualit)/i.test(l.text.trim());
const isMoveBullet = (l) => /^ä\s/.test(l.text.trim());

/** Render a stat block: name (with its marker icon), tags, fields, and a move list. When
 *  `skipName` is set, the name is omitted (it's promoted to the enclosing NPC box title). */
function renderStatBlock(lines, icon, skipName, ctx) {
	const parts = [];
	let moves = null, moveX = 0, moveY = 0; // open <li> list + the current move's left edge & last line's y
	const flushMoves = () => { if (moves) { parts.push(`<ul class="sb-moves">${moves.map((m) => `<li>${joinLines(m)}</li>`).join("")}</ul>`); moves = null; } };
	let field = null; // current field line + continuations
	const flushField = () => { if (field) { parts.push(`<div>${joinLines(field)}</div>`); field = null; } };

	for (let k = 0; k < lines.length; k++) {
		const l = lines[k];
		if (k === 0 && isStatName(l)) {
			if (skipName) continue; // the name is promoted to the NPC box title
			const ic = icon ? `<img class="icon" src="${escapeHtml(ctx.asset(icon.file))}">` : "";
			parts.push(`<div class="sb-name">${ic}<strong>${escapeHtml(l.text.trim())}</strong></div>`);
			continue;
		}
		if (!moves && !field && isItalicLine(l)) { parts.push(`<div class="sb-tags">${renderSpans(l.spans).trim()}</div>`); continue; }
		if (isMoveBullet(l)) { flushField(); (moves ??= []).push([l]); moveX = l.bbox[0]; moveY = l.bbox[1]; continue; }
		// A move's value wraps to following lines — either indented past the bullet (e.g. a second
		// wrap like "ignores armor)"), or, when the book aligns the wrap under the bullet at the
		// same x, simply sitting tight below the previous move line.
		if (moves && !isFieldLine(l) && (l.bbox[0] > moveX + 3 || l.bbox[1] - moveY <= l.size * 1.7)) {
			moves[moves.length - 1].push(l); moveY = l.bbox[1]; continue;
		}
		flushMoves();
		// A field's value wraps to following lines until the next labelled field / move / name —
		// join them even when the wrap isn't indented (e.g. Instinct "… as black and white").
		if (isFieldLine(l)) { flushField(); field = [l]; }
		else if (field) field.push(l);
		else { parts.push(`<div>${joinLines([l])}</div>`); }
	}
	flushField(); flushMoves();
	// When promoted into an NPC box, render without the bordered aside (the box is the card) —
	// avoids a box within a box.
	return skipName ? parts.join("") : `<aside class="statblock">${parts.join("")}</aside>`;
}

// ─── tables & lists ────────────────────────────────────────────────────────────
function renderTable({ header, rows, rollTable }) {
	const body = rows.map((r) => `<tr><td>${joinLines([r.roll])}</td><td>${joinLines(r.rest)}</td></tr>`).join("");
	// A rollable table shows its formula + title in the draw header above ("[🎲 1d12] Title"), where
	// the bracketed icon+formula is a @DrawTable token the runtime enricher turns into a GM roll
	// button — so the in-table header row would just duplicate it; omit it. A static (non-rollable)
	// table keeps its verbatim header row. The preview never annotates, so it shows the static form.
	if (rollTable) {
		const short = rollTable.name.includes(" — ") ? rollTable.name.slice(rollTable.name.indexOf(" — ") + 3) : rollTable.name;
		const drawHead = `<p class="wonder-draw">@DrawTable[${rollTable.uuid}]{${rollTable.formula}}<span class="wonder-table-name">${escapeHtml(short)}</span></p>`;
		return `${drawHead}<table><tbody>${body}</tbody></table>`;
	}
	let head = "";
	if (header) {
		const label = header.label ? capitalize(header.label.trim()) : "";
		head = `<thead><tr><th>${escapeHtml(header.roll || "")}</th><th>${escapeHtml(label)}</th></tr></thead>`;
	}
	return `<table>${head}<tbody>${body}</tbody></table>`;
}

function renderValueTable({ header, rows }) {
	const head = `<thead><tr><th>${escapeHtml(capitalize(header))}</th><th>Value</th></tr></thead>`;
	const body = rows.map((r) => `<tr><td>${joinLines(r.label)}</td><td>${joinLines([r.value])}</td></tr>`).join("");
	return `<table>${head}<tbody>${body}</tbody></table>`;
}

function renderListItem(lines) {
	// A leading swirl marker (from the vector layer) becomes the item's bullet via a CSS class.
	const f = lines[0]?.spans?.[0]?.font || "";
	let cls = /^swirl-point/.test(f) ? "swirl-point" : /^swirl/.test(f) ? "swirl" : "";
	let html = joinLines(lines).replace(/^(?:[•◦‣▪]\s*)/, "");
	// A leading "ä" is the book's stylized arrow bullet → strip it and mark the item.
	if (/^ä\s/.test(html)) { cls = "arrow"; html = html.replace(/^ä\s*/, ""); }
	return { cls, html };
}

/** The book never mixes bullet glyphs within one list, but marker detection can miss an item or
 *  two — so a list takes its single dominant bullet style and applies it to every item. */
function listBullet(items) {
	const counts = new Map();
	for (const it of items) if (it.cls) counts.set(it.cls, (counts.get(it.cls) || 0) + 1);
	let best = "", n = 0;
	for (const [c, k] of counts) if (k > n) { best = c; n = k; }
	return best;
}

const renderList = (items) => { const cls = listBullet(items); return `<ul>${items.map((it) => `<li${cls ? ` class="${cls}"` : ""}>${it.html}</li>`).join("")}</ul>`; };

/**
 * Render a settlement (steading) stat block as one bordered card. The block's lines fall into three
 * indents off the leftmost field column: flush fields/sub-headings (Size, Population, Prosperity,
 * Resources, Defenses) each on their own line; bullet items one step in; their wraps a further step
 * in. Fields break any open list, so Resources and Defenses keep their own bullets.
 */
function renderSettlementBlock(lines) {
	const fieldX = Math.min(...lines.map((l) => l.bbox[0]));
	const segs = []; // { field:[lines] } | { items:[[lines]] }
	let cur = null;
	for (const l of lines) {
		const hasBullet = /^swirl/.test(l.spans?.[0]?.font || "") || /^ä\s/.test(l.text.trim());
		if (l.bbox[0] <= fieldX + 4 && !hasBullet) segs.push(cur = { field: [l] });            // a field / sub-heading line
		else if (hasBullet || l.bbox[0] <= fieldX + 10) { if (!cur?.items) segs.push(cur = { items: [] }); cur.items.push([l]); } // a bullet item
		else if (cur?.items) cur.items[cur.items.length - 1].push(l);                          // a wrapped bullet line
		else if (cur?.field) cur.field.push(l);                                                // a wrapped field line
		else segs.push(cur = { field: [l] });
	}
	const body = segs.map((s) => s.field ? `<div>${joinLines(s.field)}</div>` : renderList(s.items.map(renderListItem))).join("");
	return `<aside class="statblock settlement">${body}</aside>`;
}

/** Render one column's blocks to HTML. `ctx` carries the asset resolver and the braid markup. */
function renderColumn(blocks, ctx) {
	const out = [];
	// Collapse any run of consecutive dividers into one (the book never stacks two with no content
	// between — duplicates come from rules drawn as two strokes or back-to-back section edges).
	let pendingDivider = null; // "braid" | "line" | null
	const flush = () => { if (pendingDivider) { out.push(pendingDivider === "braid" ? ctx.braid : '<hr class="rule">'); pendingDivider = null; } };
	for (const b of blocks) {
		if (b.type === "rule") { pendingDivider = pendingDivider === "braid" ? "braid" : (b.kind === "braid" ? "braid" : "line"); continue; }
		flush();
		switch (b.type) {
			case "title": break; // the article title is captured during extraction, not rendered inline
			case "heading": {
				let t = b.line.text.trim();
				// The book marks call-out titles by flanking them with dots (". trade opportunities .").
				// Strip the dots and tag it so it gets the small-caps title styling.
				const callout = t.match(/^\.\s+(.+?)\s+\.$/);
				if (callout) t = callout[1];
				const cls = callout ? ' class="callout-title"' : "";
				const icons = (b.icons || []).map((im) => `<img class="icon" src="${escapeHtml(ctx.asset(im.file))}">`).join("");
				out.push(`<${b.level}${cls}>${icons}${escapeHtml(b.cap ? capitalize(t) : t)}</${b.level}>`);
				break;
			}
			case "para":    {
				const icon = (im) => im ? `<img class="icon" src="${escapeHtml(ctx.asset(im.file))}">` : "";
				// An artifact's qualities/tags line, kept on its own line under the title.
				if (b.tags) { out.push(`<p class="artifact-tags">${(b.icons || []).map(icon).join("")}${joinLines(b.lines)}</p>`); break; }
				// A merged "people" paragraph: each entry (icon + text) flows inline, no breaks.
				if (b.entries) { out.push(`<p>${b.entries.map((e) => icon(e.icon) + joinLines(e.lines)).join(" ")}</p>`); break; }
				out.push(`<p>${(b.icons || []).map(icon).join("")}${joinLines(b.lines)}</p>`);
				break;
			}
			case "list":    out.push(renderList(b.items.map(renderListItem))); break;
			case "table":   out.push(renderTable(b)); break;
			case "valuetable": out.push(renderValueTable(b)); break;
			case "statblock": out.push(renderStatBlock(b.lines, b.icon, b.promoted, ctx)); break;
			case "settlement": out.push(renderSettlementBlock(b.lines)); break;
			case "image":   { const im = b.image; out.push(`<figure class="${im.w < 60 ? "icon" : "art"}"><img src="${escapeHtml(ctx.asset(im.file))}"></figure>`); break; }
			case "boxstart": out.push('<div class="box">'); break;
			case "boxend":   out.push('</div>'); break;
		}
	}
	flush();
	return out.join("\n");
}

/**
 * Render a structured article document to HTML.
 *   `opts.asset(ref)` — resolve an image reference (illustrations, icons) to a URL/src. Defaults to
 *                       identity (the preview pre-resolves to relative paths).
 *   `opts.chrome.chain` — the braided-rule asset used for the section/page dividers; when absent the
 *                       dividers fall back to plain `<hr>` placeholders.
 * Swirl/arrow list bullets and the resource/outfit markers are CSS (shared class names) — each
 * environment's stylesheet points the bullet image at its own asset path.
 */
export function renderHtml(article, { asset = (r) => r, chrome = {} } = {}) {
	const chain = chrome.chain ? escapeHtml(asset(chrome.chain)) : null;
	const ctx = { asset, braid: chain ? `<img class="braid" src="${chain}">` : '<hr class="braid">' };
	const braidWide = chain ? `<img class="braid-wide" src="${chain}">` : '<hr class="braid-wide">';
	const banner = (im) => `<figure class="art"><img src="${escapeHtml(asset(im.file))}"></figure>`;
	const page2col = (cols) => cols.length ? `<div class="page2col">${cols.map((c) => `<div class="col">${renderColumn(c.blocks, ctx)}</div>`).join("")}</div>` : "";

	const sections = article.sections.map((s) => {
		let html = "";
		for (const im of s.bannersTop) html += banner(im);
		// A braid band separates the top printed page (A|B) from the bottom one (C|D).
		html += page2col(s.left) + (s.left.length && s.right.length ? braidWide : "") + page2col(s.right);
		for (const im of s.bannersBottom) html += banner(im);
		if (s.npc) {
			const ic = s.npc.icon ? `<img class="icon" src="${escapeHtml(asset(s.npc.icon.file))}">` : "";
			html = `<section class="npc-box"><div class="npc-title">${ic}${escapeHtml(s.npc.title)}</div>${html}</section>`;
		}
		return html;
	});
	// Every section is one printed spread; separate consecutive spreads with the same page-band braid
	// that divides the two pages within a spread, so each printed-page boundary gets a divider.
	return sections.filter(Boolean).join(`\n${braidWide}\n`);
}
