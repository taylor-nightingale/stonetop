// ── Character-creation FAQ, mapped onto onboarding steps ─────────────────────
// The seeded "Setting Overview" journal carries a hand-authored "Character
// Creation FAQ" page. Its questions line up with the pages of the character
// onboarding modal, so each step that has relevant answers shows an orange "?"
// badge (hover → the step's questions, click → the full FAQ page).
//
// The FAQ prose stays single-sourced in the journal — we parse it at render
// time rather than copying it here. Parsing is string-based (no DOM) so it runs
// the same in Foundry's browser and under the node test runner.

import { settingOverviewPages } from "./seeded-journals.js";

export const FAQ_PAGE_NAME = "Character Creation FAQ";

// Onboarding step type → lowercase substrings matched against each FAQ question.
// A question lands on a step if its (lowercased) text contains any of the step's
// keys. Steps with no entry get no badge. The back-page steps (Seeker arcana and
// the dynamic `lore:*` sections) have no FAQ here — that content is N/A for this
// module. Tune freely as the FAQ prose evolves.
export const STEP_FAQ_KEYS = {
	instinct:          ["what does my instinct do"],
	appearance:        ["pick from these appearances"],
	origin:            ["pick one of these names", "have to live in stonetop"],
	stats:             ["roll +", "6 or less", "advantage"],
	possession:        ["armor", "◇", "different special possession", "weapons or gear", "damage do weapons", "various tags"],
	moves:             ["advantage", "various tags"],
};

// Minimal entity decode — enough to clean the question text we match/display a
// key on. We never run this over the answer html (that stays verbatim).
function decodeEntities(text) {
	return String(text ?? "")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

function stripTags(html) {
	return String(html ?? "").replace(/<[^>]+>/g, "");
}

// Split the FAQ page's HTML into ordered Q&A items. The page is a flat run of
// <h3> section headers and <p><strong>Question?</strong><br>Answer…</p> blocks;
// a <p> counts as a Q&A only when its content opens with a <strong> (the
// question). Returns { question, section, html } per item — `html` is the whole
// <p> (bold question + answer) so it can be dropped straight into the popup.
export function parseFaqItems(html) {
	const items = [];
	let section = "";
	const blockRe = /<(h3|p)\b[^>]*>([\s\S]*?)<\/\1>/gi;
	let match;
	while ((match = blockRe.exec(String(html ?? "")))) {
		const [whole, tag, inner] = match;
		if (tag.toLowerCase() === "h3") {
			section = decodeEntities(stripTags(inner)).trim();
			continue;
		}
		const strongMatch = inner.match(/^\s*<strong>([\s\S]*?)<\/strong>/i);
		if (!strongMatch) continue;
		items.push({
			question: decodeEntities(stripTags(strongMatch[1])).trim(),
			section,
			html: whole,
		});
	}
	return items;
}

// Pure: the parsed items relevant to a step, in document order, de-duplicated.
export function faqItemsForStep(stepType, items) {
	const keys = STEP_FAQ_KEYS[stepType];
	if (!keys?.length) return [];
	const seen = new Set();
	return items.filter(item => {
		const q = item.question.toLowerCase();
		if (!keys.some(key => q.includes(key))) return false;
		if (seen.has(item.question)) return false;
		seen.add(item.question);
		return true;
	});
}

// The seeded FAQ page doc, or null if the journal isn't seeded/visible here.
export function faqPage() {
	return settingOverviewPages().find(p => p.name === FAQ_PAGE_NAME) ?? null;
}

// Convenience used by the onboarding dialog: the FAQ items relevant to a step.
// Empty when the FAQ page isn't available or the step has no mapped questions.
export function faqForStep(stepType) {
	const page = faqPage();
	if (!page) return [];
	return faqItemsForStep(stepType, parseFaqItems(page.text?.content ?? ""));
}
