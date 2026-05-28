export class FortunesSnapshot {
	constructor(title, note, current, options) {
		this.title = title;
		this.note = note;
		this.current = current;
		this.options = options.map((label, i) => ({label, index: i, selected: i === current}));
	}
}

export class SurplusSnapshot {
	constructor(title, note, current) {
		this.title = title;
		this.note = note;
		this.current = current;
	}
}

export class AttributeSnapshot {
	constructor(slug, title, note, current, options, items = []) {
		this.slug = slug;
		this.title = title;
		this.note = note;

		// Current selection
		this.current = current;
		// Selectable options, ex. -1, 0, +1
		this.options = options.map((label, i) => ({label, index: i, selected: i === current}));
		// List of strings for things like "resources" or "fortifications"
		this.items = items;
	}
}

export class DebilitySnapshot {
	constructor(slug, description, note, active) {
		this.slug = slug;
		this.description = description;
		this.note = note;
		this.active = active;
	}
}

export class ContentSection {
	constructor(slug, label, note, items) {
		this.slug = slug;
		this.label = label;
		this.note = note;
		this.items = items;
	}
}

export class SteadingSnapshot {
	constructor({
								fortunes, surplus, attributes, debilities,
								placesOfInterest, notes, residents, neighbors,
								contentDescription, content, assets, improvements,
								residentNames, residentTraits,
							}) {
		this.fortunes = fortunes;
		this.surplus = surplus;
		this.attributes = attributes;
		this.debilities = debilities;
		this.placesOfInterest = placesOfInterest;
		this.notes = notes;
		this.residents = residents;
		this.neighbors = neighbors;
		this.contentDescription = contentDescription;
		this.content = content;
		this.assets = assets;
		this.improvements = improvements;
		this.residentNames = residentNames;
		this.residentTraits = residentTraits;
	}
}
