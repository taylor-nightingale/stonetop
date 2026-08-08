import {SeasonalGains} from "../../model/data/steading/SeasonalGains.js";
import {buildChoiceGroup} from "../../model/snapshot/character/buildChoiceGroup.js";
import {ExcitesRowSnapshot, FirstSessionSnapshot} from "../../model/snapshot/steading/SteadingSnapshot.js";
import {FoundryPlayerCharacterRepository} from "./repositories/FoundryPlayerCharacterRepository.js";
import {SteadingChoices} from "./SteadingChoices.js";

// The Seasons Change move this section links to — the first spring the table ever plays.
export const SPRING_MOVE_SLUG = "seasons-change-spring";

// The last beat of session zero (Book I, p.30): spring breaks forth, the most hopeful character
// makes the first Seasons Change move at +Fortunes, and the table records the hook it opens plus
// what excites each player about their character. Everything here is a note, not a rule — nothing
// this class stores changes a rating, and picking a gain records the pick without applying it.
//
// The gain pick itself lives in the steading's choice values, not here: it's an ordinary choice
// group, and SteadingChoices persists it like every other one.
export class SteadingFirstSession {
	constructor(actor, choices = new SteadingChoices(actor), playerCharacterRepo = new FoundryPlayerCharacterRepository()) {
		this._actor   = actor;
		this._choices = choices;
		this._repo    = playerCharacterRepo;
	}

	get _state() {
		return this._actor.system.firstSession ?? {};
	}

	get hopeful() {
		return this._state.hopeful ?? "";
	}

	get hook() {
		return this._state.hook ?? "";
	}

	get isDone() {
		return this._state.done === true;
	}

	excitesFor(actorId) {
		return (this._state.excites ?? {})[actorId] ?? "";
	}

	async setHopeful(name) {
		await this._patch({hopeful: name});
	}

	async setHook(text) {
		await this._patch({hook: text});
	}

	async setExcites(actorId, text) {
		if (!actorId) return;
		await this._patch({excites: {...(this._state.excites ?? {}), [actorId]: text}});
	}

	async markDone() {
		await this._patch({done: true});
	}

	async reopen() {
		await this._patch({done: false});
	}

	// Foundry deep-merges an update, so a nested key can be added or overwritten but never dropped by
	// omission. Nothing here needs a drop: `excites` only ever gains or overwrites an entry, and the
	// rest are scalars.
	async _patch(changes) {
		await this._actor.update({"system.firstSession": {...this._state, ...changes}});
	}

	// `hasSpringMove` is passed in rather than looked up: which moves a steading carries is
	// SteadingMoves' business, and the two are composed by StonetopSteading.
	buildSnapshot(hasSpringMove = false) {
		return new FirstSessionSnapshot({
			hopeful: this.hopeful,
			hook:    this.hook,
			gains:   buildChoiceGroup(SeasonalGains.toChoiceGroupData(), this._choices.values),
			excites: this._repo.list().map(pc => new ExcitesRowSnapshot(pc.id, pc.name ?? "", this.excitesFor(pc.id))),
			done:    this.isDone,
			hasSpringMove,
		});
	}
}
