// Pure helpers for the "managed journal" update channel (see SeedCompendiums.js).
// Kept Foundry-free so the fingerprinting + link-remap logic is unit-testable: the
// seed/update hooks supply plain document data (`toObject()`), these decide what
// changed.
//
// The update model: each seeded world journal stores a fingerprint of the content
// we last wrote to it (`flags.stonetop.journalSync.hash`). On a version bump we
// recompute that fingerprint; if it still matches, the GM hasn't touched the entry
// and we may safely refresh it to the newly-shipped version. If it differs, the GM
// has edited it — we leave it alone. The fingerprint is order-independent and id-
// independent so cosmetic churn (page ids, key order) never reads as an edit.

// Any @UUID into one of this system's compendiums.
export const SYSTEM_LINK = /@UUID\[(Compendium\.stonetop\.[^\]]+)\]/g;

// Build a rewriter that points a content string's compendium @UUID links at the
// world copies we seeded (`linkMap`: compendium-entry uuid → world-entry uuid).
// Links whose target we didn't seed aren't in the map and pass through unchanged.
export function makeRewriter(linkMap) {
	return str => (typeof str === "string" && str.includes("Compendium.stonetop."))
		? str.replace(SYSTEM_LINK, (m, uuid) => { const world = linkMap.get(uuid); return world ? `@UUID[${world}]` : m; })
		: str;
}

// Rewrite every cross-link inside one page's plain data, in place, and return it.
// Structured "location" pages carry their links in system.sections (prose bodies,
// Q&A prompts/answers, and grouped Dangers headings/bodies); text pages in
// text.content. Other page types have no system links we manage.
export function remapPageData(page, rewrite) {
	if (page.type === "location") {
		for (const s of page.system?.sections ?? []) {
			if (typeof s.body === "string") s.body = rewrite(s.body);
			for (const p of s.pairs ?? []) { p.prompt = rewrite(p.prompt); p.answer = rewrite(p.answer); }
			for (const g of s.groups ?? []) { g.heading = rewrite(g.heading); g.body = rewrite(g.body); }
		}
	} else if (page.text?.content) {
		page.text.content = rewrite(page.text.content);
	}
	return page;
}

// Deterministic JSON: sort object keys recursively so two structurally-equal values
// always serialise identically (Foundry's `toObject()` key order isn't guaranteed).
export function stableStringify(value) {
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
	}
	return JSON.stringify(value ?? null);
}

// cyrb53 string hash → 16-hex-char digest. For change-detection only (not security):
// fast, dependency-free, and stable across loads/platforms.
export function hashString(str) {
	let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
	for (let i = 0; i < str.length; i++) {
		const ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

// Fingerprint the managed content of an entry (plain data from `toObject()`): each
// page's name, type, and body — text.content for text pages, the whole system data
// for structured pages. Deliberately ignores page ids, sort, ownership, and flags so
// only authored content drives the hash. Pass content already remapped to world
// links, so a seeded copy and the freshly-remapped shipped version compare equal.
export function managedHash(entryData) {
	const projection = (entryData.pages ?? []).map(p => ({
		name: p.name,
		type: p.type,
		content: p.type === "text" ? (p.text?.content ?? "") : (p.system ?? null),
	}));
	return hashString(stableStringify(projection));
}

// Reader state that must survive a content refresh. Checkbox ticks
// (journal-checkboxes.js) live in `flags.stonetop.checks`, and managedHash
// deliberately ignores flags — so a content-pristine entry still gets refreshed to
// the newly-shipped version, but without this its readers' ticked boxes would be
// wiped when the old pages are replaced. Carry that state from the old pages onto
// the matching new page, joined by name (page names are unique within an entry —
// the same join key the seeder uses). Only `checks` is copied, so the shipped
// page's own (baked) flags are left intact. Returns new page objects (inputs are
// not mutated).
export function carryOverPageState(newPages, oldPages) {
	const checksByName = new Map();
	for (const p of oldPages ?? []) {
		const checks = p?.flags?.stonetop?.checks;
		if (checks && typeof checks === "object" && Object.keys(checks).length) {
			checksByName.set(p.name, checks);
		}
	}
	if (!checksByName.size) return newPages ?? [];
	return (newPages ?? []).map(p => {
		const checks = checksByName.get(p.name);
		if (!checks) return p;
		return {
			...p,
			flags: {
				...(p.flags ?? {}),
				stonetop: { ...(p.flags?.stonetop ?? {}), checks: { ...checks } },
			},
		};
	});
}
