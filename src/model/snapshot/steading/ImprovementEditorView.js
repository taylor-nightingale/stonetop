import { rich } from "../RichText.js";
import { Seasons } from "../../data/steading/Seasons.js";
import { Moment } from "../../data/steading/Moments.js";
import { EFFECT_LISTS, EFFECT_SET_TARGETS, EFFECT_TARGETS, ImprovementEffect } from "../../data/steading/ImprovementEffect.js";
import { SteadingDefaults } from "../../data/steading/SteadingDefaults.js";
import { SectionRule } from "../../data/steading/ImprovementRequirements.js";
import { TurnoverLine } from "./TurnoverStatement.js";
import { LIST_LABELS } from "./EffectChip.js";

/**
 * What the improvement sheet draws: the improvement's card, grouped as the card groups it, each part
 * with what its editor offers.
 *
 * A section is its heading over its requirements; a line of text stands alone; each result reads as
 * the card states it. The one open editor (ImprovementEditing) is marked where it hangs. Labels are
 * keys — none of the words are written here, except a moment's own name.
 */
const K = "stonetop.improvement";

/** The book's notation for the rolls a result can wait on (OutcomeRange). */
export const OUTCOMES = ["10+", "7+", "7-9", "6-"];

/**
 * The roll-mode picker's shape: a few choices, the live one checked. `hasDetail` says which options
 * ask for fields of their own, drawn under the option once it is chosen.
 */
const modes = (keys, current, labelKey, hasDetail = () => false) =>
	keys.map(key => ({ key, labelKey: labelKey(key), checked: key === current, hasDetail: hasDetail(key) }));

/** A moment results already use, as the author sees it, for the moment field to offer and match. */
export class KnownMoment {
	/**
	 * @param label  what the author sees — the book's moment in their language, another author's in theirs
	 * @param name   the stored words of a moment an author made up; null for the book's
	 * @param shared whether an improvement other than this one fires at it
	 */
	constructor({ key, label, name = null, seasons = [], shared = false }) {
		this.key     = key;
		this.label   = label;
		this.name    = name;
		this.seasons = seasons;
		this.shared  = shared;
	}
}

/** A requirement or a line of text, as the card draws it, with its place in its block. */
export class ImprovementEditorRow {
	constructor({ index, row, section = null }) {
		this.index         = index;
		this.isRequirement = row.isRequirement;
		this.text          = rich(row.text);
		this.words         = row.text;
		this.checks        = Array.from({ length: row.boxes }, () => false);
		// Where a requirement stands in its section: it moves within it, and the last one out asks
		// to take the section with it — a heading is never left saying nothing.
		this.lead             = section?.lead ?? null;
		const at              = section ? section.rowIndexes.indexOf(index) : -1;
		this.isFirstInSection = at === 0;
		this.isLastInSection  = section ? at === section.rowIndexes.length - 1 : false;
		this.isOnlyInSection  = section ? section.rowIndexes.length === 1 : false;
	}
}

/** A section heading, as written, and the rule its editor offers. */
export class ImprovementEditorHeading {
	constructor({ index, row, section, generated, hasSectionAbove, isOpen, prefix }) {
		this.index    = index;
		this.text     = rich(row.text);
		this.words    = row.text;
		// Not `rule`: the roll-mode picker this is handed to reads a `rule` of its own (its help button).
		this.ruleKind = section.rule.kind;
		this.count    = section.rule.count ?? 1;
		this.isSome   = section.rule.kind === "some";
		// "None of these count" is the book's Well-Trained Militia; it is kept, not offered. "Or
		// instead" needs a section above it to be instead of.
		const kinds   = SectionRule.KINDS.filter(k => k === section.rule.kind
			|| (k !== "none" && (k !== "or" || hasSectionAbove)));
		this.ruleModes = modes(kinds, section.rule.kind, k => `${K}.rule.${k}`, k => k === "some");
		this.ruleName  = `${prefix}-heading-${index}-rule`;
		this.glossKey  = `${K}.gloss.rule.${section.rule.kind}`;
		this.isGenerated     = generated !== null && row.text === generated;
		this.canUseGenerated = generated !== null && row.text !== generated;
		this.hasSectionAbove = hasSectionAbove;
		this.isOpen   = isOpen;
	}
}

/** One block of the card's rows: a section (its heading over its requirements), or a line of text. */
export class ImprovementEditorBlock {
	constructor({ blockIndex, count, line = null, heading = null, requirements = [], lead = null }) {
		this.blockIndex   = blockIndex;
		this.isFirst      = blockIndex === 0;
		this.isLast       = blockIndex === count - 1;
		this.isLine       = line !== null;
		this.isSection    = line === null;
		this.line         = line;
		this.heading      = heading;
		this.requirements = requirements;
		this.lead         = lead;
	}
}

/** One of the improvement's results — saved, or being drafted in the adder — and what its editor offers. */
export class ImprovementEditorResult {
	/**
	 * @param index   its place among the results; null for the adder's draft
	 * @param moments every KnownMoment, for the moment field
	 * @param label   (key) => words — the moment field shows the moment's name as text
	 */
	constructor({ index, result, generated, moments = [], label = key => key, isOpen = false, prefix = "" }) {
		const line = new TurnoverLine({ id: `result-${index}`, source: "", effect: ImprovementEffect.fromRaw(result.toRaw()), earned: false, applied: null });
		this.index        = index;
		this.isAdder      = index === null;
		this.isOpen       = isOpen;
		this.nameBase     = `${prefix}-result-${index ?? "new"}`;
		// The card's own statement of it — its words, its clause, and its timing where it has no clause.
		this.text         = line.text;
		this.phrase       = line.phrase;
		this.timingKeys   = line.timingKeys;
		this.words        = result.text;
		this.phraseWords  = result.phrase ?? "";
		this.isCompletion = result.isCompletion;

		this.when         = result.when;
		this.whenModes    = result.isCompletion ? [] : modes(["turn", "moment", "standing"], result.when, k => `${K}.when.${k}`, () => true);
		this.seasons      = ["turn", "moment"].includes(result.when)
			? Seasons.all().map(s => ({ key: s.key, labelKey: s.labelKey, checked: result.seasons.includes(s.key) })) : null;
		// A moment is typed: the field shows its name, and offers the moments improvements use in its
		// seasons (selection-input's full list, never filtered by what is typed).
		this.momentField  = result.when === "moment" ? {
			text:    result.isNamedMoment ? result.momentName : (result.moment ? label(Moment.labelKeyFor(result.moment)) : ""),
			options: moments.filter(m => m.seasons.some(s => result.seasons.includes(s))).map(m => m.label),
		} : null;
		this.hasPhrase    = !result.isCompletion;
		// The season's own roll: a result at the turn or at a moment can wait on it; one that holds
		// while the improvement stands has no roll to wait on.
		this.outcomeModes = !["turn", "moment"].includes(result.when) ? null
			: [{ key: "", labelKey: `${K}.outcome.any`, checked: !result.outcome }, ...OUTCOMES.map(o => ({ key: o, labelKey: o, checked: o === result.outcome }))];

		this.does               = result.does;
		this.isMechanicEditable = result.isMechanicEditable;
		this.doesModes          = modes(["nothing", "change", "list", "set"], result.does, k => `${K}.does.${k}`, k => k !== "nothing");
		this.doesLabelKey       = `${K}.does.${result.does}`;
		this.ratingModes = result.does === "change" ? modes(EFFECT_TARGETS, result.rating, k => `stonetop.steading.attr.${k}`)
			: result.does === "set" ? modes(EFFECT_SET_TARGETS, result.rating, k => `stonetop.steading.attr.${k}`) : null;
		this.amount      = result.amount;
		this.listModes   = result.does === "list" ? modes(EFFECT_LISTS, result.list, k => LIST_LABELS[k]) : null;
		this.entry       = result.entry;
		const tiers      = result.does === "set" ? SteadingDefaults.rating(result.rating) : null;
		this.setValueModes = tiers?.values ? tiers.values.map((v, i) => ({ key: v, labelKey: tiers.tierKeys[i], checked: v === result.setValue })) : null;
		this.setValue    = result.setValue;
		this.moveSlug    = result.grantsMove;

		// The faint line under it at rest: what the sheet does with it.
		this.glossKey     = `${K}.gloss.${result.does}`;
		this.ratingKey    = result.rating ? `stonetop.steading.attr.${result.rating}` : null;
		this.listKey      = result.list ? LIST_LABELS[result.list] : null;
		this.signedAmount = result.amount === null ? null : `${result.amount > 0 ? "+" : ""}${result.amount}`;

		this.isGenerated     = generated !== null && result.text === generated;
		this.canUseGenerated = generated !== null && result.text !== generated;
	}

	get isChange() { return this.does === "change"; }
	get isList()   { return this.does === "list"; }
	get isSet()    { return this.does === "set"; }
	get isMove()   { return this.does === "move"; }
}

export class ImprovementEditorView {
	constructor({ blocks, halves }) {
		this.blocks = blocks;
		/** [{key, headKey, results, adder}] — the card's two halves, in its order. */
		this.halves = halves;
	}

	/**
	 * @param authoring the item's ImprovementAuthoring
	 * @param editing   the sheet's ImprovementEditing — which editor is open, and the draft
	 * @param moments   every KnownMoment, for a result's moment field
	 * @param label     (key) => words, for a moment's name in that field
	 * @param prefix    the sheet's id, scoping every radio group's name
	 */
	static from(authoring, { editing, moments = [], label = key => key, prefix = "" }) {
		const reqs     = authoring.requirements;
		const wording  = authoring.wording;
		const sections = reqs.sections;
		const blocks   = reqs.blocks;
		const views = blocks.map((block, blockIndex) => {
			if (block.kind === "line") {
				const index = block.rowIndexes[0];
				return new ImprovementEditorBlock({ blockIndex, count: blocks.length, line: new ImprovementEditorRow({ index, row: reqs.rows[index] }) });
			}
			const at      = sections.findIndex(s => s.lead === block.lead);
			const section = sections[at];
			const heading = section.heading === null ? null : new ImprovementEditorHeading({
				index: section.heading, row: reqs.rows[section.heading], section, prefix,
				generated: wording.heading(section.rule, section.isFirst),
				hasSectionAbove: at > 0, isOpen: editing.isHeadingOpen(section.heading),
			});
			const requirements = section.rowIndexes.map(index => new ImprovementEditorRow({ index, row: reqs.rows[index], section }));
			return new ImprovementEditorBlock({ blockIndex, count: blocks.length, heading, requirements, lead: section.lead });
		});

		const results = authoring.results.map((result, index) => new ImprovementEditorResult({
			index, result, moments, label, prefix, generated: wording.result(result), isOpen: editing.isResultOpen(index),
		}));
		const adderFor = half => (editing.isAdderOpen(half)
			? new ImprovementEditorResult({ index: null, result: editing.draft, moments, label, prefix, generated: wording.result(editing.draft), isOpen: true })
			: null);
		return new ImprovementEditorView({
			blocks: views,
			halves: [
				{ key: "completion", headKey: "stonetop.steading.effects.onCompletion", results: results.filter(r => r.isCompletion), adder: adderFor("completion") },
				{ key: "henceforth", headKey: "stonetop.steading.effects.henceforth",   results: results.filter(r => !r.isCompletion), adder: adderFor("henceforth") },
			],
		});
	}
}
