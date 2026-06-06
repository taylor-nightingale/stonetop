import { toSlug } from "../utils/slug.js";
import { ChoiceGroup, ChoiceValues } from "../model/snapshot/character/ChoiceGroup.js";

const ROLL_STAT_CHOICES = {
	"":       "stonetop.item.move.rollStat.none",
	str:      "stonetop.character.stats.abbr.str",
	dex:      "stonetop.character.stats.abbr.dex",
	con:      "stonetop.character.stats.abbr.con",
	int:      "stonetop.character.stats.abbr.int",
	wis:      "stonetop.character.stats.abbr.wis",
	cha:      "stonetop.character.stats.abbr.cha",
	ask:      "stonetop.item.move.rollStat.ask",
	prompt:   "stonetop.item.move.rollStat.prompt",
};

const MOVE_TYPE_CHOICES = {
	"":           "stonetop.item.move.moveType.none",
	basic:        "stonetop.item.move.moveType.basic",
	playbook:     "stonetop.item.move.moveType.playbook",
	homefront:    "stonetop.item.move.moveType.homefront",
	special:      "stonetop.item.move.moveType.special",
	"post-death": "stonetop.item.move.moveType.postDeath",
	follower:     "stonetop.item.move.moveType.follower",
	other:        "stonetop.item.move.moveType.other",
};

const DEFAULT_ROWS = {
	entry: { type: "entry", slug: "", content: { title: null, text: null }, note: null, track: null, input: null, followers: [], outfitItems: [], inlineDisplay: false },
	pick:  { type: "pick",  pickCount: 1, inline: false, options: [] },
};

const BLANK_OUTFIT_ITEM = { slug: "", name: "", weight: 0, inventoryColumn: "regular" };
const BLANK_PICK_OPTION  = { slug: "", content: { title: null, text: null }, followers: [], outfitItems: [], note: null, type: null, inlineDisplay: false };

function _blankOption(n) {
	return { ...BLANK_PICK_OPTION, slug: "option-" + n, content: { title: "Option " + n, text: null }, outfitItems: [], followers: [] };
}

async function _buildPlaybookChoices() {
	const names = new Set();
	const pack = game.packs.get("stonetop.playbooks");
	if (pack) {
		await pack.getIndex();
		for (const entry of pack.index) names.add(entry.name);
	}
	for (const item of game.items?.contents ?? []) {
		if (item.type === "playbook") names.add(item.name);
	}
	const sorted = [...names].sort((a, b) => a.localeCompare(b));
	return Object.fromEntries([["", "—"], ...sorted.map(n => [n, n])]);
}

export function createStonetopMoveSheetClass(Base) {
	return class StonetopMoveSheet extends Base {
		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["stonetop", "sheet", "item", "move"],
				width:  640,
				height: 620,
				resizable: true,
			});
		}

		get template() {
			return "systems/stonetop/templates/item/move.hbs";
		}

		async getData() {
			const context = await super.getData();
			context.system          = this.item.system;
			context.rollStatChoices = ROLL_STAT_CHOICES;
			context.moveTypeChoices = MOVE_TYPE_CHOICES;
			context.playbookChoices  = await _buildPlaybookChoices();
			context.isPlaybook       = this.item.system.moveType === "playbook";
			context.isRollable       = !!this.item.system.rollStat;
			context.showResults      = context.isRollable;
			if (context.system.choices) {
				context.choiceSnapshot = ChoiceGroup.fromPackData(context.system.choices, new ChoiceValues(), {});
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

		activateListeners(html) {
			super.activateListeners(html);
			if (!this.isEditable) return;

			html.find(".choices-add-group").click(() => this._addChoicesGroup());
			html.find(".choices-remove-group").click(() => this._removeChoicesGroup());
			html.find(".choices-add-row").click(ev => this._addChoicesRow(ev.currentTarget.dataset.type));
			html.find(".choices-row-delete").click(ev => this._removeChoicesRow(Number(ev.currentTarget.dataset.rowIndex)));
			html.find(".choices-row-up").click(ev => this._moveChoicesRow(Number(ev.currentTarget.dataset.rowIndex), -1));
			html.find(".choices-row-down").click(ev => this._moveChoicesRow(Number(ev.currentTarget.dataset.rowIndex), 1));
			html.find(".choices-row-toggle-track").click(ev => this._toggleHeadingTrack(Number(ev.currentTarget.dataset.rowIndex)));
			html.find(".choices-row-toggle-input").click(ev => this._toggleHeadingInput(Number(ev.currentTarget.dataset.rowIndex)));
			html.find(".choices-add-option").click(ev => this._addPickOption(Number(ev.currentTarget.dataset.rowIndex)));
			html.find(".choices-option-delete").click(ev => this._removePickOption(Number(ev.currentTarget.dataset.rowIndex), Number(ev.currentTarget.dataset.optionIndex)));
			html.find(".choices-add-outfit-item").click(ev => {
				const ri = Number(ev.currentTarget.dataset.rowIndex);
				const oi = ev.currentTarget.dataset.optionIndex != null ? Number(ev.currentTarget.dataset.optionIndex) : null;
				this._addOutfitItem(ri, oi);
			});
			html.find(".choices-outfit-item-delete").click(ev => {
				const ri  = Number(ev.currentTarget.dataset.rowIndex);
				const ofi = Number(ev.currentTarget.dataset.outfitItemIndex);
				const oi  = ev.currentTarget.dataset.optionIndex != null ? Number(ev.currentTarget.dataset.optionIndex) : null;
				this._removeOutfitItem(ri, ofi, oi);
			});
			html.find("[data-choices-field]").on("change", ev => this._onChoicesFieldChange(ev));
		}

		// ── Choices helpers ───────────────────────────────────────────────

		_choicesClone() {
			return foundry.utils.deepClone(this.item.system.choices);
		}

		async _saveChoices(choices) {
			await this.item.update({ "system.choices": choices });
		}

		async _addChoicesGroup() {
			await this._saveChoices({ slug: toSlug(this.item.name) || "choices", list: [] });
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
			else if (field === "followers")  value = el.value ? el.value.split(",").map(s => s.trim()).filter(Boolean) : [];
			else                             value = el.value || null;

			const choices = this._choicesClone();
			let obj;
			if      (target === "group")  obj = choices;
			else if (target === "row")    obj = choices.list[rowIndex];
			else if (target === "option") obj = choices.list[rowIndex].options[optIndex];

			foundry.utils.setProperty(obj, field, value);
			await this._saveChoices(choices);
		}
	};
}
