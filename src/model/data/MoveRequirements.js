import { toSlug } from "../../utils/slug.js";
import { RequirementSnapshot } from "../snapshot/character/MoveSnapshot.js";

/**
 * What the moves a character can see ask of them — one per character.
 *
 * A requirement stores SLUGS: the moves it gates on, and the playbook it is limited to. That keeps
 * the reference stable and translation-safe, and means the label has to resolve each one to a name.
 * The names come from the catalogs rather than from the character's own items, because a requirement
 * can name a move they do not own — an arcanum's move may require two from a playbook that is not
 * theirs.
 *
 * Everything about the character is read live, never captured: level, playbook and acquired moves
 * all change during play, and a requirement answered from a stale copy of them is worse than no
 * answer at all. Each is asked of the class that owns it rather than dug out of the actor here.
 *
 * Both questions live here so they cannot disagree: what the requirement says, and whether it is
 * met. Being unmet is advisory, as everything in this system is — the sheet marks it, never blocks it.
 */
export class MoveRequirements {
	// Each collaborator answers for what it owns — the character's level, their playbook — and is
	// asked afresh every time, never copied. The moves they have taken are handed in by CharacterMoves
	// at the moment of asking: that is its knowledge to give, and holding it here would make the two
	// classes point at each other.
	constructor(vitals, playbook, moveRepo, playbookRepo) {
		this._vitals       = vitals;
		this._playbook     = playbook;
		this._moveRepo     = moveRepo;
		this._playbookRepo = playbookRepo;
	}

	get level() {
		return this._vitals?.level ?? 1;
	}

	get playbookSlug() {
		return this._playbook?.getSlug?.() ?? null;
	}

	/** A requirement with nothing in it renders no line at all. Needs no catalog to answer. */
	isEmpty(requirement) {
		const req = requirement ?? {};
		return !req.playbook && !(req.moves ?? []).length && !req.note?.trim() && !req.level;
	}

	isMet(requirement, acquiredSlugs = new Set()) {
		const req = requirement;
		if (!req) return true;
		if (req.level && this.level < req.level) return false;
		// Only bites when a move is reached for from another playbook — see the Would-Be Hero's
		// Versatile, which takes "a move from any other playbook, as long as you meet its requirements".
		if (req.playbook && toSlug(this.playbookSlug ?? "") !== toSlug(req.playbook)) return false;
		return (req.moves ?? []).every(ref => acquiredSlugs.has(toSlug(ref)));
	}

	/** The requirement as a move snapshot carries it, or null when there is nothing to show. */
	async snapshotFor(requirement, acquiredSlugs = new Set()) {
		if (this.isEmpty(requirement)) return null;
		return new RequirementSnapshot(await this.labelFor(requirement), this.isMet(requirement, acquiredSlugs));
	}

	/** Unresolvable references show as themselves — better a raw slug than a blank requirement. */
	async labelFor(requirement) {
		const req = requirement ?? {};
		const [moveNames, playbookNames] = await Promise.all([
			this._moveRepo?.namesBySlug?.() ?? new Map(),
			this._playbookRepo?.namesBySlug?.() ?? new Map(),
		]);

		// Playbook first: it is the broadest gate, and decides whether the rest even apply.
		const playbook = req.playbook ? playbookNames.get(toSlug(req.playbook)) ?? req.playbook : null;
		const moves    = (req.moves ?? []).map(ref => moveNames.get(toSlug(ref)) ?? ref);
		const level    = req.level ? `Level ${req.level}` : null;
		return [playbook, ...moves, req.note, level]
			.filter(part => typeof part === "string" && part.trim())
			.join(", ");
	}
}
