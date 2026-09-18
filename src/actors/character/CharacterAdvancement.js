import { LevelUpProcedure } from "../../model/data/character/LevelUpProcedure.js";
import {
	AdvanceRow, ChooseMoveRow, InvocationRow, LevelUpSnapshotBuilder, ReviewRow, StockRow,
} from "../../model/snapshot/character/LevelUpSnapshot.js";
import { ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { MoveBullets } from "../../model/snapshot/character/MoveBullets.js";
import { MoveGloss } from "../../model/snapshot/character/MoveGloss.js";
import { moveSlugOf } from "../embeddedMoves.js";

export const LEVEL_UP_SLUG = "level-up";

// The categories a level-up choice comes FROM: "a new move from your playbook, or an insert class
// that you've unlocked". Everything else a character owns — the basic moves, an arcanum's
// mysteries, a background's grant — arrived some other way and was never a level's purchase.
const CHOSEN_CATEGORY = /^(playbook|insert)-/;

/**
 * What levelling up owes this character.
 *
 * Level Up is a homefront move the character never held: it lives in the moves compendium, and the
 * steading sheet hides it on purpose (SteadingMoveCategories) because a steading does not gain
 * levels. So the ceremony had no home and no help — a formula to do in your head, two steppers to
 * nudge, and four things to remember to go and do on three other tabs.
 *
 * This is the class that answers for it. It reads the move's own steps out of the catalog and pairs
 * each with what this character brings to it; nothing is stored, and nothing is enforced. The strip
 * it builds states what the book says and offers what the sheet can honestly do — one control, for
 * the one step that is pure arithmetic.
 */
export class CharacterAdvancement {
	constructor(actor, vitals, moves, possessions, moveRepo) {
		this._actor       = actor;
		this._vitals      = vitals;
		this._moves       = moves;
		this._possessions = possessions;
		this._moveRepo    = moveRepo;
	}

	get advancement() {
		return this._vitals.advancement;
	}

	/** Spend the XP and take the level, as one act — see CharacterVitals#advance. */
	async advance() {
		return this._vitals.advance();
	}

	async buildSnapshot() {
		const move        = await this._levelUpMove();
		const advancement = this.advancement;
		const description = move?.system?.description ?? "";
		// The move's structure and the move's words, from the one document — its description spells the
		// same six steps out as bullets, so nothing is authored twice and nothing is translated twice.
		const procedure   = LevelUpProcedure.from(move?.system?.steps, MoveBullets.from(description));
		const rows        = procedure.steps.map(step => this._rowFor(step, advancement)).filter(Boolean);
		return new LevelUpSnapshotBuilder()
			.withGloss(MoveGloss.from(description))
			.withRows(rows)
			.withLevel(advancement.level)
			.withNewLevel(advancement.newLevel)
			.withCost(advancement.cost)
			.withIsReady(advancement.isReady)
			.build();
	}

	// One row per step the character has any business seeing. The two even-level clauses drop out
	// entirely where they do not apply — for a level they do not fire on, or for a character who is
	// neither the Blessed nor the Lightbearer and has picked up neither's gear. The book states them
	// as conditions; a row that read "if you are the Lightbearer" to someone who is not is a step
	// they have to work out does not concern them.
	//
	// The book's first two bullets are one act and become one row: the row is built from the `spend`
	// step, which carries its label, and the `advance` step that follows it renders nothing of its
	// own. Both stay in the pack so the list there mirrors the book's six.
	_rowFor(step, advancement) {
		if (step.isEvenLevel && !advancement.newLevelIsEven) return null;
		switch (step.kind) {
			case "spend":      return new AdvanceRow(step, advancement);
			case "advance":    return null;
			case "chooseMove": return new ChooseMoveRow(step, advancement, this.chosenMoveCount);
			case "stock":      return this._stockRow(step, advancement);
			case "invocation": return this._invocationRow(step, advancement);
			case "review":     return new ReviewRow(step);
			default:           return null;
		}
	}

	// What the possession's track tops out at now, and what it will once the level is taken. Both
	// come from the same question asked at two levels, so the row cannot claim a rise the possession's
	// own scaling would not produce — and a character without the pouch gets no row at all.
	_stockRow(step, advancement) {
		const now  = this._possessions.maxUsesFor(step.possession, advancement.level);
		if (now === null) return null;
		const next = this._possessions.maxUsesFor(step.possession, advancement.newLevel);
		return new StockRow(step, now, next);
	}

	_invocationRow(step, advancement) {
		const insert = this._insertBySlug(step.insert);
		if (!insert) return null;
		const known = new ChoiceValues(insert.system?.choiceValues ?? {}).countIn(step.group);
		return new InvocationRow(step, advancement, known, insert.name);
	}

	/**
	 * How many moves this character has CHOSEN, as against the ones a source handed them.
	 *
	 * A playbook and an insert class each name the subset of their moves a character starts with;
	 * everything acquired beyond that list was bought with a level. Counted in INSTANCES, not items,
	 * because a move that can be taken more than once costs a level each time — and a starting move
	 * taken twice is one purchase, not two.
	 */
	get chosenMoveCount() {
		const handed = this._handedSlugs();
		return this._moves.acquiredMoves
			.filter(item => CHOSEN_CATEGORY.test(item.system?.categoryKey ?? ""))
			.reduce((total, item) => {
				const taken = item.system?.instanceCount ?? 0;
				return total + Math.max(0, taken - (handed.has(moveSlugOf(item)) ? 1 : 0));
			}, 0);
	}

	// The starting lists of every source that has one on this character. Read live off the items,
	// because a move item records that it is acquired but not who decided that for it.
	_handedSlugs() {
		return new Set([...this._actor.items]
			.filter(item => item.type === "playbook" || item.type === "insert")
			.flatMap(item => item.system?.startingMoves ?? []));
	}

	_insertBySlug(slug) {
		return [...this._actor.items].find(i => i.type === "insert" && i.system?.slug === slug) ?? null;
	}

	async _levelUpMove() {
		const [entry] = await this._moveRepo?.getMoveEntriesBySlugs([LEVEL_UP_SLUG]) ?? [];
		return entry ?? null;
	}
}
