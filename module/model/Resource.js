/**
 * Unified resource track used everywhere (moves, inventory items, possessions, pools).
 * @property {number} current - checks used
 * @property {number} max     - total capacity
 * @property {string|null} title  - track label (e.g. "Stock", "Ammo"); null = unlabeled
 * @property {string[]} labels    - per-check labels; [] = plain unlabeled checkboxes
 *
 * @example
 * // Move "Rites of the Land"
 * { current: 1, max: 4, title: null, labels: [] }
 * // Inventory "Bow & arrows"
 * { current: 0, max: 2, title: null, labels: ["low ammo", "all out"] }
 * // Possession stock
 * { current: 2, max: 3, title: "Stock", labels: [] }
 * // Outfit regular pool
 * { current: 3, max: 9, title: null, labels: [] }
 */
export class Resource {
	constructor(b) {
		this.current = b._current;
		this.max     = b._max;
		this.title   = b._title;
		this.labels  = b._labels;
	}
}

export class ResourceBuilder {
	withCurrent(v) { this._current = v; return this; }
	withMax(v)     { this._max     = v; return this; }
	withTitle(v)   { this._title   = v; return this; }
	withLabels(v)  { this._labels  = v; return this; }
	build()        { return new Resource(this); }
}
