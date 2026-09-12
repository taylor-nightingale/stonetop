const PLAIN_ID = /^[A-Za-z][\w-]*$/;

export function buildFocusSelector(element, container) {
	if (!element || !container?.contains(element)) return null;
	// An id is unique on the page by definition, so nothing below can beat it. (Guarded to a plain
	// identifier: an id needing CSS.escape would build a selector that means something else.)
	if (PLAIN_ID.test(element.id ?? "")) return `#${element.id}`;
	const { dataset, className, name, value } = element;
	// Radios/checkboxes that only differ by value (e.g. the origin radios all share
	// name="stonetop-origin") need value in the selector, or we'd refocus the first match
	// and scroll to it.
	const nameSel = name
		? (value ? `[name="${name}"][value="${value}"]` : `[name="${name}"]`)
		: null;
	const cls = className?.trim().split(/\s+/).find(c => c.startsWith("stonetop-") || c.startsWith("steading-"));
	if (cls) return `${classSelector(cls, element, nameSel)}${changeActionSel(dataset)}`;
	return nameSel;
}

// Several fields share one class and differ only in WHAT they change: HP, armor, XP and level all
// carry `.stonetop-resource__input`, the three coinage fields share `.stonetop-coinage-input`, and a
// follower's hp and hp-max share their class AND their slug. The change action is that difference,
// so it qualifies every class-based selector — without it, stepping XP refocused HP.
function changeActionSel({ changeAction }) {
	return changeAction ? `[data-change-action="${changeAction}"]` : "";
}

function classSelector(cls, element, nameSel) {
	const { dataset } = element;
	if (dataset.id) return `.${cls}[data-id="${dataset.id}"]`;
	// Selection chips: identify by slug+tag so removing one doesn't refocus (and scroll to)
	// a different chip — once gone, the selector simply matches nothing.
	if (dataset.tag) {
		const slugPart = dataset.slug ? `[data-slug="${dataset.slug}"]` : "";
		return `.${cls}${slugPart}[data-tag="${dataset.tag}"]`;
	}
	// Group-member inputs carry both slug (which follower) and index (which member) — keep
	// both so editing one member doesn't refocus (and scroll to) a different one.
	if (dataset.slug && dataset.index !== undefined) return `.${cls}[data-slug="${dataset.slug}"][data-index="${dataset.index}"]`;
	if (dataset.slug) return `.${cls}[data-slug="${dataset.slug}"]`;
	// Arcanum write-in blanks: the key is only unique within its own card (every card numbers its
	// blanks from 1), so scope by the owning card's slug or we'd refocus the first card's blank.
	if (dataset.blankKey) {
		const scopeSlug = element.closest("[data-slug]")?.dataset.slug;
		const scope     = scopeSlug ? `[data-slug="${scopeSlug}"] ` : "";
		return `${scope}.${cls}[data-blank-key="${dataset.blankKey}"]`;
	}
	if (dataset.attr && dataset.index !== undefined) return `.${cls}[data-attr="${dataset.attr}"][data-index="${dataset.index}"]`;
	if (dataset.index !== undefined) return `.${cls}[data-index="${dataset.index}"]`;
	// A rating's own control (a value, or Size's select). Every one of them shares
	// `.steading-attr-input`, so without the attr the class alone matched the FIRST rating on the
	// sheet: changing Size to "village" re-rendered and put the caret in Fortunes.
	if (dataset.attr) return `.${cls}[data-attr="${dataset.attr}"]`;
	if (dataset.cgContext) return `.${cls}[data-cg-context="${dataset.cgContext}"][data-cg-group="${dataset.cgGroup}"][data-cg-option="${dataset.cgOption}"]`;
	// No unique data hook — disambiguate by name/value so we don't grab the first sibling.
	return nameSel ? `.${cls}${nameSel}` : `.${cls}`;
}
