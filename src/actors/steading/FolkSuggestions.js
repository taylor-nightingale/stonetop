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
	//
	// The steading's own list carries NO home: a blank Home column means this steading, so a name off
	// it already says what it means, and writing the steading's name into every resident's row would
	// be the merge of residents and neighbours undone one row at a time.
	//
	// It is also the only name list that arrives OPEN. Six or seven pools of twenty-five names is a
	// column of several screens, and all but one of them are places most villagers are not from — so
	// the one you reach for is in front of you and the rest are a title you click. Folded is not
	// hidden: every title is still listed, which is how you find the place you do want.
	_nameLists() {
		const isUsed = name => this._folk.usesName(name);
		const own = new SuggestionList(
			game.i18n.format("stonetop.steading.folk.namesFrom", { place: this._actor.name }),
			SuggestionList.NAME,
			NamePool.parse(this._actor.system.residents?.names, isUsed),
			{ key: "names-own" },
		);
		const neighbors = (this._actor.system.neighborPlaces ?? []).map(place => new SuggestionList(
			game.i18n.format("stonetop.steading.folk.namesFrom", { place: place.name }),
			SuggestionList.NAME,
			NamePool.parse(place.names, isUsed),
			{ key: `names-${place.slug}`, home: place.name, open: false },
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
			{ key: "traits" },
		);
	}
}
