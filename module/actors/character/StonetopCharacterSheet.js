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

			if (!this.isEditable) return;

			html.find("[name=stonetop-background]").on("change", this._onBackgroundChange.bind(this));
			html.find(".stonetop-playbook-instinct").on("change", ev => {
				const radio = ev.currentTarget;
				const { choiceSlug, siblingSlugsCsv, displayLabel } = radio.dataset;
				html.find(".stonetop-instinct-custom").val(displayLabel ?? "");
				this._stonetopCharacter.instinct.selectOption(choiceSlug, siblingSlugsCsv);
			});
			html.find(".stonetop-instinct-custom").on("change", ev =>
				this._stonetopCharacter.instinct.selectCustom(ev.currentTarget.value.trim())
			);
			html.find(".stonetop-appearance-radio").on("change", this._onAppearanceChange.bind(this));
			html.find("[name=stonetop-origin]").on("change", ev =>
				this._stonetopCharacter.origin.select(ev.currentTarget.value)
			);
			html.find(".stonetop-origin-name").on("click", this._onOriginNameClick.bind(this));
			html.find(".stonetop-move-check, .stonetop-repeat-check").on("change", this._onMoveCheck.bind(this));
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
				const { moveName } = ev.currentTarget.dataset;
				await this._stonetopCharacter.deleteMove(moveName);
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
				const arcanumSlug = ev.target.closest("[data-slug]").dataset.slug;
				const { optionSlug, idx } = cb.dataset;
				const newCount = cb.checked ? Number(idx) + 1 : Number(idx);
				this._stonetopCharacter.setArcanumUnlockCount(arcanumSlug, optionSlug, newCount);
			}, true);

			html[0].addEventListener("change", ev => {
				const cb = ev.target.closest(".stonetop-option-check");
				if (!cb || ev.target.closest("[data-pdi='lore']")) return;
				const { optionSlug, idx } = cb.dataset;
				const entrySlug = ev.target.closest("[data-slug]").dataset.slug;
				const newCount = cb.checked ? Number(idx) + 1 : Number(idx);
				this._stonetopCharacter.setLoreOptionCount(entrySlug, optionSlug, newCount);
			}, true);

			html[0].addEventListener("change", ev => {
				const ta = ev.target.closest(".stonetop-option-text");
				if (!ta || ev.target.closest("[data-pdi='lore']")) return;
				const { optionSlug } = ta.dataset;
				const entrySlug = ev.target.closest("[data-slug]").dataset.slug;
				this._stonetopCharacter.setLoreOptionText(entrySlug, optionSlug, ta.value);
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
				const { choiceSlug, siblingSlugsCsv } = radio.dataset;
				this._stonetopCharacter.setPostDeathInstinct(choiceSlug, siblingSlugsCsv);
			}, true);

			html[0].addEventListener("change", ev => {
				if (!ev.target.closest("[data-pdi='lore']")) return;
				const cb = ev.target.closest(".stonetop-option-check");
				if (!cb) return;
				const { optionSlug, idx } = cb.dataset;
				const entrySlug = ev.target.closest("[data-slug]").dataset.slug;
				const newCount = cb.checked ? Number(idx) + 1 : Number(idx);
				this._stonetopCharacter.setPostDeathLoreCount(entrySlug, optionSlug, newCount);
			}, true);

			html[0].addEventListener("change", ev => {
				if (!ev.target.closest("[data-pdi='lore']")) return;
				const ta = ev.target.closest(".stonetop-option-text");
				if (!ta) return;
				const { optionSlug } = ta.dataset;
				const entrySlug = ev.target.closest("[data-slug]").dataset.slug;
				this._stonetopCharacter.setPostDeathLoreText(entrySlug, optionSlug, ta.value);
			}, true);

			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-follower-add");
				if (!btn) return;
				this._stonetopCharacter.addCustomFollower().then(() => this.render(false));
			}, true);

			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-follower-delete");
				if (!btn) return;
				ev.stopPropagation();
				this._stonetopCharacter.removeFollower(btn.dataset.slug).then(() => this.render(false));
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-follower-hp");
				if (!input) return;
				const card = ev.target.closest(".stonetop-follower-card");
				const hpMax = Number(card?.querySelector(".stonetop-follower-hp-max")?.value ?? input.max);
				const hp = Math.max(0, Math.min(Number(input.value), hpMax));
				this._stonetopCharacter.setFollowerHp(input.dataset.slug, hp);
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-follower-hp-max");
				if (!input) return;
				this._stonetopCharacter.setFollowerHpMax(input.dataset.slug, Number(input.value));
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-follower-name-input");
				if (!input) return;
				this._stonetopCharacter.setFollowerName(input.dataset.slug, input.value);
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-follower-note-input");
				if (!input) return;
				this._stonetopCharacter.setFollowerNote(input.dataset.slug, input.value);
			}, true);

			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-follower-loyalty-pip");
				if (!btn) return;
				ev.stopPropagation();
				const { slug, index } = btn.dataset;
				const isChecked = btn.classList.contains("is-checked");
				const newVal = isChecked ? Number(index) : Number(index) + 1;
				this._stonetopCharacter.setFollowerLoyalty(slug, newVal).then(() => this.render(false));
			}, true);

			html[0].addEventListener("change", ev => {
				const radio = ev.target.closest(".stonetop-follower-choice-radio");
				if (!radio) return;
				const card = ev.target.closest(".stonetop-follower-card");
				const { choiceSlug, siblingSlugsCsv } = radio.dataset;
				this._stonetopCharacter.setFollowerChoiceValue(card.dataset.slug, "choices", choiceSlug, siblingSlugsCsv);
			}, true);

			html[0].addEventListener("change", ev => {
				const ta = ev.target.closest(".stonetop-follower-choice-text");
				if (!ta) return;
				const card = ev.target.closest(".stonetop-follower-card");
				this._stonetopCharacter.setFollowerChoiceText(card.dataset.slug, ta.dataset.optionSlug, ta.value);
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-follower-armor");
				if (!input) return;
				this._stonetopCharacter.setFollowerArmor(input.dataset.slug, Number(input.value));
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-follower-damage");
				if (!input) return;
				this._stonetopCharacter.setFollowerDamage(input.dataset.slug, input.value.trim());
			}, true);
		}

		async _onDropItemCreate(itemData) {
			const items = Array.isArray(itemData) ? itemData : [itemData];
			const { anyAdded, others } = await this._stonetopCharacter.onDropItems(items);
			if (others.length) await super._onDropItemCreate(others);
			if (anyAdded) this.render(false);
		}

		async _onBackgroundChange(ev) {
			await this._stonetopCharacter.selectBackground(ev.currentTarget.value);
		}

		async _onAppearanceChange(ev) {
			const el = ev.currentTarget;
			await this._stonetopCharacter.appearance.select(Number(el.dataset.rowKey), el.dataset.choiceSlug);
		}

		async _onOriginNameClick(ev) {
			await this._stonetopCharacter.origin.selectName(ev.currentTarget.textContent.trim());
		}

		async _onMoveCheck(ev) {
			const el = ev.currentTarget;
			const { categoryKey, moveName } = el.dataset;
			if (el.checked) {
				await this._stonetopCharacter.incrementMove(categoryKey, moveName);
			} else {
				await this._stonetopCharacter.decrementMove(categoryKey, moveName);
			}
		}

		async _onMoveResourceChange(ev) {
			const { categoryKey, moveName, index } = ev.currentTarget.dataset;
			const isChecked = ev.currentTarget.classList.contains("is-checked");
			const current = isChecked ? Number(index) : Number(index) + 1;
			await this._stonetopCharacter.setMoveResourceCurrent(categoryKey, moveName, current);
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
								const weight = parseInt(html.find("[name=weight]").val()) || 1;
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

