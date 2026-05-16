import {MoveResourceButton} from "./elements/move-resource-button.js";
import {BackgroundInputChoice} from "./elements/background-input-choice.js";
import {PossessionUseButton} from "./elements/possession-use-button.js";

export function createStonetopCharacterSheetClass(Base) {
	return class StonetopCharacterSheet extends Base {
		_stonetopCharacter;

		constructor(...args) {
			super(...args);
			this._stonetopCharacter = this.actor.typedActor;
		}

		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["pbta", "stonetop", "sheet", "actor", "character"],
				tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "moves" }],
				dragDrop: [{ dragSelector: ".items-list .item" }],
			});
		}

		get template() {
			return "modules/stonetop/templates/actor/character.hbs";
		}

		async getData() {
			const context = await super.getData();
			context.stonetop = await this._stonetopCharacter.buildSheetData();
			return context;
		}

		activateListeners(html) {
			super.activateListeners(html);
			html[0].addEventListener("dragover", (ev) => ev.preventDefault());
			html[0].addEventListener("drop", (ev) => {
				ev.stopImmediatePropagation();
				const data = TextEditor.getDragEventData(ev);
				if (data?.type === "Item") this._onDropItem(ev, data);
			}, true);
			html.find(".cell--stats .stat-value").each((_, el) => {
				el.value = el.value.replace(/^\+/, "");
			});
			html.find(".cell--stats .stat[data-stat]").each((_, el) => {
				$(el).append(`<span class="stonetop-stat-abbr">(${el.dataset.stat.toUpperCase()})</span>`);
			});

			if (!this.isEditable) return;

			html.find("[name=stonetop-background]").on("change", this._onBackgroundChange.bind(this));
			html.find("[name=stonetop-instinct]").on("change", ev => {
				const val = ev.currentTarget.value;
				html.find(".stonetop-instinct-custom").val(val);
				this._stonetopCharacter.instinct.select(val);
			});
			html.find(".stonetop-instinct-custom").on("change", ev =>
				this._stonetopCharacter.instinct.select(ev.currentTarget.value.trim())
			);
			html.find(".stonetop-appearance-radio").on("change", this._onAppearanceChange.bind(this));
			html.find("[name=stonetop-origin]").on("change", ev =>
				this._stonetopCharacter.origin.select(ev.currentTarget.value)
			);
			html.find(".stonetop-origin-name").on("click", this._onOriginNameClick.bind(this));
			html.find(".stonetop-move-check").on("change", this._onMoveCheck.bind(this));
			html.find(".stonetop-repeat-check").on("change", this._onRepeatCheck.bind(this));
			html.find(".stonetop-bg-choice").on("change", this._onBgChoiceChange.bind(this));
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-item-resource-check");
				if (!btn) return;
				ev.stopPropagation();
				ev.stopImmediatePropagation();
				if (btn.dataset.moveName !== undefined) {
					this._onMoveResourceChange({ currentTarget: btn });
				} else {
					this._onPossessionUseChange({ currentTarget: btn });
				}
			}, true);
			html.find(".stonetop-possession-check").on("change", this._onPossessionCheck.bind(this));
			html.find(".stonetop-possession-sub-check").on("change", this._onPossessionSubCheck.bind(this));
			html.find(".stonetop-possession-sub-radio").on("change", this._onPossessionSubRadio.bind(this));
			html.find(".stonetop-basic-move-open").on("click", async ev => {
				const { compendiumId } = ev.currentTarget.dataset;
				const pack = game.packs.get("stonetop.basic-moves");
				if (!pack || !compendiumId) return;
				const doc = await pack.getDocument(compendiumId);
				if (doc) doc.sheet.render(true);
			});
			html.find(".stonetop-other-move-delete").on("click", async ev => {
				const { itemId } = ev.currentTarget.dataset;
				await this._stonetopCharacter.removeMove(itemId);
			});
		}

		async _onDropItemCreate(itemData) {
			const items = Array.isArray(itemData) ? itemData : [itemData];
			const moves = items.filter(i => i.type === "move");
			const others = items.filter(i => i.type !== "move");
			let anyAdded = false;
			for (const item of moves) {
				if (await this._stonetopCharacter.onDropMove(item)) anyAdded = true;
			}
			if (others.length) await super._onDropItemCreate(others);
			if (anyAdded) this.render(false);
		}

		async _onBackgroundChange(ev) {
			const slug = ev.currentTarget.value;
			await this._stonetopCharacter.background.selectBackground(slug);
			await this._stonetopCharacter.ensureStartingMoves();
		}

		async _onAppearanceChange(ev) {
			const el = ev.currentTarget;
			await this._stonetopCharacter.appearance.select(Number(el.dataset.line), el.value);
		}

		async _onOriginNameClick(ev) {
			const name = ev.currentTarget.textContent.trim();
			await this._stonetopCharacter.updateName(name);
		}

		async _onMoveCheck(ev) {
			const el = ev.currentTarget;
			if (el.checked) {
				await this._stonetopCharacter.addMove(el.dataset.compendiumId);
			} else {
				await this._stonetopCharacter.removeMove(el.dataset.ownedId);
			}
		}

		async _onRepeatCheck(ev) {
			const el = ev.currentTarget;
			if (el.checked) {
				await this._stonetopCharacter.addMove(el.dataset.compendiumId);
			} else {
				await this._stonetopCharacter.removeMove(el.dataset.ownedId);
			}
		}

		async _onMoveResourceChange(ev) {
			const button = new MoveResourceButton(ev);
			await this._stonetopCharacter.moveResources.add(button);
		}

		async _onBgChoiceChange(ev) {
			const choice = new BackgroundInputChoice(ev);
			await this._stonetopCharacter.background.addChoice(choice);
		}

		async _onPossessionCheck(ev) {
			const { slug } = ev.currentTarget.dataset;
			if (ev.currentTarget.checked) {
				await this._stonetopCharacter.selectPossession(slug);
			} else {
				await this._stonetopCharacter.deselectPossession(slug);
			}
		}

		async _onPossessionUseChange(ev) {
			const btn = new PossessionUseButton(ev);
			const newVal = btn.isChecked() ? btn.index : btn.index + 1;
			if (btn.choiceSlug) {
				await this._stonetopCharacter.setSubChoiceUses(btn.possessionSlug, btn.choiceSlug, newVal);
			} else {
				await this._stonetopCharacter.setPossessionUses(btn.possessionSlug, newVal);
			}
		}

		async _onPossessionSubCheck(ev) {
			const { possessionSlug, choiceSlug } = ev.currentTarget.dataset;
			if (ev.currentTarget.checked) {
				await this._stonetopCharacter.selectSubChoice(possessionSlug, choiceSlug);
			} else {
				await this._stonetopCharacter.deselectSubChoice(possessionSlug, choiceSlug);
			}
		}

		async _onPossessionSubRadio(ev) {
			const { possessionSlug, choiceSlug, siblingSlugsCsv } = ev.currentTarget.dataset;
			const exclusiveSlugs = siblingSlugsCsv ? siblingSlugsCsv.split(",") : [];
			await this._stonetopCharacter.selectSubChoiceExclusive(possessionSlug, choiceSlug, exclusiveSlugs);
		}
	};
}
