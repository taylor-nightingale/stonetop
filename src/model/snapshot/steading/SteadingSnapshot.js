import { rich } from "../RichText.js";

export class SelectOptionSnapshot {
	// `value` is what the option stores when picked — a rating bonus (−1…+3) or a size tier string.
	// `index` is kept only for stable DOM keys/ordering; selection is by value, not position.
	constructor(label, index, value, selected) {
		this.label    = rich(label);
		this.index    = index;
		this.value    = value;
		this.selected = selected;
	}
}

export class FortunesSnapshot {
	// `current` is the stored actual value (e.g. +1); options are selected by matching that value.
	constructor(title, note, current, options, values) {
		this.title = title;
		this.note = rich(note);
		this.current = current;
		this.options = options.map((label, i) => new SelectOptionSnapshot(label, i, values[i], values[i] === current));
	}
}

export class SurplusSnapshot {
	constructor(title, note, current) {
		this.title = title;
		this.note = rich(note);
		this.current = current;
	}
}

export class AttributeSnapshot {
	// `current` is the stored actual value: a rating bonus (−1…+3) or a size tier string ("village").
	// `values` are each option's stored value, parallel to `options` (their labels); an option is
	// selected when its value equals `current`.
	constructor(slug, title, note, current, options, values, items = []) {
		this.slug = slug;
		this.title = title;
		this.note = rich(note);

		// Current selection (the actual value, not an index)
		this.current = current;
		// Selectable options, ex. -1, 0, +1 (or the size tiers)
		this.options = options.map((label, i) => new SelectOptionSnapshot(label, i, values[i], values[i] === current));
		// List of strings backing the rating — resources (Prosperity) or fortifications (Defenses)
		this.items = items;
	}
}

export class DebilitySnapshot {
	constructor(slug, description, note, active) {
		this.slug = slug;
		this.description = rich(description);
		this.note = rich(note);
		this.active = active;
	}
}

export class ContentSection {
	constructor(slug, label, note, text, items = []) {
		this.slug = slug;
		this.label = rich(label);
		this.note = rich(note);
		this.text = text;          // edit-only (rendered into a textarea) — stays a raw string
		this.items = items;
	}
}



export class SeasonsSnapshot {
	// `moves` is the ordinary MoveCategorySnapshot — the seasonal glyphs ride on each move's own
	// icon, so this tab renders through the same move-group as the Moves tab.
	constructor({ moves = null, gains = null, plate = null }) {
		this.moves = moves;
		this.gains = gains;
		// The harvest plate from the book's Seasons Change spread — a copyrighted illustration, so
		// null until the art installer has actually produced it. Referencing it regardless would 404
		// on every render for everyone who hasn't installed (or who only owns Book II).
		this.plate = plate;
	}
}

export class SteadingSnapshot {
	constructor({
								fortunes, surplus, attributes, debilities,
								placesOfInterest, notes, residents, neighbors,
								contentDescription, content, assets, improvements,
								residentNames, residentTraits,
								moves, seasons, rollMode,
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
		this.npcTraitColumns = splitIntoColumns(residentTraits ?? [], 5);
		this.residentTraitsText = (residentTraits ?? []).join("\n");
		this.improvementColumns = splitIntoImprovementColumns(improvements ?? []);
		this.moves    = moves    ?? [];
		this.seasons  = seasons  ?? null;
		this.rollMode = rollMode ?? "normal";
	}
}

function splitIntoImprovementColumns(items) {
	const third = Math.ceil(items.length / 3);
	return {
		left:   items.slice(0, third),
		middle: items.slice(third, third * 2),
		right:  items.slice(third * 2),
	};
}

export function splitIntoColumns(items, columnCount) {
	const rowsPerColumn = Math.ceil(items.length / columnCount) || 1;
	return Array.from({ length: columnCount }, (_, i) =>
		items.slice(i * rowsPerColumn, (i + 1) * rowsPerColumn)
	);
}
