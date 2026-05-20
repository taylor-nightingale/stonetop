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
			context.stonetop = await this._stonetopCharacter.buildSnapshot();
			// reassign stonetop to system
			context.system.attributes.armor.value = context.stonetop.vitals.armor
			context.system.attributes.xp.max = context.stonetop.vitals.xp.max
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

			// Move playbook icon into header alongside playbook dropdown
			const icon = html[0].querySelector(".stonetop-playbook-icon");
			const playbookDiv = html[0].querySelector(".sheet-playbook");
			if (icon && playbookDiv) playbookDiv.insertBefore(icon, playbookDiv.firstChild);

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
			html.find(".stonetop-inventory-item-check").on("change", this._onInventoryItemCheck.bind(this));
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-inventory-resource-btn");
				if (!btn) return;
				this._onInventoryResource({ currentTarget: btn });
			}, true);
			html.find(".stonetop-inv-add-btn").on("click", this._onAddInventoryItem.bind(this));
			html.find(".stonetop-inv-delete").on("click", this._onDeleteCustomInventoryItem.bind(this));
			html.find(".stonetop-outfit-load-radio").on("change", this._onOutfitLoad.bind(this));
			html.find(".stonetop-possession-check").on("change", this._onPossessionCheck.bind(this));
			html.find(".stonetop-possession-sub-check").on("change", this._onPossessionSubCheck.bind(this));
			html.find(".stonetop-possession-sub-radio").on("change", this._onPossessionSubRadio.bind(this));
			html.find(".stonetop-regular-pool-btn").on("change", this._onRegularPool.bind(this));
			html.find(".stonetop-small-pool-btn").on("change", this._onSmallPool.bind(this));
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

			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-arcanum-flip-btn");
				if (!btn) return;
				ev.stopPropagation();
				const { slug, flipped } = btn.dataset;
				if (flipped === "true") {
					this._stonetopCharacter.unflipArcanum(slug).then(() => this.render(false));
				} else {
					this._stonetopCharacter.flipArcanum(slug).then(() => this.render(false));
				}
			}, true);

			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-arcanum-resource-btn");
				if (!btn) return;
				ev.stopPropagation();
				const { slug, index } = btn.dataset;
				const isChecked = btn.classList.contains("is-checked");
				const newVal = isChecked ? Number(index) : Number(index) + 1;
				this._stonetopCharacter.setArcanumResource(slug, newVal).then(() => this.render(false));
			}, true);

			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-arcanum-delete");
				if (!btn) return;
				ev.stopPropagation();
				const { slug } = btn.dataset;
				this._stonetopCharacter.removeArcanum(slug).then(() => this.render(true));
			}, true);

			html[0].addEventListener("change", ev => {
				const cb = ev.target.closest(".stonetop-arcanum-unlock-check");
				if (!cb) return;
				const { arcanumSlug, optionSlug, index } = cb.dataset;
				const newCount = cb.checked ? Number(index) + 1 : Number(index);
				this._stonetopCharacter.setArcanumUnlockCount(arcanumSlug, optionSlug, newCount);
			}, true);

			html[0].addEventListener("change", ev => {
				const cb = ev.target.closest(".stonetop-lore-option-check");
				if (!cb || ev.target.closest("[data-pdi='lore']")) return;
				const { loreSlug, optionSlug, idx } = cb.dataset;
				const newCount = cb.checked ? Number(idx) + 1 : Number(idx);
				this._stonetopCharacter.setLoreOptionCount(loreSlug, optionSlug, newCount);
			}, true);

			html[0].addEventListener("change", ev => {
				const ta = ev.target.closest(".stonetop-lore-option-text");
				if (!ta || ev.target.closest("[data-pdi='lore']")) return;
				const { loreSlug, optionSlug } = ta.dataset;
				this._stonetopCharacter.setLoreOptionText(loreSlug, optionSlug, ta.value);
			}, true);

			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-pdi-activate");
				if (!btn) return;
				ev.stopPropagation();
				this._stonetopCharacter.setPostDeathInsert(btn.dataset.slug).then(() => this.render(false));
			}, true);

			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-pdi-remove");
				if (!btn) return;
				ev.stopPropagation();
				this._stonetopCharacter.setPostDeathInsert(null).then(() => this.render(false));
			}, true);

			html[0].addEventListener("change", ev => {
				const radio = ev.target.closest(".stonetop-pdi-instinct");
				if (!radio) return;
				this._stonetopCharacter.setPostDeathInstinct(radio.value);
			}, true);

			html[0].addEventListener("change", ev => {
				if (!ev.target.closest("[data-pdi='lore']")) return;
				const cb = ev.target.closest(".stonetop-lore-option-check");
				if (!cb) return;
				const { loreSlug, optionSlug, idx } = cb.dataset;
				const newCount = cb.checked ? Number(idx) + 1 : Number(idx);
				this._stonetopCharacter.setPostDeathLoreCount(loreSlug, optionSlug, newCount);
			}, true);

			html[0].addEventListener("change", ev => {
				if (!ev.target.closest("[data-pdi='lore']")) return;
				const ta = ev.target.closest(".stonetop-lore-option-text");
				if (!ta) return;
				const { loreSlug, optionSlug } = ta.dataset;
				this._stonetopCharacter.setPostDeathLoreText(loreSlug, optionSlug, ta.value);
			}, true);
		}

		async _onDropItemCreate(itemData) {
			const items  = Array.isArray(itemData) ? itemData : [itemData];
			const arcana = items.filter(i => i.type === "move" && i.system?.moveType === "arcanum");
			const moves  = items.filter(i => i.type === "move" && i.system?.moveType !== "arcanum");
			const others = items.filter(i => i.type !== "move");
			let anyAdded = false;
			for (const item of arcana) {
				const slug = item.flags?.stonetop?.slug;
				if (slug) {
					await this._stonetopCharacter.addArcanum(slug);
					anyAdded = true;
				}
			}
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

		async _onInventoryItemCheck(ev) {
			await this._stonetopCharacter.setInventoryItemChecked(
				ev.currentTarget.dataset.slug, ev.currentTarget.checked
			);
			this.render(true);
		}

		async _onInventoryResource(ev) {
			const { slug, index } = ev.currentTarget.dataset;
			const isChecked = ev.currentTarget.classList.contains("is-checked");
			const newVal = isChecked ? Number(index) : Number(index) + 1;
			await this._stonetopCharacter.setInventoryResource(slug, newVal);
			this.render(true);
		}

		async _onAddInventoryItem(ev) {
			const column = ev.currentTarget.dataset.column;
			const isRegular = column === "regular";
			const content = isRegular
				? `<div style="display:grid;gap:6px;padding:6px">
					<label>${game.i18n.localize("stonetop.inventory.addItemName")} <input name="name" type="text" style="width:100%"></label>
					<label>${game.i18n.localize("stonetop.inventory.addItemWeight")} <input name="weight" type="number" min="1" value="1" style="width:60px"></label>
				   </div>`
				: `<div style="padding:6px"><label>${game.i18n.localize("stonetop.inventory.addItemName")} <input name="name" type="text" style="width:100%"></label></div>`;
			new Dialog({
				title: isRegular ? game.i18n.localize("stonetop.inventory.addItem") : game.i18n.localize("stonetop.inventory.addSmallItem"),
				content,
				buttons: {
					add: {
						label: game.i18n.localize("stonetop.inventory.addItemConfirm"),
						callback: html => {
							const name = html.find("[name=name]").val().trim();
							if (!name) return;
							if (isRegular) {
								const weight = Math.max(1, parseInt(html.find("[name=weight]").val()) || 1);
								this._stonetopCharacter.addCustomInventoryItem(name, weight)
									.then(() => this.render(false));
							} else {
								this._stonetopCharacter.addCustomSmallItem(name)
									.then(() => this.render(false));
							}
						},
					},
					cancel: { label: game.i18n.localize("Cancel") },
				},
				default: "add",
			}).render(true);
		}

		async _onOutfitLoad(ev) {
			await this._stonetopCharacter.setInventoryLoadLevel(ev.currentTarget.value);
			this.render(false);
		}

		async _onRegularPool(ev) {
			const idx = Number(ev.currentTarget.dataset.index);
			await this._stonetopCharacter.setInventoryRegularPool(
				ev.currentTarget.checked ? idx + 1 : idx
			);
			this.render(false);
		}

		async _onSmallPool(ev) {
			const idx = Number(ev.currentTarget.dataset.index);
			await this._stonetopCharacter.setInventorySmallPool(
				ev.currentTarget.checked ? idx + 1 : idx
			);
			this.render(false);
		}

		async _onDeleteCustomInventoryItem(ev) {
			await this._stonetopCharacter.removeCustomInventoryItem(ev.currentTarget.dataset.ownedId);
		}
	};
}

