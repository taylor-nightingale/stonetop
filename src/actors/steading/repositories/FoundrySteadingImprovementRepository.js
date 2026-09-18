import { FoundryPackDocumentStore } from "../../character/repositories/FoundryPackDocumentStore.js";
import { WorldItemStore } from "../../character/repositories/WorldItemStore.js";
import { ImprovementEffects } from "../../../model/data/steading/ImprovementEffect.js";
import { RequirementBoxes, parseRequirement } from "../../../model/data/steading/ImprovementRequirement.js";

// Read as DOCUMENTS, not index entries: every string an improvement card shows — the requirement
// rows in `choices`, the payoff sentences in `effects` — lives under `system`, and a pack index is
// never translated below `name`. See FoundryPackDocumentStore.

export class SteadingImprovement {
	constructor(slug, name, choices, sortOrder = 0, { requires = null, effects = [] } = {}) {
		this.slug      = slug;
		this.name      = name;
		this.choices   = choices;
		this.sortOrder = sortOrder;
		// What it takes to build, and what it does once built — hand-authored on the item and checked
		// by scripts/import/review-improvement-model.js. Empty for a custom improvement authored in a
		// world, which simply has no results the sheet can reason about.
		this.requires  = parseRequirement(requires);
		// Results inherit the improvement's own requirement unless they narrow it — see
		// ImprovementEffect.fromRaw. Without that, every result of an owned-but-unbuilt improvement
		// would fire.
		this.effects   = ImprovementEffects.fromRaw(effects, requires);
	}

	/**
	 * This improvement's tick state, against the steading's stored values for its group.
	 *
	 * Every question about an improvement — is it built, does this result hold, how far along is it —
	 * is asked of the requirement expression against this.
	 */
	boxesFrom(storedValues) {
		return RequirementBoxes.from(this.choices?.list ?? [], storedValues ?? {});
	}

	/** Whether Stonetop has built it: anything it promises is true yet. */
	isBuilt(storedValues) {
		return this.effects.isBuilt(this.boxesFrom(storedValues));
	}

	/** The results firing at a trigger, given what has been ticked. */
	firingAt(kind, storedValues, options = {}) {
		return this.effects.firingAt(kind, this.boxesFrom(storedValues), options);
	}

	/** The same, each with its stable position in this improvement's result list. */
	entriesFiringAt(kind, storedValues, options = {}) {
		return this.effects.entriesFiringAt(kind, this.boxesFrom(storedValues), options);
	}

	/**
	 * The choice-group data to render, carrying the improvement's own name as the group title. The
	 * panels that show an improvement — the steading sheet's columns and a steadfast's granted list —
	 * have nowhere else to name it, and the name used to be repeated into the first row's title to
	 * cover that.
	 */
	get titledChoices() {
		return this.choices ? { ...this.choices, title: this.name } : null;
	}
}

export class FoundrySteadingImprovementRepository {
	constructor() {
		this._store       = new FoundryPackDocumentStore("stonetop.steading-improvements");
		this._worldStore  = new WorldItemStore("improvement");
		this._cache       = null;
	}

	// The full improvement catalog used to resolve a steading's owned slugs → content: the
	// steading-improvements pack (both the Stonetop-core and Book II wonder improvements) plus any
	// custom `improvement` items authored in the world. A steading no longer shows all of these — it
	// renders only the ones it owns (see SteadingImprovements) — so this is a lookup source, not a
	// per-steading list.
	async getAll() {
		if (this._cache) return this._cache;
		const entries = [
			...await this._store.getAll(),
			...await this._worldStore.getAll(),
		];
		this._cache = entries
			.filter(e => e.type === "improvement")
			.map(entry => new SteadingImprovement(
				entry.system?.slug,
				entry.name,
				entry.system?.choices ?? null,
				entry.system?.sortOrder ?? 0,
				{ requires: entry.system?.requires ?? null, effects: entry.system?.effects ?? [] },
			))
			.sort((a, b) => a.sortOrder - b.sortOrder);
		return this._cache;
	}

	// Resolve one owned slug to its improvement (content + sortOrder), or null if unknown.
	async getBySlug(slug) {
		return (await this.getAll()).find(imp => imp.slug === slug) ?? null;
	}
}
