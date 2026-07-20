import { ChoiceGroupDefs } from "./ChoiceGroupDefs.js";

/**
 * Published once per write to a choice-value store, and delivered to every subscriber. Subscribers
 * decide for themselves what they care about — the follower effect wants the row that changed, the
 * outfit sync wants only the item — so nothing generic has to encode any one subscriber's needs.
 *
 * `kind` is what was written: "count" (a track or pick), "clear" (a whole namespace wiped), or "text"
 * (a write-in field). Only counts decide what a choice grants, so `affectsCounts` lets a subscriber
 * skip text writes without knowing why.
 *
 * `groupDef` and `target` are resolved lazily and memoised: several subscribers can ask without the
 * lookup being repeated, and a subscriber that never asks never pays for it.
 */
export class ChoiceValueChange {
	constructor({ item, namespace, optionSlug = null, count = null, values, kind }) {
		this.item       = item;
		this.namespace  = namespace;
		this.optionSlug = optionSlug;
		this.count      = count;
		this.values     = values;
		this.kind       = kind;
		this._groupDef  = undefined;
		this._target    = undefined;
	}

	/** Counts decide what a choice grants; text never does. */
	get affectsCounts() { return this.kind !== "text"; }

	/** The group the write belongs to — the one actually holding the target when several share the
	 *  namespace (arcana give front.unlock and back.choices the same slug), else the first match. */
	get groupDef() {
		this._resolve();
		return this._groupDef;
	}

	/** The row or pick option the write targeted, or null (a clear targets no single option). */
	get target() {
		this._resolve();
		return this._target;
	}

	_resolve() {
		if (this._target !== undefined) return;
		const groups = ChoiceGroupDefs.findAllBySlug(this.item?.system, this.namespace);
		this._groupDef = groups[0]?.def ?? null;
		this._target   = null;
		if (!this.optionSlug) return;
		for (const group of groups) {
			for (const row of group.def.list ?? []) {
				const hit = row.slug === this.optionSlug
					? row
					: (row.options ?? []).find(o => o.slug === this.optionSlug);
				if (hit) { this._groupDef = group.def; this._target = hit; return; }
			}
		}
	}
}
