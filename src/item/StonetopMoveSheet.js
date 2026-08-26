import { toSlug } from "../utils/slug.js";
import { bindAll } from "../utils/bindAll.js";
import { setField as setChoicesField, newGroup } from "../utils/choiceGroupEdit.js";
import { ChoiceValues } from "../model/snapshot/character/ChoiceGroup.js";
import { buildChoiceGroup } from "../model/snapshot/character/buildChoiceGroup.js";
import { rich } from "../model/snapshot/RichText.js";
import { enrichRichTextTree } from "../utils/enrichRichText.js";
import { GrantRegistry } from "./GrantRegistry.js";

// The move sheet's display fields as RichText (un-enriched). getData runs the one enrich pass over
// these; the template renders them with {{rich}}. Pure so it's unit-testable without the sheet.
export function moveSheetRichText(system) {
	const r = system?.moveResults ?? {};
	return {
		description: rich(system?.description ?? ""),
		success:     rich(r.success?.value ?? ""),
		partial:     rich(r.partial?.value ?? ""),
		failure:     rich(r.failure?.value ?? ""),
	};
}

// Every key `resolveBonus` can answer, so a stored value always has an option to sit on. A key
// missing here doesn't just display wrong — the select falls back to its first option and the next
// submit writes that over the move's real roll (this is how Requisition/Dark Succor lost theirs).
// The steading ratings are rolled by moves a CHARACTER makes (Requisition's +Fortunes), resolved
// through the character's home steading.
export const ROLL_STAT_CHOICES = {
	"":         "stonetop.item.move.rollStat.none",
	str:        "stonetop.character.stats.abbr.str",
	dex:        "stonetop.character.stats.abbr.dex",
	con:        "stonetop.character.stats.abbr.con",
	int:        "stonetop.character.stats.abbr.int",
	wis:        "stonetop.character.stats.abbr.wis",
	cha:        "stonetop.character.stats.abbr.cha",
	fortunes:   "stonetop.item.move.rollStat.fortunes",
	prosperity: "stonetop.item.move.rollStat.prosperity",
	population: "stonetop.item.move.rollStat.population",
	defenses:   "stonetop.item.move.rollStat.defenses",
	// A container's own track: the Thrall insert's Favor, the Destined background's Omens. Listing
	// them here is a stopgap: each key belongs to its container, not to every move in the system, and
	// the list can't grow a line per insert or background. Better would be building the choices from
	// the same sources resolveBonus consults.
	favor:      "stonetop.item.move.rollStat.favor",
	omens:      "stonetop.item.move.rollStat.omens",
	ask:        "stonetop.item.move.rollStat.ask",
	prompt:     "stonetop.item.move.rollStat.prompt",
};

// moveType is the resolution key for reference moves seeded by type (no container owns them).
// Container-owned moves (playbook/insert/arcana) are referenced by slug and leave this null.
const MOVE_TYPE_CHOICES = {
	"":           "stonetop.item.move.moveType.none",
	basic:        "stonetop.item.move.moveType.basic",
	expedition:   "stonetop.item.move.moveType.expedition",
	homefront:    "stonetop.item.move.moveType.homefront",
	seasons:      "stonetop.item.move.moveType.seasons",
	special:      "stonetop.item.move.moveType.special",
	follower:     "stonetop.item.move.moveType.follower",
	other:        "stonetop.item.move.moveType.other",
};

const DEFAULT_ROWS = {
	entry: { type: "entry", slug: "", content: { title: null, text: null }, note: null, track: null, input: null, followers: null, outfitItems: [] },
	pick:  { type: "pick",  pickCount: 1, inline: false, options: [] },
};

const BLANK_OUTFIT_ITEM = { slug: "", name: "", weight: 0, inventoryColumn: "regular" };
const BLANK_PICK_OPTION  = { slug: "", content: { title: null, text: null }, followers: null, outfitItems: [], note: null, type: null };

function _blankOption(n) {
	return { ...BLANK_PICK_OPTION, slug: "option-" + n, content: { title: "Option " + n, text: null }, outfitItems: [], followers: null };
}

export function createStonetopMoveSheetClass(Base) {
	return class StonetopMoveSheet extends Base {
		static DEFAULT_OPTIONS = {
			classes: ["move"],
			position: { width: 640, height: 620 },
		};

		static PARTS = {
			form: {
				template: "systems/stonetop/templates/item/move.hbs",
				scrollable: [""],
			},
		};

		async _prepareContext(options) {
			const context = await super._prepareContext(options);
			context.item     = this.item;
			context.editable = this.isEditable;
			// Stamp a stable slug once so references to this move survive a later rename. Set from the
			// name if possible, else a random id; never recomputed afterward.
			if (!this.item.system.slug) {
				await this.item.update({ "system.slug": toSlug(this.item.name) || `move-${foundry.utils.randomID(8)}` });
			}
			context.system          = this.item.system;
			context.rollStatChoices = ROLL_STAT_CHOICES;
			context.moveTypeChoices = MOVE_TYPE_CHOICES;
			context.isRollable       = !!this.item.system.rollStat;
			context.showResults      = context.isRollable;
			context.rich             = moveSheetRichText(this.item.system);
			await enrichRichTextTree(context.rich, this.item?.getRollData?.() ?? {});
			if (context.system.choices) {
				context.choiceSnapshot = buildChoiceGroup(context.system.choices, new ChoiceValues());
				// A move's choice group may grant moves/followers inline; resolve them so the view-mode
				// choice-row renders them (see GrantRegistry / the character's stonetop.*.bySlug).
				context.stonetop = await GrantRegistry.fromChoiceGroups([context.choiceSnapshot]);
				await enrichRichTextTree(context.stonetop, this.item?.getRollData?.() ?? {});
				context.choiceRows = context.system.choices.list.map((row, ri) => ({
					...row,
					_index: ri,
					_target: "row",
					_rowIndex: ri,
					_hasOptionIndex: false,
					_optionIndex: null,
					options: row.options?.map((opt, oi) => ({
						...opt,
						_index: oi,
						_rowIndex: ri,
						_target: "option",
						_hasOptionIndex: true,
						_optionIndex: oi,
					})),
				}));
			}
			return context;
		}

		// Direct bindings to the current editor controls — re-run per render (part content is replaced).
		_onRender(context, options) {
			super._onRender(context, options);
			if (!this.isEditable) return;
			const root = this.element;

			bindAll(root, ".choices-add-group", "click", () => this._addChoicesGroup());
			bindAll(root, ".choices-remove-group", "click", () => this._removeChoicesGroup());
			bindAll(root, ".choices-add-row", "click", ev => this._addChoicesRow(ev.currentTarget.dataset.type));
			bindAll(root, ".choices-row-delete", "click", ev => this._removeChoicesRow(Number(ev.currentTarget.dataset.rowIndex)));
			bindAll(root, ".choices-row-up", "click", ev => this._moveChoicesRow(Number(ev.currentTarget.dataset.rowIndex), -1));
			bindAll(root, ".choices-row-down", "click", ev => this._moveChoicesRow(Number(ev.currentTarget.dataset.rowIndex), 1));
			bindAll(root, ".choices-row-toggle-track", "click", ev => this._toggleHeadingTrack(Number(ev.currentTarget.dataset.rowIndex)));
			bindAll(root, ".choices-row-toggle-input", "click", ev => this._toggleHeadingInput(Number(ev.currentTarget.dataset.rowIndex)));
			bindAll(root, ".choices-add-option", "click", ev => this._addPickOption(Number(ev.currentTarget.dataset.rowIndex)));
			bindAll(root, ".choices-option-delete", "click", ev => this._removePickOption(Number(ev.currentTarget.dataset.rowIndex), Number(ev.currentTarget.dataset.optionIndex)));
			bindAll(root, ".choices-add-outfit-item", "click", ev => {
				const ri = Number(ev.currentTarget.dataset.rowIndex);
				const oi = ev.currentTarget.dataset.optionIndex != null ? Number(ev.currentTarget.dataset.optionIndex) : null;
				this._addOutfitItem(ri, oi);
			});
			bindAll(root, ".choices-outfit-item-delete", "click", ev => {
				const ri  = Number(ev.currentTarget.dataset.rowIndex);
				const ofi = Number(ev.currentTarget.dataset.outfitItemIndex);
				const oi  = ev.currentTarget.dataset.optionIndex != null ? Number(ev.currentTarget.dataset.optionIndex) : null;
				this._removeOutfitItem(ri, ofi, oi);
			});
			bindAll(root, "[data-choices-field]", "change", ev => this._onChoicesFieldChange(ev));
		}

		// ── Choices helpers ───────────────────────────────────────────────

		_choicesClone() {
			return foundry.utils.deepClone(this.item.system.choices);
		}

		async _saveChoices(choices) {
			await this.item.update({ "system.choices": choices });
		}

		async _addChoicesGroup() {
			await this._saveChoices(newGroup(this.item.system.slug));
		}

		async _removeChoicesGroup() {
			await this._saveChoices(null);
		}

		async _addChoicesRow(type) {
			const choices = this._choicesClone();
			const row = foundry.utils.deepClone(DEFAULT_ROWS[type]);
			if (!row) return;
			if (type === "entry") row.slug = "entry-" + choices.list.length;
			if (type === "pick") row.options.push(_blankOption(1));
			choices.list.push(row);
			await this._saveChoices(choices);
		}

		async _removeChoicesRow(index) {
			const choices = this._choicesClone();
			choices.list.splice(index, 1);
			await this._saveChoices(choices);
		}

		async _moveChoicesRow(index, delta) {
			const choices = this._choicesClone();
			const other = index + delta;
			if (other < 0 || other >= choices.list.length) return;
			[choices.list[index], choices.list[other]] = [choices.list[other], choices.list[index]];
			await this._saveChoices(choices);
		}

		async _toggleHeadingTrack(rowIndex) {
			const choices = this._choicesClone();
			const row = choices.list[rowIndex];
			row.track = row.track ? null : { max: 1 };
			await this._saveChoices(choices);
		}

		async _toggleHeadingInput(rowIndex) {
			const choices = this._choicesClone();
			const row = choices.list[rowIndex];
			row.input = row.input ? null : { placeholder: null };
			await this._saveChoices(choices);
		}

		async _addPickOption(rowIndex) {
			const choices = this._choicesClone();
			const options = choices.list[rowIndex].options;
			options.push(_blankOption(options.length + 1));
			await this._saveChoices(choices);
		}

		async _removePickOption(rowIndex, optionIndex) {
			const choices = this._choicesClone();
			choices.list[rowIndex].options.splice(optionIndex, 1);
			await this._saveChoices(choices);
		}

		async _addOutfitItem(rowIndex, optionIndex = null) {
			const choices = this._choicesClone();
			const obj = optionIndex != null ? choices.list[rowIndex].options[optionIndex] : choices.list[rowIndex];
			obj.outfitItems = [...(obj.outfitItems ?? []), { ...BLANK_OUTFIT_ITEM }];
			await this._saveChoices(choices);
		}

		async _removeOutfitItem(rowIndex, outfitItemIndex, optionIndex = null) {
			const choices = this._choicesClone();
			const obj = optionIndex != null ? choices.list[rowIndex].options[optionIndex] : choices.list[rowIndex];
			obj.outfitItems.splice(outfitItemIndex, 1);
			await this._saveChoices(choices);
		}

		async _onChoicesFieldChange(event) {
			const el       = event.currentTarget;
			const target   = el.dataset.choicesTarget;
			const field    = el.dataset.choicesField;
			const rowIndex = el.dataset.choicesRowIndex !== undefined ? Number(el.dataset.choicesRowIndex) : null;
			const optIndex = el.dataset.choicesOptionIndex !== undefined ? Number(el.dataset.choicesOptionIndex) : null;

			let value;
			if      (el.type === "checkbox") value = el.checked;
			else if (el.type === "number")   value = el.value ? Number(el.value) : null;
			else if (field === "followers.slugs") value = el.value ? el.value.split(",").map(s => s.trim()).filter(Boolean) : [];
			else                             value = el.value || null;

			// Shared setField handles the followers-object seeding/collapse (see choiceGroupEdit).
			await this._saveChoices(setChoicesField(this._choicesClone(), {
				target, rowIndex, optionIndex: optIndex, field, value,
			}));
		}
	};
}
