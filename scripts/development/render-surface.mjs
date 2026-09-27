/**
 * Render a real sheet surface, or audit every pack document through the partial that draws it.
 *
 * Why this exists: a hand-drawn mockup of this sheet is wrong. Not occasionally — every one drawn
 * for the redesign study invented a field, missed a branch, or got a composition backwards, because
 * drawing means reconstructing the sheet from its data instead of rendering it. This runs the REAL
 * partials over the REAL pack JSON under the REAL stylesheets, so a picture it takes cannot contain
 * something the sheet does not draw, and cannot omit something it does.
 *
 *   node scripts/development/render-surface.mjs shot <surface> [out.png]
 *   node scripts/development/render-surface.mjs audit [kind]
 *
 * `audit` is the half that answers "did we miss anything": it renders every document of a kind and
 * reports any authored string that never reaches the output.
 *
 * One limit worth knowing before reading a figure: Foundry's TextEditor is not here, so an inline
 * roll survives as its source text — Enfys's damage draws as `bronze knife [[/r 1d4]] (hand)` rather
 * than as the clickable 1d4 the app makes of it. That is the harness, not the sheet;
 * `toRollableMarkup` shields `[[…]]` from the markdown pass precisely so enrichHTML can claim it at
 * runtime.
 */
import { readFileSync, readdirSync, statSync, mkdirSync } from "fs";
import path from "path";

// Foundry globals the snapshot modules touch at import time.
globalThis.Hooks ??= { once() {}, on() {} };
globalThis.CONFIG ??= {};
globalThis.game ??= { i18n: { localize: k => k, format: (k, d) => k, has: () => true } };

const ROOT = process.cwd();
const PACKS = path.join(ROOT, "packs/src");

export function packDocs(dir) {
	const base = path.join(PACKS, dir);
	const out = [];
	(function walk(d) {
		for (const name of readdirSync(d)) {
			const p = path.join(d, name);
			if (statSync(p).isDirectory()) { if (name !== "_folders") walk(p); }
			else if (name.endsWith(".json")) out.push({ file: p, doc: JSON.parse(readFileSync(p, "utf8")) });
		}
	})(base);
	return out;
}

/** Every authored string in a value, flattened — what the output has to account for. */
export function authoredStrings(value, seen = []) {
	if (typeof value === "string") { const t = value.trim(); if (t) seen.push(t); }
	else if (Array.isArray(value)) value.forEach(v => authoredStrings(v, seen));
	else if (value && typeof value === "object") Object.values(value).forEach(v => authoredStrings(v, seen));
	return seen;
}

/** Markdown and roll syntax stripped, so a comparison is about CONTENT and not about markup. */
export function plainText(html) {
	return html
		// Attribute VALUES count as rendered: a placeholder and an aria-label are text the reader or
		// their screen reader gets. Every such attribute, not the first — a lazy one-per-tag match
		// captured the aria-label and swallowed the placeholder after it on the same element.
		.replace(/<[^>]+>/g, tag =>
			" " + [...tag.matchAll(/(?:placeholder|aria-label|title|alt|value)="([^"]*)"/g)]
				.map(m => m[1]).join(" ") + " ")
		.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
		.replace(/&nbsp;/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
		.replace(/\s+/g, " ").trim();
}

export function normalise(s) {
	return s
		.replace(/\*\*\*|\*\*|\*|_{1,2}|`/g, "")      // markdown emphasis
		.replace(/\[\[[^\]]*\]\]/g, "")                 // [[/r 1d4]]
		.replace(/^[-•◇◆○●☐☑]\s*/gm, "")               // list and pip markers
		.replace(/&amp;/g, "&")
		.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
		.replace(/\s+/g, " ")
		// Stripping <em> leaves a space where the tag was, so "*trigger*, then" comes back as
		// "trigger , then" while the source normalises to "trigger, then". Comparing those reports
		// every emphasised move as dropped — 30 of the first 44 "misses" were this.
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * The form the audit compares on: normalised, then stripped of whitespace entirely.
 *
 * Whitespace is where every false positive lived. Rendering inserts a space for each tag boundary,
 * so `<em>e</em>ither` came back as "e ither"; bullets flatten differently from their markdown;
 * emphasis before a comma leaves "trigger ,". Chasing those with one regex after another found
 * three more each time. Ignoring whitespace ends the class, and costs nothing — a partial that
 * dropped a word would still fail, because the word itself would be gone.
 */
export function squeeze(s) {
	return normalise(s).replace(/\s+/g, "").toLowerCase();
}

/**
 * A surface as the sheet draws it: real partials, real pack data, real stylesheets.
 *
 * Each entry returns the markup for one region. They are deliberately thin — the fixture work is
 * choosing which document to feed in, not composing markup, because composing markup by hand is the
 * thing this file exists to stop.
 */
export const SHOTS = {
	"follower-card": () => {
		const { doc } = packDocs("followers").find(d => d.doc.system?.slug === "enfys");
		return card(shown("stonetop.follower-card",
			{ ...buildFollowerSnapshot(doc), showDelete: true }), 520);
	},
	"move-row": () => {
		const rows = ["anger-is-a-gift", "potential-for-greatness", "i-get-knocked-down", "improved-stat"]
			.map(slug => packDocs("moves").find(d => d.doc.system?.slug === slug).doc)
			.map(doc => `<li class="stonetop-item">${shown("stonetop.move-item",
				{ ...buildCatalogMoveSnapshot(doc, "would-be-hero"),
				  categoryKey: "would-be-hero", showCheck: true, disclosure: false })}</li>`)
			.join("");
		return card(`<div class="tab moves active"><section class="sheet-tab">
			<div class="stonetop-move-group"><ol class="items-list">${rows}</ol></div>
		</section></div>`, 1046);
	},
	"destined": () => {
		const pb = packDocs("playbooks").find(d => d.doc.system?.slug === "the-would-be-hero").doc.system;
		const bgs = Array.isArray(pb.backgrounds) ? pb.backgrounds : pb.backgrounds.options;
		const bg = bgs.find(b => b.slug === "destined");
		const group = buildChoiceGroup(bg.choices);
		const rows = group.list.map(row => shown("stonetop.choice-row",
			{ ...row, cgContext: "background", cgGroup: group.slug, namePrefix: "destined" })).join("");
		return card(`<div class="tab playbook active"><section class="sheet-tab">
			<div class="details-section"><label class="stonetop-item is-checked">
				<div class="stonetop-item-header"><strong class="stonetop-item-name">${bg.label}</strong></div>
				<div class="stonetop-choice-rows">${rows}</div>
			</label></div></section></div>`, 620);
	},
};

/** The sheet's own chrome around a region, so what is rendered is what the sheet renders. */
function card(inner, width) {
	return `<div class="application stonetop sheet actor character themed theme-light" style="width:${width}px">
		<div class="window-content"><div class="sheet-wrapper">${inner}</div></div></div>`;
}

export async function shoot(surface, outFile) {
	const build = SHOTS[surface];
	if (!build) throw new Error(`unknown surface "${surface}" — try ${Object.keys(SHOTS).join(", ")}`);
	const { RenderProbe } = await import(`${ROOT}/tests/styles/RenderProbe.js`);
	const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css",
		"themes/parchment-dark.css", "tokens.css", "stonetop.css"]
		.map(f => path.join(ROOT, "styles", f)));
	return probe.snapshot({ bodyHtml: build(), bodyClass: "game themed theme-light",
		rootAttrs: 'style="font-size: 16px"', outFile, width: 1200, height: 900 });
}

// ── Audits ───────────────────────────────────────────────────────────────────
// Each renders every document of a kind through the partial that draws it and reports authored
// text that never reaches the output. A miss is either a shape the partial does not handle or a
// field nobody wired up; both are worth knowing and neither is visible from the data alone.

const { renderPartial } = await import(`${ROOT}/tests/fakes/renderTemplate.js`);
// Figures get real words: the bare harness's localize() returns the KEY, which is right for a
// template test and useless in a picture. Audits keep the bare renderer — a key is as good as a
// sentence when the question is "did this string reach the page at all".
const { renderLocalized } = await import(`${ROOT}/tests/styles/localizedPartial.js`);
const shown = (name, ctx) => renderLocalized(name, ctx, "en");
const { buildChoiceGroup } = await import(`${ROOT}/src/model/snapshot/character/buildChoiceGroup.js`);
const { buildCatalogMoveSnapshot } = await import(`${ROOT}/src/actors/embeddedMoves.js`);

/** Choice groups, wherever they live: playbooks, backgrounds, moves, possessions, followers. */
export function collectChoiceGroups() {
	const found = [];
	const add = (where, slug, group) => { if (group) found.push({ where, slug, group }); };

	for (const { doc } of packDocs("playbooks")) {
		const s = doc.system ?? {};
		for (const g of s.choices ?? []) add(`playbook:${s.slug}`, g.slug, g);
		const bgs = Array.isArray(s.backgrounds) ? s.backgrounds : s.backgrounds?.options;
		for (const b of bgs ?? []) add(`background:${b.slug}`, b.choices?.slug, b.choices);
		for (const key of ["appearance", "origin", "instinct", "introductions"]) {
			const v = s[key];
			if (v && typeof v === "object" && v.list) add(`${key}:${s.slug}`, v.slug, v);
		}
	}
	for (const dir of ["moves", "possessions", "followers", "inserts"])
		for (const { doc } of packDocs(dir)) {
			const s = doc.system ?? {};
			const groups = Array.isArray(s.choices) ? s.choices : (s.choices ? [s.choices] : []);
			for (const g of groups) add(`${dir}:${s.slug ?? doc.name}`, g.slug, g);
		}
	return found;
}

export function auditChoiceRows() {
	const misses = [];
	let rows = 0;
	for (const { where, group } of collectChoiceGroups()) {
		const built = buildChoiceGroup(group);
		for (const [i, row] of built.list.entries()) {
			rows++;
			let html;
			try {
				html = renderPartial("stonetop.choice-row",
					{ ...row, cgContext: "audit", cgGroup: built.slug, namePrefix: "audit" });
			} catch (e) {
				misses.push({ where, row: i, kind: "threw", detail: String(e).slice(0, 120) });
				continue;
			}
			const out = squeeze(plainText(html));
			const raw = group.list[i] ?? {};
			// Only what a reader is meant to SEE. A slug is an identifier and never reaches the page,
			// so counting one as dropped text would bury the real misses in noise — it did.
			const shown = [
				raw.content?.title, raw.content?.titleNote, raw.content?.subtitle,
				raw.content?.subtitleNote, raw.content?.text,
				raw.input?.placeholder,
				...(raw.options ?? []).map(o => o?.text),
			];
			for (const str of authoredStrings(shown)) {
				const want = squeeze(str);
				if (want.length > 3 && !out.includes(want))
					misses.push({ where, row: i, kind: "dropped", detail: normalise(str).slice(0, 80) });
			}
		}
	}
	return { rows, misses };
}

export function auditMoves() {
	const misses = [];
	let n = 0;
	for (const { doc } of packDocs("moves")) {
		const s = doc.system ?? {};
		if (!s.slug) continue;
		n++;
		let html;
		try {
			const snap = buildCatalogMoveSnapshot(doc, "audit");
			html = renderPartial("stonetop.move-item",
				{ ...snap, categoryKey: "audit", showCheck: true, disclosure: false });
		} catch (e) {
			misses.push({ where: s.slug, kind: "threw", detail: String(e).slice(0, 140) });
			continue;
		}
		const out = squeeze(plainText(html));
		// What the ROW is responsible for. Not the name of a `nameless` move — the row draws none by
		// design, the move's own words being the row. And not `moveResults`: those belong to the
		// chat card and the item sheet (move-result-row.hbs), never to a row on the tab, so
		// expecting them here would report 94 moves as broken for behaving correctly.
		const checks = { description: s.description };
		if (!s.nameless) checks.name = doc.name;
		for (const str of authoredStrings(checks)) {
			const want = squeeze(str);
			if (want.length > 3 && !out.includes(want))
				misses.push({ where: s.slug, kind: "dropped", detail: normalise(str).slice(0, 80) });
		}
	}
	return { moves: n, misses };
}

const { buildFollowerSnapshot } = await import(`${ROOT}/src/model/snapshot/character/buildFollowerSnapshot.js`);

export function auditFollowers() {
	const misses = [];
	let n = 0;
	for (const { doc } of packDocs("followers")) {
		const s = doc.system ?? {};
		if (!s.slug) continue;
		n++;
		let html;
		try {
			html = renderPartial("stonetop.follower-card", { ...buildFollowerSnapshot(doc), showDelete: true });
		} catch (e) {
			misses.push({ where: s.slug, kind: "threw", detail: String(e).slice(0, 140) });
			continue;
		}
		const out = squeeze(plainText(html));
		// What the card is responsible for drawing. Selections carry their options as a dropdown, so
		// only what is SELECTED has to be on the page; the rest is one click away by design.
		const checks = {
			name: doc.name, moves: s.moves, armor: s.armor, damage: s.damage,
			specialQuality: s.specialQuality, membersNote: s.membersNote,
			tags: s.tagList,
			instinct: s.instinct?.selected, cost: s.cost?.selected,
			members: (s.members ?? []).map(mem => mem.name).filter(Boolean),
		};
		for (const str of authoredStrings(checks)) {
			const want = squeeze(str);
			if (want.length > 3 && !out.includes(want))
				misses.push({ where: s.slug, kind: "dropped", detail: normalise(str).slice(0, 80) });
		}
	}
	return { followers: n, misses };
}

export function auditOutfitItems() {
	const misses = [];
	let n = 0;
	for (const { doc } of packDocs("outfit-items")) {
		const s = doc.system ?? {};
		if (!s.slug) continue;
		n++;
		// The outfit row is drawn inline by outfit-item-row.hbs from an InventorySnapshot item; the
		// fields a row must account for are its name, note, tags and qualifier.
		let html;
		try {
			html = renderPartial("stonetop.outfit-item-row", {
				slug: s.slug, name: doc.name, note: s.note ?? "", weight: s.weight ?? 0,
				tagList: s.tagList ?? [], qualifier: s.qualifier ?? "", marks: [],
			});
		} catch (e) {
			misses.push({ where: s.slug, kind: "threw", detail: String(e).slice(0, 140) });
			continue;
		}
		const out = squeeze(plainText(html));
		for (const str of authoredStrings({ name: doc.name, note: s.note, qualifier: s.qualifier })) {
			const want = squeeze(str);
			if (want.length > 3 && !out.includes(want))
				misses.push({ where: s.slug, kind: "dropped", detail: normalise(str).slice(0, 80) });
		}
	}
	return { items: n, misses };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const AUDITS = {
	"choice-rows": auditChoiceRows,
	moves: auditMoves,
	followers: auditFollowers,
	"outfit-items": auditOutfitItems,
};

if (process.argv[1]?.endsWith("render-surface.mjs")) {
	const [mode, arg] = process.argv.slice(2);
	if (mode === "audit") {
		const names = arg ? [arg] : Object.keys(AUDITS);
		let total = 0;
		for (const name of names) {
			const r = AUDITS[name]();
			const counted = Object.entries(r).find(([k]) => k !== "misses");
			total += r.misses.length;
			console.log(`\n${name}: ${counted[1]} rendered, ${r.misses.length} miss(es)`);
			for (const miss of r.misses)
				console.log(`  [${miss.kind}] ${miss.where}${miss.row !== undefined ? ` row${miss.row}` : ""} → ${miss.detail}`);
		}
		console.log(`\n${total} total.`);
		process.exit(total ? 1 : 0);
	} else if (mode === "shot") {
		const out = process.argv[4] ?? path.join(ROOT, "figures", `${arg}.png`);
		mkdirSync(path.dirname(out), { recursive: true });
		console.log(await shoot(arg, out));
	} else {
		console.log("usage: render-surface.mjs audit [choice-rows|moves|followers|outfit-items]");
		console.log("       render-surface.mjs shot <surface> [out.png]");
		console.log(`surfaces: ${Object.keys(SHOTS).join(", ")}`);
	}
}
