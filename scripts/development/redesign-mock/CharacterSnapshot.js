/**
 * Maelen's captured `_prepareContext()`, asked questions instead of rummaged through.
 *
 * The deck's renderers never touch the raw context. Everything they draw comes through a named
 * accessor here or through a MoveView, so a shape change in the snapshot breaks one file rather
 * than six render functions.
 *
 * The data is the SAME capture the first deck uses (`../mockup/maelen.json`) — deliberately, so the
 * two decks can be put side by side and any difference between them is design rather than
 * character.
 */
import { html } from "./text.js";
import { PlaybookSections, InsertView, SectionKey, markInGroup, answerInGroup, instinctLabelOf } from "./sections.js";

/**
 * A steading rating's short name, as the shipped sheet already abbreviates it —
 * `stonetop.steading.attrShort` in `languages/en.json`. The deck has no i18n, so this mirrors it.
 */
const STEADING_SHORT = {
	fortunes: "Fort", surplus: "Surp", size: "Size", population: "Pop", prosperity: "Pros", defenses: "Def",
};

/** One move, asked about rather than inspected. */
export class MoveView {
	constructor(raw, categoryKey, categoryLabel) {
		this.raw = raw;
		this.slug = raw.slug;
		this.name = raw.name;
		this.gloss = raw.gloss ?? "";
		this.rollStat = raw.rollStat ?? null;
		this.categoryKey = categoryKey;
		this.categoryLabel = categoryLabel;
	}

	get rollsDice() { return Boolean(this.rollStat); }

	/**
	 * What is ADDED to 2d6, or null when nothing is. Null is not "does not roll" — `rollsDice` answers
	 * that, and the two differ for a `prompt` move, which rolls plain 2d6 with no stat added and so
	 * has no modifier to print. `ask` lets the player choose which stat, so it adds any of them.
	 * These used to share one label, which would have told a dying player to add a stat.
	 *
	 * A steading rating takes its short form: "+FORTUNES" in full was the widest thing in the rail.
	 */
	get rollLabel() {
		if (!this.rollStat || this.rollStat === "prompt") return null;
		if (this.rollStat === "ask") return "+ANY";
		return `+${(STEADING_SHORT[this.rollStat] ?? this.rollStat).toUpperCase()}`;
	}

	get timesTaken() { return this.raw.selection?.value ?? 0; }

	/** How many times the book lets this move be taken — Well Versed and Improved Stat three. */
	get maxTakes() { return this.raw.selection?.max ?? 1; }

	get isRepeatable() { return this.maxTakes > 1; }

	get isTaken() { return this.timesTaken > 0; }

	/**
	 * What the character has marked inside the move — Well Versed's topics — as against a list the
	 * move tells you to pick from each time you roll it, which is stored nowhere and is not here.
	 * The DATA says which is which: only a move carrying a choice group has picks, and only the rows
	 * of it that carry a track are something to mark.
	 */
	get picks() {
		return (this.raw.choices?.list ?? [])
			.filter(row => row.track)
			.map(row => PickView.fromEntry(row));
	}

	get markedPicks() { return this.picks.filter(p => p.marked); }

	/** Which part of an expedition this move is for — "setting-out", "on-the-road", "getting-home". */
	get phase() { return this.raw.phase ?? null; }

	/** The move this one is made INSTEAD of — Undying, Tethered and Dark Succor take Death's Door's place. */
	get replaces() { return this.raw.replaces ?? null; }

	get resource() { return this.raw.resource ?? null; }

	/** The uses column: "1/3" when the move tracks a resource, nothing when it doesn't. */
	get usesLabel() {
		const r = this.resource;
		return r ? `${r.current}/${r.max}` : null;
	}

	get descriptionHtml() { return html(this.raw.description); }

	/**
	 * The 10+ / 7-9 / 6- rows, for the preview card.
	 *
	 * A move can carry all three LABELS with every value empty — Logbook does — so presence of
	 * `moveResults` is not presence of tiers. Filtering on the label would print three empty rows.
	 */
	get tiers() {
		const m = this.raw.moveResults;
		if (!m) return [];
		return ["success", "partial", "failure"]
			.filter(k => m[k] && String(m[k].value?.raw ?? m[k].value ?? "").trim())
			.map(k => ({ label: m[k].label, value: html(m[k].value) }));
	}

	/**
	 * The requirement as the shipped label states it. That label names the move's playbook as well —
	 * Initiate of the Secret Arts reads "The Seeker, Level 2" on the Seeker's own sheet — because
	 * `MoveRequirements#labelFor` always prints it. A check here used to try to drop such
	 * requirements, and never fired: the snapshot carries only the label and whether it is met.
	 */
	get requirement() { return this.raw.requiresLabel ?? null; }

	/** Advisory, as everywhere in this system: an unmet requirement is marked, never enforced. */
	get requirementMet() { return this.raw.requirement?.met !== false; }
}

/**
 * One thing a move or a possession lets you mark, and whether it is marked.
 *
 * The two arrive in different shapes, because the book prints them differently: Well Versed's topics
 * are entries with a box each, a Heavy's weapons are options of one "choose up to 3" row. Both are
 * the same thing on a row — something picked or not — so they become one view, and each shape has
 * its own factory rather than one constructor guessing which it was handed.
 */
export class PickView {
	constructor(slug, label, marked, { detail = "", exclusive = false } = {}) {
		this.slug = slug;
		this.label = label;
		this.marked = marked;
		this.detail = detail;        // an option's description, beside its text: Symbol of authority's
		this.exclusive = exclusive;  // a pick-1 row, where picking one clears the others
	}

	/** An entry row with a one-box track — a Well Versed topic. */
	static fromEntry(row) {
		return new PickView(row.slug, html(row.content?.text), (row.track?.checks ?? []).some(Boolean));
	}

	/** One option of a pick row — a Heavy's weapon — which is exclusive when the row is a radio. */
	static fromOption(option, row) {
		return new PickView(option.slug, html(option.text), Boolean(option.checked),
			{ detail: html(option.description), exclusive: Boolean(row.radio) });
	}
}

/**
 * One part of an expedition and the moves for it. `key` is null for the moves no phase names, which
 * are drawn after the phases under no heading rather than left off.
 */
export class MovePhase {
	constructor(key, moves) {
		this.key = key;
		this.moves = moves;
	}
}

/** The order a journey runs in, which is the order the rail draws them. */
const EXPEDITION_PHASE_ORDER = ["setting-out", "on-the-road", "getting-home"];

/**
 * One special possession, asked about rather than inspected — the possessions tab's MoveView.
 *
 * `name` is the words for a label a screen reader says; `nameHtml` is what is drawn, because a few
 * are printed with emphasis in them ("Sacred pouch (*magical*)").
 */
export class PossessionView {
	constructor(raw) {
		this.raw = raw;
		this.slug = raw.slug;
	}

	get name() { return String(this.raw.label?.raw ?? this.raw.label ?? "").trim(); }
	get nameHtml() { return html(this.raw.label); }
	get descriptionHtml() { return html(this.raw.description); }
	get isTaken() { return Boolean(this.raw.checked); }

	/** Handed over by the playbook — Scribe's tools — and what handed it, as the sheet names it. */
	get isGranted() { return Boolean(this.raw.preselected); }
	get grantedBy() { return this.raw.preselectedSource ?? null; }

	/** The shipped sheet disables the box of a granted possession; this reads that, it does not decide it. */
	get isLocked() { return Boolean(this.raw.disabled); }

	get resource() { return this.raw.resource ?? null; }

	/** One the GM added by hand, which the shipped sheet lets be deleted. */
	get isRemovable() { return Boolean(this.raw.removable); }

	get picks() {
		return (this.raw.choices?.list ?? [])
			.filter(row => row.type === "choice")
			.flatMap(row => (row.options ?? []).map(option => PickView.fromOption(option, row)));
	}

	get markedPicks() { return this.picks.filter(p => p.marked); }
}

/**
 * The possessions a playbook offers, and the budget it states.
 *
 * A playbook grant is not a pick: Scribe's tools comes with the Seeker, so counting it reported "2 of
 * 2 picked" while one was still owed. `owed` never goes below zero — a third pick is the player's
 * business, and a list is not in debt for having one.
 */
export class PossessionList {
	constructor(raw) {
		this.items = (raw?.items ?? []).map(item => new PossessionView(item));
		this.budget = raw?.pickCount ?? 0;
		this.note = raw?.pickNote ?? "";
	}

	get granted() { return this.items.filter(i => i.isGranted); }
	get chosen() { return this.items.filter(i => i.isTaken && !i.isGranted); }
	get owed() { return Math.max(0, this.budget - this.chosen.length); }
}

/**
 * The one instinct a character has, and where it is edited.
 *
 * There is always exactly one. An insert carrying its own REPLACES the playbook's, and within
 * either a picked option and a written-in one are mutually exclusive — so this is a single computed
 * label, never a list and never two. It carries its surface because the readout is in the rail and
 * the editor is not: something has to be able to point at it.
 */
export class InstinctView {
	constructor(label, source, tab) {
		this.label = label;
		this.source = source;    // the playbook's or the insert's name
		this.tab = tab;          // "playbook", or the insert's own tab: "insert-thrall"
	}

	get isFromInsert() { return this.tab !== "playbook"; }
	get isEmpty() { return !this.label; }
}

/**
 * One of the three conditions, and the two stats it hinders.
 *
 * `description` is two sentences doing two jobs: what the condition IS, then which rolls it costs.
 * The masthead prints only the first, and the reason is on `actor-header.hbs` — the clause naming
 * the stats is already on the sheet as the two red numbers, so repeating it spends a line saying
 * what the layout has said. `summary` is that split.
 */
export class ConditionView {
	constructor(raw) {
		this.key = raw.key;
		this.name = raw.name;
		this.active = Boolean(raw.active);
		this.description = raw.description ?? "";
		this.stats = raw.stats ?? [];
	}

	/** What the condition is — the first sentence, without the clause naming the rolls. */
	get summary() {
		const end = this.description.indexOf(". ");
		return end === -1 ? this.description : this.description.slice(0, end + 1);
	}

	hinders(statKey) { return this.stats.includes(statKey); }
}

/**
 * Two stats and the one condition that hinders them.
 *
 * The three pairs are contiguous in the canonical order and cover all six exactly once — a property
 * of the rules rather than of the layout, and the thing that makes the relationship showable at all
 * (`docs/features/stats-and-conditions.md`). Drawing a pair as a unit is what lets the folded
 * density answer "which numbers does this one cost me" BEFORE it is marked, which is the question
 * marking one is a choice between.
 */
export class StatPairView {
	constructor(raw) {
		this.stats = raw.stats;
		this.condition = new ConditionView(raw.debility);
	}

	get isActive() { return this.condition.active; }

	/** The pair's abbreviations, for the sentence that names what a marked condition is costing. */
	get abbrs() { return this.stats.map(s => s.abbr); }
}

/** A move's view, handed to the classes that hold moves without knowing what one is. */
const toMove = (raw, key, label) => new MoveView(raw, key, label);

export class CharacterSnapshot {
	#s;
	#context;

	constructor(context) {
		this.#context = context;
		this.#s = context.stonetop;
		this.portrait = assetPath(context.mkActor?.img);
	}

	static async load(url) {
		return new CharacterSnapshot(await (await fetch(url)).json());
	}

	get name() { return this.#s.name; }
	get playbookName() { return this.#s.playbook.name; }
	get playbookSlug() { return this.#s.playbook.slug; }
	get playbookCrest() { return assetPath(this.#s.playbook.img); }
	get statsNote() { return this.#s.playbook.statsNote; }
	get rollMode() { return this.#s.rollMode; }

	get stats() {
		return ["str", "dex", "int", "wis", "con", "cha"].map(key => this.#s.stats[key]);
	}

	/**
	 * The scores the playbook offers, e.g. [2, 1, 1, 0, 0, -1].
	 *
	 * STANDS IN FOR DATA THAT DOES NOT EXIST. There is no structured starting-stat field anywhere —
	 * only the prose in `statsNote`, which is a translated StringField (`PlaybookData.js:20`). This
	 * parses the digits out of it, which is exactly what the real sheet must NOT do: the moment that
	 * sentence is translated the parse is wrong. A real `startingStats` array is the fix; this only
	 * lets the mockup draw the affordance. See NOTES.md → Mock issues, not real bugs.
	 */
	get startingStats() {
		const note = this.#s.playbook?.statsNote ?? "";
		return [...String(note).matchAll(/([+-]\d+)/g)].map(m => Number(m[1]));
	}

	/**
	 * Which offered scores have not been placed yet, as a MULTISET difference.
	 *
	 * The array has duplicates — +1,+1 and +0,+0 — so assigning one +1 must leave the other still
	 * offered. A set difference would retire both on the first placement.
	 */
	get unassignedStartingStats() {
		const remaining = [...this.startingStats];
		for (const stat of this.stats) {
			const i = remaining.indexOf(stat.value);
			if (i !== -1) remaining.splice(i, 1);
		}
		return remaining;
	}

	get debilities() { return this.#s.debilities; }

	/**
	 * The six stats as their three condition pairs.
	 *
	 * The grouping is in the snapshot already — `statPairs` carries each pair with its debility
	 * attached — so nothing here re-derives which condition hinders which stats from the layout.
	 */
	get statPairs() { return this.#s.statPairs.map(pair => new StatPairView(pair)); }

	/** The one condition a character is actually under, if any. They never compound, so at most one matters to read. */
	get activeConditions() { return this.statPairs.map(p => p.condition).filter(c => c.active); }

	/** HP as a meter: how full, and whether it has reached the point where "how bad" beats "how much". */
	get hp() {
		const { value, max } = this.#s.vitals.hp;
		const pct = max ? Math.round((value / max) * 100) : 0;
		return { value, max, pct, low: pct <= 25 };
	}

	/**
	 * Experience, and the fact the bar has to carry that hit points do not: it does not stop.
	 *
	 * The threshold is the cost of the next level, and experience runs past it — Burn Brightly
	 * triggers on *having enough to level*, not once, so every 2 points above the line is another
	 * roll that can be pushed before the level is out of reach again. A bar that clipped at the
	 * threshold drew 21 and 16 identically, at exactly the point the difference starts mattering.
	 *
	 * So the scale is whichever is larger, and the threshold is a mark on the track rather than its
	 * end. Below it nothing changes: the mark sits at 100% and the bar reads as it always did.
	 */
	get xp() {
		const { value, max } = this.#s.vitals.xp;
		const scale = Math.max(value, max) || 1;
		return {
			value, max,
			scale,
			pct: Math.round((value / scale) * 100),
			thresholdPct: Math.round((max / scale) * 100),
			over: Math.max(0, value - max),
			full: value >= max,
		};
	}

	get level() { return this.#s.vitals.level; }

	/* Where each number came from, in the long form. Said to EVERYONE — the sheet ties these on with
	   aria-describedby rather than leaving them in a pointer-only tooltip. */
	get hpSource() { return this.#s.vitals.sources?.hp ?? ""; }
	get armorSource() { return this.#s.vitals.sources?.armor ?? ""; }
	get damageSource() { return this.#s.vitals.sources?.damage ?? ""; }
	get armor() { return this.#s.vitals.armor; }
	get damage() { return this.#s.vitals.damage.value; }

	/** The playbook's own moves — the Moves tab's subject. */
	get playbookCategory() {
		const cat = this.#s.moves.categories.find(c => c.renderStyle === "standard");
		return {
			key: cat.key,
			label: cat.label,
			note: cat.note ?? null,
			moves: cat.moves.map(m => new MoveView(m, cat.key, cat.label)),
		};
	}

	/** Reference moves the system supplies — four groups, 26 rows, none of them chosen by the player. */
	get referenceCategories() {
		return this.#s.moves.categories
			.filter(c => c.renderStyle === "side-bar")
			.map(c => ({ key: c.key, label: c.label, moves: c.moves.map(m => new MoveView(m, c.key, c.label)) }));
	}

	#category(key) {
		return this.#s.moves.categories.find(c => c.key === key) ?? null;
	}

	#movesOf(key) {
		const cat = this.#category(key);
		return (cat?.moves ?? []).map(m => new MoveView(m, cat.key, cat.label));
	}

	/**
	 * The ten basic moves — the rail's first list, and the one that is always open.
	 *
	 * D8: they trigger constantly and nine of the ten roll, and they are the reason a persistent
	 * column exists at all.
	 */
	get basicMoves() { return this.#movesOf("basic"); }

	/**
	 * The ten expedition moves, grouped by the part of the journey each is for — the rail's second list.
	 *
	 * D8: on the road they fire as often as the basic moves do, and three of them roll. Phases come in
	 * the journey's order whatever order the capture lists the moves in; within a phase the capture's
	 * order stands. Moves no phase names come last, as one group with no key.
	 */
	get expeditionPhases() {
		const moves = this.#movesOf("expedition");
		const phased = EXPEDITION_PHASE_ORDER
			.map(key => new MovePhase(key, moves.filter(m => m.phase === key)))
			.filter(p => p.moves.length);
		const rest = moves.filter(m => !EXPEDITION_PHASE_ORDER.includes(m.phase));
		return rest.length ? [...phased, new MovePhase(null, rest)] : phased;
	}

	/** The two follower moves. D8: drawn once, with the followers, and not once per follower. */
	get followerMoves() { return this.#movesOf("follower"); }

	/** Whether there is anyone for the follower moves to be about. */
	get hasFollowers() { return (this.#s.followers?.tab ?? []).length > 0; }

	/** One special move by slug. They are not a group and never render as one — each has a condition. */
	specialMove(slug) {
		return this.#movesOf("special").find(m => m.slug === slug) ?? null;
	}

	/**
	 * The instinct to show, and where to send someone who wants to change it.
	 *
	 * Inserts are asked first because an insert's instinct replaces the playbook's.
	 * `instinctSelected` is already the computed label on both — the picked option's name with its
	 * description, or whatever was written in — so nothing here composes a string.
	 */
	get instinct() {
		const carrier = this.instinctInsert;
		if (carrier) return new InstinctView(carrier.instinctLabel, carrier.name, carrier.tabId);
		return new InstinctView(this.#s.playbook.instinctSelected ?? "", this.playbookName, "playbook");
	}

	/**
	 * The insert whose instinct is in force, or null while the playbook's is. The playbook's is kept
	 * rather than cleared — give the insert up and it is back — so its section has to be able to say
	 * it is set aside, and for what.
	 */
	get instinctInsert() { return this.inserts.findLast(i => i.carriesInstinct) ?? null; }

	/**
	 * Appearance as one line of picked words: the picked word of each line, in the book's order.
	 *
	 * The same derivation the Playbook tab's resting line uses, because they are one value — the
	 * masthead reads it and the Playbook tab is where it is changed. It used to read the shipped
	 * condenser's output, which says the same thing for a capture and could not follow a pick made in
	 * the deck. Nothing picked is no line at all, which is the right empty state rather than a gap.
	 */
	get appearance() {
		return this.playbookSections.appearance.chosen.map(item => item.labelHtml).join(" · ");
	}

	/** The same line as words alone, for a tooltip — the masthead cuts it short on a narrow sheet. */
	get appearanceText() {
		return this.playbookSections.appearance.chosen.map(item => item.labelText).join(" · ");
	}

	/** Enough experience to level. Whether they MAY is fiction, and nothing here can know it. */
	get readyToLevel() { return this.xp.full; }

	/** Death's Door's condition, and the only one of the three the rail draws from hit points. */
	get isDying() { return this.hp.value <= 0; }

	/**
	 * The move a character makes at zero hit points. Death's Door, unless they hold a move made instead
	 * of it: each insert gained by dying brings its own — Tethered, Undying, Dark Succor — and a
	 * character already dead does not glimpse the Last Door again. Which moves those are is data
	 * (`replaces`); see `MOVE_REPLACES` in standIns.js until the packs carry it.
	 */
	get dyingMove() {
		return this.inserts.flatMap(i => i.moves).find(m => m.replaces === "deaths-door")
			?? this.specialMove("deaths-door");
	}

	/**
	 * The same character with different numbers, as a NEW snapshot.
	 *
	 * The rail's argument is that a conditional thing appears when its condition is met — and every
	 * one of those conditions is a vital. A deck that cannot reach the threshold or zero hit points
	 * can only ever draw the frame where none of them fire.
	 */
	withVitals(over) {
		const vitals = { ...this.#s.vitals };
		for (const [key, patch] of Object.entries(over)) {
			vitals[key] = patch && typeof patch === "object"
				? { ...vitals[key], ...patch }
				: patch;
		}
		return this.#with({ vitals });
	}

	get possessions() { return new PossessionList(this.#s.possessions); }

	get playbookSections() { return new PlaybookSections(this.#s.playbook); }

	/** Every insert the character holds, in the order they were gained — each a tab of its own. */
	get inserts() { return (this.#s.inserts ?? []).map(raw => new InsertView(raw, toMove)); }

	insertByTab(tabId) { return this.inserts.find(i => i.tabId === tabId) ?? null; }

	/**
	 * How many new moves the level-up is still waiting on — MOVES, not rows: the step is one row
	 * however far behind it is. The rail starts the workflow; the moves tab finishes it.
	 */
	get owedMoves() {
		const row = this.#chooseMoveRow;
		return row && row.done === false ? Math.max(0, row.expected - row.chosen) : 0;
	}

	/** The Level Up move's own words for the step — the sheet writes none of its own. */
	get chooseMoveText() { return html(this.#chooseMoveRow?.step?.text); }

	/**
	 * The Level Up move's trigger, verbatim. It is the only thing on the sheet that says levelling
	 * happens AT HOME, so the offer carries it rather than a sentence of the sheet's own.
	 */
	get levelUpTrigger() { return this.#s.levelUp?.gloss ?? ""; }

	get #chooseMoveRow() {
		return (this.#s.levelUp?.rows ?? []).find(r => r?.step?.tab === "moves") ?? null;
	}

	/**
	 * The same character with the level-up still owing `count` moves.
	 *
	 * A control, because Maelen cannot be argued into it: she has taken more than level 5 gives, two of
	 * them moves that need level 6. What the step reads is only how far behind it is.
	 */
	withLevelUpOwing(count) {
		const rows = (this.#s.levelUp?.rows ?? []).map(r => r?.step?.tab === "moves"
			? { ...r, chosen: r.expected - count, done: count === 0 }
			: r);
		return this.#with({ levelUp: { ...this.#s.levelUp, rows } });
	}

	/**
	 * The same character having taken a playbook move `count` times — what pressing one of its take
	 * boxes saves on the real sheet. Held to what the book allows, as `incrementMove` holds it.
	 */
	withTimesTaken(slug, count) {
		return this.#withPlaybookMove(slug, m => {
			const max = m.selection?.max ?? 1;
			const value = Math.max(0, Math.min(count, max));
			return { ...m, selection: { ...m.selection, value }, selectable: value < max };
		});
	}

	/** The same character with one of a move's picks marked or cleared. */
	withPickMarked(slug, pickSlug, marked) {
		return this.#withPlaybookMove(slug, m => ({ ...m, choices: m.choices && markInGroup(m.choices, pickSlug, marked) }));
	}

	/** The same character having ticked or cleared a possession — what its box saves. */
	withPossessionTaken(slug, taken) {
		return this.#withPossession(slug, p => ({ ...p, checked: taken, selected: taken }));
	}

	/** The same character with a possession's option picked or cleared; a pick-1 row clears the rest. */
	withPossessionPick(slug, optionSlug, marked) {
		return this.#withPossession(slug, p => ({ ...p, choices: p.choices && markInGroup(p.choices, optionSlug, marked) }));
	}

	/**
	 * This character with another's special possessions — the deck's way to show a list Maelen does not
	 * have (a Heavy's weapons, with options) without pretending a Seeker carries them anywhere else.
	 */
	withPossessionsOf(other) {
		return this.#with({ possessions: other.#s.possessions });
	}

	/**
	 * The same character with these followers instead — a control, because the follower moves appear
	 * only while there is someone to order, and Maelen always has four.
	 */
	withFollowers(slugs) {
		return this.#with({ followers: { ...this.#s.followers, tab: slugs } });
	}

	/**
	 * The same character with each expedition move carrying its phase, the way the pack would carry it
	 * once it has the field — see `EXPEDITION_PHASES` in standIns.js.
	 */
	withExpeditionPhases(phaseBySlug) {
		const categories = this.#s.moves.categories.map(cat => cat.key !== "expedition" ? cat : {
			...cat,
			moves: cat.moves.map(m => ({ ...m, phase: phaseBySlug[m.slug] ?? null })),
		});
		return this.#with({ moves: { ...this.#s.moves, categories } });
	}

	/**
	 * This character with another's inserts — the deck's way to show a Thrall and a Lightbearer's
	 * Invocations on a Seeker, the way it borrows a Heavy's possessions.
	 */
	withInsertsOf(other) {
		return this.#with({ inserts: other.#s.inserts });
	}

	/** The same character without one insert — given up, as Undying's 6- lets a Revenant do. */
	withoutInsert(slug) {
		return this.#with({ inserts: (this.#s.inserts ?? []).filter(i => i.slug !== slug) });
	}

	/**
	 * The same character with each insert move stamped with the move it is made instead of, the way the
	 * pack would carry it once it has the field — see `MOVE_REPLACES` in standIns.js.
	 */
	withMoveReplacements(replacesBySlug) {
		const inserts = (this.#s.inserts ?? []).map(i => ({
			...i,
			moves: (i.moves ?? []).map(m => ({ ...m, replaces: replacesBySlug[m.slug] ?? m.replaces ?? null })),
		}));
		return this.#with({ inserts });
	}

	/**
	 * The same character with a blank on each named entry of an insert's group that has none — the way
	 * the pack would carry it once it has one. See `TERRIBLE_PURPOSE_INPUTS` in standIns.js.
	 */
	withEntryInputs(groupSlug, entrySlugs) {
		const blank = slug => ({ slug: `${slug}-input`, placeholder: null, value: "", type: "inline" });
		const inserts = (this.#s.inserts ?? []).map(i => ({
			...i,
			choices: (i.choices ?? []).map(g => g.slug !== groupSlug ? g : {
				...g,
				list: g.list.map(row => entrySlugs.includes(row.slug) && !row.input ? { ...row, input: blank(row.slug) } : row),
			}),
		}));
		return this.#with({ inserts });
	}

	/** The same character with one thing in a section ticked or cleared — addressed by the section's key. */
	withMarked(sectionKey, itemSlug, marked) {
		return this.#withGroup(sectionKey, group => markInGroup(group, itemSlug, marked));
	}

	/** The same character with one question in a section answered. */
	withAnswer(sectionKey, itemSlug, value) {
		return this.#withGroup(sectionKey, group => answerInGroup(group, itemSlug, value));
	}

	/** The same character with an instinct written in by hand, which clears the pick — they are exclusive. */
	withInstinctWritten(sectionKey, text) {
		return this.#withOwner(SectionKey.parse(sectionKey), owner => {
			const picked = (owner.instinctGroup?.list?.[0]?.options ?? []).find(o => o.checked);
			return {
				...owner,
				instinctSelected: text || null,
				instinctGroup: picked ? markInGroup(owner.instinctGroup, picked.slug, false) : owner.instinctGroup,
			};
		});
	}

	/** The same character with another background — one of three, so choosing it unchooses the rest. */
	withBackground(slug) {
		const bg = this.#s.playbook.background;
		const options = (bg?.options ?? []).map(o => ({ ...o, selected: o.slug === slug }));
		return this.#with({ playbook: { ...this.#s.playbook, background: { ...bg, selected: slug, options } } });
	}

	/** The same character from another region. */
	withOrigin(region) {
		const origin = this.#s.playbook.origin;
		const options = (origin?.options ?? []).map(o => ({ ...o, selected: o.region === region }));
		return this.#with({ playbook: { ...this.#s.playbook, origin: { ...origin, selected: region, options } } });
	}

	/** The same character, renamed — what pressing a name on an origin's list does. */
	withName(name) { return this.#with({ name }); }

	#withGroup(sectionKey, change) {
		const key = SectionKey.parse(sectionKey);
		return this.#withOwner(key, owner => key.isPlaybook
			? changePlaybookGroup(owner, key, change)
			: changeInsertGroup(owner, key, change));
	}

	/** The playbook, or the one insert the key names, changed. */
	#withOwner(key, change) {
		if (key.isPlaybook) return this.#with({ playbook: change(this.#s.playbook) });
		return this.#with({
			inserts: (this.#s.inserts ?? []).map(i => `insert-${i.slug}` === key.owner ? change(i) : i),
		});
	}

	#withPossession(slug, change) {
		const items = this.#s.possessions.items.map(p => p.slug === slug ? change(p) : p);
		return this.#with({ possessions: { ...this.#s.possessions, items } });
	}

	/** The same character with a move's text and choice group replaced — see `standIns.js`. */
	withMoveChoices(slug, description, choices) {
		return this.#withPlaybookMove(slug, m => ({ ...m, description, choices }));
	}

	#withPlaybookMove(slug, change) {
		const categories = this.#s.moves.categories.map(cat => cat.renderStyle !== "standard" ? cat : {
			...cat,
			moves: cat.moves.map(m => m.slug === slug ? change(m) : m),
		});
		return this.#with({ moves: { ...this.#s.moves, categories } });
	}

	#with(over) {
		return new CharacterSnapshot({ ...this.#context, stonetop: { ...this.#s, ...over } });
	}
}

/**
 * An instinct's owner — the playbook or an insert — with its group changed and its label following.
 * A write that leaves nothing picked keeps the label it had, which is how a written-in one survives.
 */
function changeInstinctGroup(owner, change) {
	const instinctGroup = change(owner.instinctGroup);
	return { ...owner, instinctGroup, instinctSelected: instinctLabelOf(instinctGroup) ?? owner.instinctSelected };
}

function changePlaybookGroup(playbook, key, change) {
	switch (key.part) {
		case "instinct": return changeInstinctGroup(playbook, change);
		case "appearance": return { ...playbook, appearanceGroup: change(playbook.appearanceGroup) };
		case "lore": return { ...playbook,
			loreGroups: (playbook.loreGroups ?? []).map(g => g.slug === key.sub ? change(g) : g) };
		case "background": return { ...playbook, background: { ...playbook.background,
			options: (playbook.background?.options ?? []).map(o => o.slug === key.sub ? { ...o, choices: change(o.choices) } : o) } };
		case "introductions": {
			const field = key.sub === "npc" ? "npcGroup" : "pcGroup";
			return { ...playbook, introductions: { ...playbook.introductions, [field]: change(playbook.introductions?.[field]) } };
		}
		default: return playbook;
	}
}

function changeInsertGroup(insert, key, change) {
	if (key.isInstinct) return changeInstinctGroup(insert, change);
	return { ...insert, choices: (insert.choices ?? []).map(g => g.slug === key.part ? change(g) : g) };
}

function assetPath(p) {
	return "/" + String(p ?? "").replace(/^\//, "");
}
