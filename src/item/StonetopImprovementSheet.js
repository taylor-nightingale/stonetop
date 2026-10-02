// Item sheet for authoring custom `improvement` items — the steading-improvement catalog picks up
// world improvements alongside the compendium ones (FoundrySteadingImprovementRepository).
//
// The sheet IS the improvement's card on the steading's project board, edited in place and grouped as
// the card groups it. Words are edited where they sit; a section heading's rule and a result's choices
// in the one editor that hangs from what opened it (ImprovementEditing), which saves as it goes — the
// wound editor's pattern — while a new result is drafted in an adder that writes nothing until Add, the
// outfit adder's. A locked improvement is the board's own card (steading-improvement-card.hbs).
//
// Handlers read the DOM and call one method on ImprovementAuthoring, which owns every write.

import { ImprovementAuthoring } from "./ImprovementAuthoring.js";
import { ImprovementEditing } from "./ImprovementEditing.js";
import { buildChoiceGroup } from "../model/snapshot/character/buildChoiceGroup.js";
import { enrichRichTextTree } from "../utils/enrichRichText.js";
import { rich } from "../model/snapshot/RichText.js";
import { ImprovementPayoff } from "../model/snapshot/steading/ImprovementPayoff.js";
import { ImprovementProgress } from "../model/snapshot/steading/ImprovementProgress.js";
import { ImprovementEditorView, KnownMoment } from "../model/snapshot/steading/ImprovementEditorView.js";
import { FoundrySteadingImprovementRepository, SteadingImprovement } from "../actors/steading/repositories/FoundrySteadingImprovementRepository.js";
import { FoundryMoveRepository } from "../actors/character/repositories/FoundryMoveRepository.js";
import { GrantedMoves } from "../actors/steading/GrantedMoves.js";
import { Moments } from "../model/data/steading/Moments.js";
import { ChangeActionRouter } from "../utils/ChangeActionRouter.js";
import { editOnly, confirmedDelete } from "../utils/sheetActions.js";
import { toggleDisclosure } from "../utils/Disclosure.js";
import { improvementBodyId } from "../utils/regionIds.js";

const rowIndex    = el => Number(el.closest("[data-index]")?.dataset.index);
const resultIndex = el => Number(el.closest("[data-result-index]")?.dataset.resultIndex);
const inAdder     = el => Boolean(el.closest(".stonetop-improvement-adder"));
const key         = target => Number(target.dataset.key);
const step        = target => Number(target.dataset.step);

/** A result's choices, as the `with…` each control makes — shared by a saved result and the adder's draft. */
function resultChange(action, el, sheet) {
	switch (action) {
		case "resultWhen":     return r => r.withWhen(el.value);
		case "resultSeason":   return r => r.withSeasons([...el.closest(".stonetop-improvement-panel").querySelectorAll('[data-change-action="resultSeason"]:checked')].map(box => box.value));
		case "resultMoment":   return r => r.withMomentNamed(el.value, sheet.knownMoments);
		case "resultOutcome":  return r => r.withOutcome(el.value);
		case "resultPhrase":   return r => r.withPhrase(el.value);
		case "resultDoes":     return r => r.withDoes(el.value);
		case "resultRating":   return r => r.withRating(el.value);
		case "resultAmount":   return r => r.withAmount(Number(el.value));
		case "resultList":     return r => r.withList(el.value);
		case "resultEntry":    return r => r.withEntry(el.value);
		case "resultSetValue": return r => r.withSetValue(el.type === "number" ? Number(el.value) : el.value);
		default: return null;
	}
}
const RESULT_CHOICES = ["resultWhen", "resultSeason", "resultMoment", "resultOutcome", "resultPhrase", "resultDoes",
	"resultRating", "resultAmount", "resultList", "resultEntry", "resultSetValue"];

export function createStonetopImprovementSheetClass(Base) {
	return class StonetopImprovementSheet extends Base {
		static DEFAULT_OPTIONS = {
			classes: ["improvement"], // concatenated onto the base's ["stonetop", "sheet", "item"]
			position: { width: 560, height: 640 },
			actions: {
				toggleImprovementCard: toggleDisclosure,
				toggleMoveBody:        toggleDisclosure,
				openHeading:     StonetopImprovementSheet.#onOpenHeading,
				openResult:      StonetopImprovementSheet.#onOpenResult,
				openResultAdder: StonetopImprovementSheet.#onOpenResultAdder,
				closePart:       StonetopImprovementSheet.#onClosePart,
				addResultDraft:  editOnly(StonetopImprovementSheet.#onAddResultDraft),
				addHeading:      editOnly(function () { return this.authoring.addHeading(); }),
				addLine:         editOnly(function () { return this.authoring.addLine(); }),
				addRequirementTo: editOnly(function (_ev, t) { return this.authoring.addRequirementTo(key(t)); }),
				stepBoxes:       editOnly(function (_ev, t) { return this.authoring.stepBoxes(key(t), step(t)); }),
				moveBlock:       editOnly(function (_ev, t) { this.editing.close(); return this.authoring.moveBlock(key(t), step(t)); }),
				moveRequirement: editOnly(function (_ev, t) { return this.authoring.moveRequirement(key(t), step(t)); }),
				moveResult:      editOnly(function (_ev, t) { this.editing.close(); return this.authoring.moveResult(key(t), step(t)); }),
				removeLine:      confirmedDelete(function (t) { return this.authoring.removeRow(key(t)); }),
				removeSection:   confirmedDelete(function (t) { this.editing.close(); return this.authoring.removeSection(key(t)); }),
				removeHeading:   confirmedDelete(function (t) { this.editing.close(); return this.authoring.removeHeading(key(t)); }),
				removeResult:    confirmedDelete(function (t) { this.editing.close(); return this.authoring.removeResult(key(t)); }),
				useGeneratedHeading:     editOnly(function (_ev, t) { return this.authoring.useGeneratedHeading(key(t)); }),
				useGeneratedResultWords: editOnly(StonetopImprovementSheet.#onUseGeneratedResultWords),
			},
		};

		static PARTS = {
			form: {
				template: "systems/stonetop/templates/item/improvement.hbs",
				// The part's single root element (.stonetop-improvement-sheet) is the scroll
				// container; "" is HandlebarsApplicationMixin's "the part root itself" selector.
				scrollable: [""],
			},
		};

		get authoring() {
			return this._authoring ??= new ImprovementAuthoring(this.item);
		}

		get editing() {
			return this._editing ??= new ImprovementEditing();
		}

		/** Every moment the catalog's improvements use, as the author sees them — what a typed moment matches. */
		get knownMoments() { return this._knownMoments ?? []; }

		async _prepareContext(options) {
			const context = await super._prepareContext(options);
			const sys = this.item.system;
			context.item          = this.item;
			context.system        = sys;
			context.editable      = this.isEditable;
			context.sheetIdPrefix = this.id;
			// Tells the board's card it is drawn here, where there is no steading to revoke it from.
			context.isCatalog     = true;

			// The catalog knows no steading: nothing is ticked, nothing applied, nothing applicable.
			const improvement = new SteadingImprovement(sys.slug, this.item.name, sys.choices ?? null,
				{ requires: sys.requires ?? null, effects: sys.effects ?? [] });
			const group = buildChoiceGroup(sys.choices ?? { slug: sys.slug, list: [] });
			context.card = ImprovementProgress.from(improvement, group, {}, ImprovementPayoff.forCatalog(improvement), null);

			this._knownMoments = await this._loadKnownMoments(sys.slug);
			context.editor    = ImprovementEditorView.from(this.authoring, {
				editing: this.editing, moments: this._knownMoments, prefix: this.id,
				label: k => game.i18n.localize(k),
			});
			context.nameField = rich(this.item.name);
			// The moves its results grant, drawn as the steading draws them — the same lookup.
			const moveSlugs = improvement.effects.all().map(e => e.grantsMove).filter(Boolean);
			context.stonetop = { grantedMoves: await new GrantedMoves(null, new FoundryMoveRepository()).bySlug(moveSlugs) };
			await enrichRichTextTree({ card: context.card, editor: context.editor, stonetop: context.stonetop, name: context.nameField },
				this.item?.getRollData?.() ?? {});

			// On the board a card starts shut; here it is what you came to see.
			if (!this._openedCard) {
				this._openedCard = true;
				this.openDisclosures.open(improvementBodyId(this.id, context.card.slug));
			}
			return context;
		}

		/** Every moment the catalog's improvements use — another improvement's marked shared. */
		async _loadKnownMoments(ownSlug) {
			const catalog  = await new FoundrySteadingImprovementRepository().getAll();
			const triggers = imps => imps.flatMap(imp => imp.effects.all().map(e => e.trigger));
			const others   = Moments.fromTriggers(triggers(catalog.filter(imp => imp.slug !== ownSlug)));
			return Moments.fromTriggers(triggers(catalog)).all().map(moment => new KnownMoment({
				key: moment.key, name: moment.name, seasons: moment.seasons,
				label: moment.labelKey ? game.i18n.localize(moment.labelKey) : moment.name,
				shared: Boolean(others.byKey(moment.key)),
			}));
		}

		async _onFirstRender(context, options) {
			await super._onFirstRender(context, options);
			// The first render has no prior tree, so core never syncs it; everything after is
			// restored by withViewStateV2.
			this.restoreViewState(this.element);
			new ChangeActionRouter(this._changeHandlers(), { when: () => this.isEditable }).attach(this.element);
			this.editing.attach(this.element, () => { this.editing.close(); this.render(); });
		}

		_onRender(context, options) {
			super._onRender(context, options);
			this.editing.applyReveal(this.element);
		}

		_changeHandlers() {
			const a = this.authoring;
			const handlers = {
				improvementName: el => a.rename(el.value),
				lineText:        el => a.setRowText(rowIndex(el), el.value),
				sectionRule:     el => a.setSectionRule(rowIndex(el), el.value, this._countIn(el)),
				sectionCount:    el => a.setSectionRule(rowIndex(el), "some", Number(el.value)),
				resultText:      el => this._changeWords(el),
			};
			for (const action of RESULT_CHOICES) handlers[action] = el => this._changeChoice(action, el);
			return handlers;
		}

		/** A result's choice: the adder's draft, which only redraws; or a saved result, which is written. */
		_changeChoice(action, el) {
			const change = resultChange(action, el, this);
			if (inAdder(el)) {
				this.editing.updateDraft(draft => this.authoring.wording.follow(draft, change(draft)));
				return this.render();
			}
			return this.authoring.changeResult(resultIndex(el), change);
		}

		_changeWords(el) {
			if (inAdder(el)) {
				this.editing.updateDraft(draft => draft.withText(el.value));
				return this.render();
			}
			return this.authoring.setResultText(resultIndex(el), el.value);
		}

		/** The count beside a section's rule, where "some" shows one. */
		_countIn(el) {
			const count = el.closest(".stonetop-improvement-panel")?.querySelector('[data-change-action="sectionCount"]');
			return count ? Number(count.value) : null;
		}

		static #onOpenHeading(_event, target) {
			this.editing.openHeading(key(target));
			return this.render();
		}

		static #onOpenResult(_event, target) {
			this.editing.openResult(key(target));
			return this.render();
		}

		static #onOpenResultAdder(_event, target) {
			if (!this.isEditable) return undefined;
			this.editing.openAdder(target.dataset.half, ImprovementAuthoring.draftFor(target.dataset.half));
			return this.render();
		}

		static #onClosePart() {
			this.editing.close();
			return this.render();
		}

		static async #onAddResultDraft() {
			const draft = this.editing.draft;
			if (!draft) return;
			this.editing.close();
			await this.authoring.addResult(draft);
		}

		static #onUseGeneratedResultWords(_event, target) {
			if (inAdder(target)) {
				const words = this.authoring.wording.result(this.editing.draft);
				if (words !== null) this.editing.updateDraft(draft => draft.withText(words));
				return this.render();
			}
			return this.authoring.useGeneratedResultWords(key(target));
		}
	};
}
