export function buildFocusSelector(element, container) {
	if (!element || !container?.contains(element)) return null;
	const { dataset, className, name } = element;
	const cls = className?.trim().split(/\s+/).find(c => c.startsWith("stonetop-") || c.startsWith("steading-"));
	if (cls) {
		if (dataset.id) return `.${cls}[data-id="${dataset.id}"]`;
		if (dataset.slug) return `.${cls}[data-slug="${dataset.slug}"]`;
		if (dataset.attr && dataset.index !== undefined) return `.${cls}[data-attr="${dataset.attr}"][data-index="${dataset.index}"]`;
		if (dataset.index !== undefined) return `.${cls}[data-index="${dataset.index}"]`;
		if (dataset.cgContext) return `.${cls}[data-cg-context="${dataset.cgContext}"][data-cg-group="${dataset.cgGroup}"][data-cg-option="${dataset.cgOption}"]`;
		return `.${cls}`;
	}
	if (name) return `[name="${name}"]`;
	return null;
}
