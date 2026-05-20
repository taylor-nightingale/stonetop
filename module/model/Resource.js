/**
 * Unified resource track used everywhere (moves, inventory items, possessions, pools).
 * @property {number} current - checks used
 * @property {number|null} max     - total capacity; null when determined by a stat (see maxStat)
 * @property {string|null} maxStat - stat name ("con", "str", etc.) when max equals that stat value
 * @property {string|null} title  - track label (e.g. "Stock", "Ammo"); null = unlabeled
 * @property {string[]} labels    - per-check labels; [] = plain unlabeled checkboxes
 *
 * @example
 * // Move "Rites of the Land"
 * { current: 1, max: 4, maxStat: null, title: null, labels: [] }
 * // Inventory "Bow & arrows"
 * { current: 0, max: 2, maxStat: null, title: null, labels: ["low ammo", "all out"] }
 * // Possession stock
 * { current: 2, max: 3, maxStat: null, title: "Stock", labels: [] }
 * // Arcanum Shell Game of Souls
 * { current: 0, max: null, maxStat: "con", title: "Souls", labels: [] }
 */
export class ResourceDef {
	constructor(data) {
		this.max     = data.max     ?? null;
		this.maxStat = data.maxStat ?? null;
		this.title   = data.title   ?? null;
		this.labels  = data.labels  ?? [];
	}
}

export class Resource {
	constructor(b) {
		this.current = b._current;
		this.max     = b._max;
		this.maxStat = b._maxStat ?? null;
		this.title   = b._title;
		this.labels  = b._labels;
	}
}

export class ResourceBuilder {
	withCurrent(v) { this._current = v; return this; }
	withMax(v)     { this._max     = v; return this; }
	withMaxStat(v) { this._maxStat = v; return this; }
	withTitle(v)   { this._title   = v; return this; }
	withLabels(v)  { this._labels  = v; return this; }
	build()        { return new Resource(this); }
}
