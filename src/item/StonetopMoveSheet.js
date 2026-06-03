import { toSlug } from "../utils/slug.js";

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
	heading:  { type: "heading",  content: { title: null, text: null }, note: null, track: null, input: null },
	pick:     { type: "pick",     pickCount: 1, inline: false, options: [] },
	follower: { type: "follower", slug: "", title: "", track: null, inlineDisplay: false },
};

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

async function _buildFollowerChoices() {
	const entries = new Map();
	const pack = game.packs.get("stonetop.followers");
	if (pack) {
		await pack.getIndex({ fields: ["system.slug"] });
		for (const entry of pack.index) {
			if (entry.system?.slug) entries.set(entry.system.slug, entry.name);
		}
	}
	for (const item of game.items?.contents ?? []) {
		if (item.type === "equipment" && item.system?.equipmentType === "follower" && item.system?.slug) {
			entries.set(item.system.slug, item.name);
		}
	}
	const sorted = [...entries.entries()].sort((a, b) => a[1].localeCompare(b[1]));
	return Object.fromEntries([["", "— Select Follower —"], ...sorted.map(([slug, name]) => [slug, name])]);
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
			context.followerChoices  = await _buildFollowerChoices();
			context.isPlaybook       = this.item.system.moveType === "playbook";
			context.isRollable       = !!this.item.system.rollStat;
			if (context.system.choices) {
				context.choiceRows = context.system.choices.list.map((row, ri) => ({
					...row,
					_index: ri,
					options: row.options?.map((opt, oi) => ({ ...opt, _index: oi, _rowIndex: ri })),
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
			html.find(".choices-row-toggle-follower-track").click(ev => this._toggleFollowerTrack(Number(ev.currentTarget.dataset.rowIndex)));
			html.find(".choices-add-option").click(ev => this._addPickOption(Number(ev.currentTarget.dataset.rowIndex)));
			html.find(".choices-option-delete").click(ev => this._removePickOption(Number(ev.currentTarget.dataset.rowIndex), Number(ev.currentTarget.dataset.optionIndex)));
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
			if (type === "heading") row.slug = "heading-" + choices.list.length;
			if (type === "pick") row.options.push({ slug: "option-1", text: "Option 1", description: null, type: null });
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

		async _toggleFollowerTrack(rowIndex) {
			const choices = this._choicesClone();
			const row = choices.list[rowIndex];
			row.track = row.track ? null : { max: 1 };
			await this._saveChoices(choices);
		}

		async _addPickOption(rowIndex) {
			const choices = this._choicesClone();
			const options = choices.list[rowIndex].options;
			const n = options.length + 1;
			options.push({ slug: "option-" + n, text: "Option " + n, description: null, type: null });
			await this._saveChoices(choices);
		}

		async _removePickOption(rowIndex, optionIndex) {
			const choices = this._choicesClone();
			choices.list[rowIndex].options.splice(optionIndex, 1);
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
