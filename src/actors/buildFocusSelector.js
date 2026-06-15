export function buildFocusSelector(element, container) {
	if (!element || !container?.contains(element)) return null;
	const { dataset, className, name, value } = element;
	// Radios/checkboxes that only differ by value (e.g. the origin radios all share
	// name="stonetop-origin") need value in the selector, or we'd refocus the first match
	// and scroll to it.
	const nameSel = name
		? (value ? `[name="${name}"][value="${value}"]` : `[name="${name}"]`)
		: null;
	const cls = className?.trim().split(/\s+/).find(c => c.startsWith("stonetop-") || c.startsWith("steading-"));
	if (cls) {
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
		if (dataset.attr && dataset.index !== undefined) return `.${cls}[data-attr="${dataset.attr}"][data-index="${dataset.index}"]`;
		if (dataset.index !== undefined) return `.${cls}[data-index="${dataset.index}"]`;
		if (dataset.cgContext) return `.${cls}[data-cg-context="${dataset.cgContext}"][data-cg-group="${dataset.cgGroup}"][data-cg-option="${dataset.cgOption}"]`;
		// No unique data hook — disambiguate by name/value so we don't grab the first sibling.
		return nameSel ? `.${cls}${nameSel}` : `.${cls}`;
	}
	return nameSel;
}
