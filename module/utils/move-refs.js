// Shared move cross-reference hover tooltips. A move's trigger is often written as
// a phrase that embeds a basic move's name — e.g. the Ranger's Naturalist reads
// "Know Things about beasts, natural environs, or spirits of the wild", or the
// Heavy's Bringer of Ruin reads "roll a 12+ to Clash …". Rather than match a bolded
// phrase against an item name (which only works when the phrase IS the move name),
// we wrap each curated basic-move name wherever it appears in a description into a
// surgical `.stonetop-move-ref` hover target, so the name itself — not the whole
// phrase — is what the player hovers to read the referenced move.
//
// Used by both the character sheet and the onboarding dialog so the two paths can't
// drift. Only the player-facing basic/common moves are listed: those are the cross
// references a new player actually needs explained; a playbook move's own trigger
// would just point back at itself.

// Longest names first so the alternation prefers the longer match.
export const MOVE_REF_NAMES = [
	"Persuade (vs. NPCs)",
	"Persuade (vs. PCs)",
	"Have What You Need",
	"Return Triumphant",
	"Struggle as One",
	"Chart a Course",
	"Keep Company",
	"Defy Danger",
	"Know Things",
	"Seek Insight",
	"Make Camp",
	"Requisition",
	"Let Fly",
	"Outfit",
	"Forage",
	"Recover",
	"Defend",
	"Clash",
	"Aid",
];

const MOVE_REF_RE = new RegExp(
	`(?<!\\w)(${MOVE_REF_NAMES.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?!\\w)`,
	"g"
);

const _moveRefCache = new Map();

// The referenced move's description HTML, or null when no such move item exists.
// Cached across both call sites so a hover never re-scans the packs for a name.
export async function fetchMoveRef(name) {
	const key = name.toLowerCase();
	if (_moveRefCache.has(key)) return _moveRefCache.get(key);
	const packs = game.packs.filter(p => p.metadata.packageName === "stonetop" && p.metadata.type === "Item");
	for (const pack of packs) {
		await pack.getIndex();
		const entry = pack.index.find(e => e.name.toLowerCase() === key);
		if (!entry) continue;
		const doc  = await pack.getDocument(entry._id);
		const desc = doc?.system?.description ?? null;
		_moveRefCache.set(key, desc);
		return desc;
	}
	_moveRefCache.set(key, null);
	return null;
}

// Wrap every occurrence of a curated move name in `container`'s text into a
// `<span class="stonetop-move-ref" data-move-name="…">`. Idempotent against its own
// output: text already inside a `.stonetop-move-ref` is skipped.
export function enrichMoveRefsInEl(container) {
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
		acceptNode: node =>
			node.parentElement?.closest(".stonetop-move-ref")
				? NodeFilter.FILTER_REJECT
				: NodeFilter.FILTER_ACCEPT,
	});
	const toReplace = [];
	let node;
	while ((node = walker.nextNode())) {
		MOVE_REF_RE.lastIndex = 0;
		if (MOVE_REF_RE.test(node.textContent)) toReplace.push(node);
	}
	for (const textNode of toReplace) {
		const text = textNode.textContent;
		const frag = document.createDocumentFragment();
		let lastIdx = 0;
		MOVE_REF_RE.lastIndex = 0;
		let m;
		while ((m = MOVE_REF_RE.exec(text)) !== null) {
			if (m.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));
			const span = document.createElement("span");
			span.className = "stonetop-move-ref";
			span.dataset.moveName = m[1];
			span.textContent = m[1];
			frag.appendChild(span);
			lastIdx = m.index + m[1].length;
		}
		if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
		textNode.parentNode?.replaceChild(frag, textNode);
	}
}
