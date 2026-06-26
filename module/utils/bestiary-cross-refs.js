// Enriches read-mode bestiary prose with two passes:
//
//   1. Creature cross-links — wraps any creature name that resolves to a sheet
//      (via the monster-ref index) in <a class="stonetop-monster-ref">, carrying
//      a `data-tooltip` of that creature's concept (hover) and a `data-uuid`
//      (click opens its sheet — handled by the render hook).
//   2. Gear-tag tooltips — wraps known gear terms that appear inside a (...) tag
//      group in <span class="stonetop-gear-term"> with a `data-tooltip`. Limiting
//      to parentheses avoids tagging ordinary prose words ("by hand", "up close").
//
// Both operate on text nodes only and skip content already inside links, code,
// inputs, or a prior wrapper, so the passes compose and re-runs are idempotent.

import { findGearTerm } from "./gear-term-tooltips.js";
import {
	buildMonsterRefIndex,
	getMonsterRefRegex,
	lookupMonsterRef,
	creatureDisplayName,
} from "../bestiary/monster-ref-index.js";

const SKIP_TAGS = new Set(["A", "CODE", "PRE", "BUTTON", "TEXTAREA", "INPUT", "SELECT", "OPTION", "LABEL"]);
const SKIP_CLASSES = ["stonetop-gear-term", "stonetop-monster-ref"];

function _skipTextNode(node) {
	for (let el = node.parentElement; el; el = el.parentElement) {
		if (SKIP_TAGS.has(el.tagName)) return true;
		if (el.isContentEditable) return true;
		if (el.classList && SKIP_CLASSES.some(c => el.classList.contains(c))) return true;
	}
	return false;
}

function _collectTextNodes(root) {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const nodes = [];
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		if (n.nodeValue && n.nodeValue.trim() && !_skipTextNode(n)) nodes.push(n);
	}
	return nodes;
}

// ── Pass 1: creature cross-links ───────────────────────────────────────────
function _linkCreatureNames(root, selfNorm) {
	const regex = getMonsterRefRegex();
	if (!regex) return;
	for (const textNode of _collectTextNodes(root)) {
		const text = textNode.nodeValue;
		regex.lastIndex = 0;
		let match, last = 0, frag = null;
		while ((match = regex.exec(text)) !== null) {
			const rec = lookupMonsterRef(match[1]);
			if (!rec) continue;
			if (selfNorm && rec.name.toLowerCase() === selfNorm) continue; // don't self-link
			frag ??= document.createDocumentFragment();
			if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)));
			const a = document.createElement("a");
			a.className = "stonetop-monster-ref";
			a.dataset.uuid = rec.uuid;
			if (rec.concept) a.dataset.tooltip = rec.concept;
			a.textContent = match[0]; // includes any matched trailing "s"
			frag.appendChild(a);
			last = match.index + match[0].length;
		}
		if (frag) {
			if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
			textNode.replaceWith(frag);
		}
	}
}

// ── Pass 2: gear-tag tooltips inside parentheses ───────────────────────────
function _tagGearParens(root) {
	for (const textNode of _collectTextNodes(root)) {
		const text = textNode.nodeValue;
		if (!text.includes("(")) continue;
		const PAREN = /\(([^()]*)\)/g;
		let match, last = 0, frag = null;
		while ((match = PAREN.exec(text)) !== null) {
			const parts = match[1].split(",").map(p => ({ raw: p, trimmed: p.trim(), desc: findGearTerm(p.trim(), { omitSteadingNote: true }) }));
			if (!parts.some(p => p.desc)) continue;
			frag ??= document.createDocumentFragment();
			if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)));
			frag.appendChild(document.createTextNode("("));
			parts.forEach((p, i) => {
				if (p.desc) {
					const leading = p.raw.match(/^\s*/)[0];
					if (leading) frag.appendChild(document.createTextNode(leading));
					const span = document.createElement("span");
					// Tags italicise (see .stonetop-gear-term), but "n piercing" stays upright.
					span.className = /piercing\b/i.test(p.trimmed)
						? "stonetop-gear-term stonetop-gear-term--no-italic"
						: "stonetop-gear-term";
					span.dataset.tooltip = p.desc;
					span.textContent = p.trimmed;
					frag.appendChild(span);
				} else {
					frag.appendChild(document.createTextNode(p.raw));
				}
				if (i < parts.length - 1) frag.appendChild(document.createTextNode(","));
			});
			frag.appendChild(document.createTextNode(")"));
			last = match.index + match[0].length;
		}
		if (frag) {
			if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
			textNode.replaceWith(frag);
		}
	}
}

/** Ensure the creature index is built (and cached). */
export async function ensureMonsterRefIndex() {
	return buildMonsterRefIndex();
}

/**
 * Enrich one prose element in place. Synchronous — call ensureMonsterRefIndex()
 * once beforehand if you want creature links (otherwise only gear tags apply).
 */
export function enrichBestiaryElement(el, { selfName = "", monsterRefs = true, gearTags = true } = {}) {
	if (!el) return;
	if (monsterRefs) _linkCreatureNames(el, creatureDisplayName(selfName).toLowerCase());
	if (gearTags) _tagGearParens(el);
}
