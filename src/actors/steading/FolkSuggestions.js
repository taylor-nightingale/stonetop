import { NamePool } from "../../model/data/steading/NamePool.js";
import { Suggestion, SuggestionList } from "../../model/snapshot/steading/SuggestionSnapshot.js";

/**
 * The reference column of the Folk tab: every name list the steading knows, whole, and the trait pool.
 *
 * Filtered by nothing, ever. Reading down these lists is how an NPC gets made, so the roster's search
 * box does not reach them — which is a fact about this class (it takes no query) as much as about the
 * markup. The only change from the read-only walls they used to be is that each entry is now a target,
 * and that an entry already used in this steading is marked so it can dim without leaving the scan.
 */
export class FolkSuggestions {
	constructor(actor, folk) {
		this._actor = actor;
		this._folk = folk;
	}

	/** @returns {SuggestionList[]} */
	build() {
		return [...this._nameLists(), this._traitList()].filter(list => !list.isEmpty);
	}

	// The steading's own names first — it is the list you reach for most — then each neighbouring
	// place's, in the order the steadfast lists them.
	_nameLists() {
		const isUsed = name => this._folk.usesName(name);
		const own = new SuggestionList(
			game.i18n.format("stonetop.steading.folk.namesFrom", { place: this._actor.name }),
			SuggestionList.NAME,
			NamePool.parse(this._actor.system.residents?.names, isUsed),
		);
		const neighbors = (this._actor.system.neighborPlaces ?? []).map(place => new SuggestionList(
			game.i18n.format("stonetop.steading.folk.namesFrom", { place: place.name }),
			SuggestionList.NAME,
			NamePool.parse(place.names, isUsed),
		));
		return [own, ...neighbors];
	}

	// Traits are already an array — the pool is edited one per line — so there is nothing to tokenise
	// and every entry is a usable value.
	_traitList() {
		const entries = (this._actor.system.residents?.traits ?? [])
			.map(trait => new Suggestion(trait, this._folk.usesTrait(trait)));
		return new SuggestionList(
			game.i18n.localize("stonetop.steading.headings.npcTraits"),
			SuggestionList.TRAIT,
			entries,
		);
	}
}
