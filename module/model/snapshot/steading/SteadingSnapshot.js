export class FortunesSnapshot {
	constructor(title, note, current, options) {
		this.title   = title;
		this.note    = note;
		this.current = current;
		this.options = options.map((label, i) => ({ label, index: i, selected: i === current }));
	}
}

export class SurplusSnapshot {
	constructor(title, note, current) {
		this.title   = title;
		this.note    = note;
		this.current = current;
	}
}

export class AttributeSnapshot {
	constructor(slug, title, note, current, options, resources = null, extraItems = []) {
		this.slug       = slug;
		this.title      = title;
		this.note       = note;
		this.current    = current;
		this.options    = options.map((label, i) => ({ label, index: i, selected: i === current }));
		this.resources  = resources;
		this.extraItems = extraItems;
	}
}

export class DebilitySnapshot {
	constructor(slug, description, note, active) {
		this.slug        = slug;
		this.description = description;
		this.note        = note;
		this.active      = active;
	}
}

export class ContentSection {
	constructor(key, label, items) {
		this.key   = key;
		this.label = label;
		this.items = items;
	}
}

export class SteadingSnapshot {
	constructor({
		fortunes, surplus, attributes, debilities,
		placesOfInterest, notes, residents, neighbors,
		content, assets, improvements,
	}) {
		this.fortunes        = fortunes;
		this.surplus         = surplus;
		this.attributes      = attributes;
		this.debilities      = debilities;
		this.placesOfInterest = placesOfInterest;
		this.notes           = notes;
		this.residents       = residents;
		this.neighbors       = neighbors;
		this.content         = content;
		this.assets          = assets;
		this.improvements    = improvements;
	}
}
