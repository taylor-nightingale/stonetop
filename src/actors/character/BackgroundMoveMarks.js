import { Background } from "../../model/data/character/Background.js";

/**
 * Keeps the options a background marks on a move (the Seeker's Well Versed topic) in step with the
 * background: choosing one marks its topic, leaving it un-marks it, and changing the Witch Hunter's
 * pick moves the mark. The pick itself is an ordinary background choice value, so this hears about it
 * as a subscriber rather than owning a write path of its own.
 */
export class BackgroundMoveMarks {
	/**
	 * @param {MovePicks} picks
	 * @param {CharacterBackgrounds} backgrounds
	 */
	constructor(picks, backgrounds) {
		this._picks       = picks;
		this._backgrounds = backgrounds;
	}

	/** @param {Background|null} from  @param {Background|null} to */
	async switchBetween(from, to) {
		for (const [mark, option] of this._markedBy(from)) await this._set(mark, option, 0);
		for (const [mark, option] of this._markedBy(to))   await this._set(mark, option, 1);
	}

	/** Marks whatever the background marks and the move lacks; never un-marks. @returns {number} marked */
	async ensureMarked(background) {
		let marked = 0;
		for (const [mark, option] of this._markedBy(background)) {
			if (this._picks.countOf(mark.moveSlug, mark.groupSlug, option) > 0) continue;
			await this._set(mark, option, 1);
			marked++;
		}
		return marked;
	}

	/** @param {ChoiceValueChange} change */
	async handle(change) {
		if (change.kind !== "count" || change.item?.type !== "playbook") return;
		const background = Background.find(change.item.system, this._backgrounds.selectedSlug);
		if (!background) return;
		for (const mark of background.moveMarks) {
			if (mark.namespaceFor(background.slug) !== change.namespace || !mark.offers(change.optionSlug)) continue;
			await this._set(mark, change.optionSlug, change.count > 0 ? 1 : 0);
		}
	}

	_markedBy(background) {
		if (!background) return [];
		const values = this._backgrounds.values;
		return background.moveMarks
			.map(mark => [mark, mark.markedOption(values, background.slug)])
			.filter(([, option]) => option);
	}

	async _set(mark, option, count) {
		await this._picks.controllerFor(mark.moveSlug)?.setCount(mark.groupSlug, option, count);
	}
}
