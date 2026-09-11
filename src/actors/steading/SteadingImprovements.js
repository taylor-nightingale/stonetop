import {ChoiceValues} from "../../model/snapshot/character/ChoiceGroup.js";
import {ChoiceGroupController} from "../character/ChoiceGroupController.js";
import {buildChoiceGroup} from "../../model/snapshot/character/buildChoiceGroup.js";
import {FoundrySteadingImprovementRepository} from "./repositories/FoundrySteadingImprovementRepository.js";
import {addImprovement, removeImprovement} from "../../model/data/steading/improvementSlugs.js";
import {ImprovementBoard, ImprovementProgress} from "../../model/snapshot/steading/ImprovementProgress.js";

// A steading renders only the improvements it OWNS — the slugs in system.improvements (copied from its
// steadfast on apply, plus any wonder improvements dropped later). The repository resolves each slug to
// its choice-group content; pick/track state lives in system.improvementValues, keyed by group slug.
export class SteadingImprovements {
	constructor(actor, repo = new FoundrySteadingImprovementRepository()) {
		this._actor = actor;
		this._repo  = repo;
		// Through a controller like every other choice store, so improvement rows route through the
		// shared choice wiring rather than needing the sheet to know they are special.
		this._controller = new ChoiceGroupController({
			reader: () => this._actor.system?.improvementValues ?? {},
			writer: raw => this._actor.update({ "system.improvementValues": raw }),
		});
	}

	/** The store improvement choice rows write through — resolved per context by the steading's ChoiceStores. */
	controller() {
		return this._controller;
	}

	get _slugs() {
		return this._actor.system.improvements ?? [];
	}

	get _values() {
		return new ChoiceValues(this._actor.system?.improvementValues ?? {});
	}

	// An improvement dropped onto the steading joins the owned list by slug — no embed, since the tab
	// renders from these slugs. Re-dropping one it already owns is a no-op.
	async grant(slug) {
		const next = addImprovement(this._slugs, slug);
		if (next.length !== this._slugs.length) await this._actor.update({ "system.improvements": next });
	}

	// Track/pick state for the group is deliberately left in improvementValues — orphaned but harmless,
	// so an accidental revoke (or a re-grant later) doesn't lose the steading's progress. Re-applying a
	// steadfast already replaces the slug list on the same terms.
	async revoke(slug) {
		await this._actor.update({ "system.improvements": removeImprovement(this._slugs, slug) });
	}

	/**
	 * The improvements this steading owns, resolved to their content — what the turnover checklist is
	 * assembled from. Unknown slugs (an improvement removed from the pack, a world item deleted) drop
	 * out rather than becoming a nameless row.
	 */
	async owned() {
		const found = [];
		for (const slug of this._slugs) {
			const imp = await this._repo.getBySlug(slug);
			if (imp) found.push(imp);
		}
		return found;
	}

	/**
	 * The owned improvements as resolved choice groups, in owned order.
	 *
	 * What a STEADFAST renders: it is a template, so nothing on it is ticked and a progress meter
	 * would be four empty pips on every row. A steading wants the board below instead.
	 */
	async buildGroups() {
		const values = this._values;
		const groups = [];
		for (const imp of await this.owned()) {
			if (imp.choices == null) continue;
			// `titledChoices` carries the improvement's name as the group title, so the group knows
			// both things the board needs to label a row — no pair type to thread through.
			groups.push(buildChoiceGroup(imp.titledChoices, values));
		}
		return groups;
	}

	/**
	 * The improvements Stonetop has actually BUILT — every requirement ticked (or none to tick).
	 *
	 * What the turnover checklist is assembled from: a seasonal clause is an ONGOING effect of a
	 * finished improvement, so a mill nobody has built yet generates nothing when autumn comes.
	 */
	async inEffect() {
		const stored = this._actor.system?.improvementValues ?? {};
		return (await this.owned()).filter(imp => imp.isBuilt(stored[imp.slug] ?? {}));
	}

	/**
	 * The slugs of every move the owned improvements confer.
	 *
	 * A set, because the same move can be granted in more than one place and a pack lookup per line
	 * would be a lookup per line. Asked once per render and resolved once.
	 */
	async grantedMoveSlugs() {
		const slugs = new Set();
		for (const imp of await this.owned()) {
			for (const effect of imp.effects.all()) {
				if (effect.grantsMove) slugs.add(effect.grantsMove);
			}
		}
		return slugs;
	}

	/**
	 * The Season tab's project board: one row per owned improvement, in the order the steading owns
	 * them, carrying its requirement meter and its own choice group.
	 *
	 * @param effects the steading's SteadingEffects, so a just-finished card can offer what finishing
	 *                it does. Passed in rather than held, because effects are built FROM improvements
	 *                and holding one here would be a cycle.
	 * @param season  the season the steading is IN, so a card can say whether it fires now. Passed in
	 *                for the same reason: the board does not own the wheel.
	 */
	async buildSnapshot(effects = null, season = null) {
		const values = this._values;
		const stored = this._actor.system?.improvementValues ?? {};
		const entries = [];
		for (const imp of await this.owned()) {
			if (imp.choices == null) continue;
			// `choices`, not `titledChoices`: the card's disclosure button already carries the name, and
			// the titled group printed it a second time directly beneath it.
			const group = buildChoiceGroup(imp.choices, values);
			// The whole payoff, owed or not: the card states what an improvement WILL do as well as
			// what it has done, because the prose that used to say so is no longer in the pack.
			const payoff = effects ? effects.payoffFor(imp) : null;
			entries.push(ImprovementProgress.from(imp, group, stored[imp.slug] ?? {}, payoff, season));
		}
		return new ImprovementBoard(entries);
	}
}
