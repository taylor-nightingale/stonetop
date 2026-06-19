// Item sheet for authoring custom `insert` items. Full parity with InsertData: rich description,
// an `instinct` choice group, an array of `choices` groups, and a collection of moves (move items
// tagged `system.playbook === <insert slug>`). The choice-group editors reuse the shared
// choiceGroupEdit helpers + choiceGroupEditorMixin + choice-group-editor partial. Foundry's
// ItemSheet auto-saves `name`/`system.*` form fields and auto-activates the `data-edit` rich editor.

import * as CG from "../utils/choiceGroupEdit.js";
import { activateChoiceGroupEditors } from "./choiceGroupEditorMixin.js";
import { FoundryMoveRepository } from "../actors/character/repositories/FoundryMoveRepository.js";

export function createStonetopInsertSheetClass(Base) {
	return class StonetopInsertSheet extends Base {
		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["stonetop", "sheet", "item", "insert"],
				width:  600,
				height: 680,
				resizable: true,
			});
		}

		get template() {
			return "systems/stonetop/templates/item/insert.hbs";
		}

		async getData() {
			const context = await super.getData();
			// Inserts are identified by a stable slug — their moves are tagged with it, so it must
			// survive a rename. Generate a random one once if missing (not name-derived).
			if (!this.item.system.slug) {
				await this.item.update({ "system.slug": `custom-insert-${foundry.utils.randomID(8)}` });
			}
			const slug = this.item.system.slug;
			const sys  = this.item.system;
			context.system = sys;
			// Instinct is stored as a choice group but edited as a plain list of strings.
			context.instinctStrings = CG.instinctOptions(sys.instinct);
			context.choicesGroups = (sys.choices ?? []).map((grp, i) => ({
				index: i, slug: grp?.slug, cgPath: `system.choices.${i}`, rows: CG.buildRows(grp),
			}));
			// Moves come from two sources: world moves CREATED here (tagged to this insert, owned —
			// editable/deletable) and EXISTING moves referenced by slug (compendium or world — not
			// copied, just pointed at). De-dup referenced against owned by slug.
			const index = await new FoundryMoveRepository().buildSlugIndex();
			const owned = (game.items?.contents ?? [])
				.filter(i => i.type === "move" && i.system?.playbook === slug)
				.map(i => ({ id: i.id, name: i.name, source: "owned" }));
			const ownedSlugs = new Set(owned.map(o => index.get(o.name) ? o.name : null).filter(Boolean));
			const referenced = (sys.moves ?? [])
				.filter(s => !ownedSlugs.has(s))
				.map(s => { const m = index.get(s); return { slug: s, name: m?.name ?? s, missing: !m, source: "ref" }; });
			context.insertMoves = [...owned, ...referenced];
			return context;
		}

		activateListeners(html) {
			super.activateListeners(html);
			if (!this.isEditable) return;

			activateChoiceGroupEditors(this, html); // entry/pick row editing for instinct + each choices group

			// Instinct — edited as a plain list of strings (round-tripped through the choice group).
			const setInstinct = strings => this.item.update({ "system.instinct": CG.instinctFromStrings(strings) });
			html.find(".insert-instinct-add-string").on("click", () => {
				const s = CG.instinctOptions(this.item.system.instinct); s.push("");
				setInstinct(s);
			});
			html.find(".insert-instinct-remove-string").on("click", ev => {
				const s = CG.instinctOptions(this.item.system.instinct);
				s.splice(Number(ev.currentTarget.dataset.index), 1);
				setInstinct(s);
			});
			html.find(".insert-instinct-string").on("change", ev => {
				const s = CG.instinctOptions(this.item.system.instinct);
				s[Number(ev.currentTarget.dataset.index)] = ev.currentTarget.value;
				setInstinct(s);
			});

			// Group lifecycle — the choices array.
			html.find(".insert-choices-add-group").on("click", () => {
				const choices = foundry.utils.deepClone(this.item.system.choices ?? []);
				choices.push(CG.newGroup(`choices-${choices.length}`));
				this.item.update({ "system.choices": choices });
			});
			html.find(".insert-choices-remove-group").on("click", ev => {
				const choices = foundry.utils.deepClone(this.item.system.choices ?? []);
				choices.splice(Number(ev.currentTarget.dataset.index), 1);
				this.item.update({ "system.choices": choices });
			});

			// Moves — "owned" ones (created here, tagged) open/delete by id; "ref" ones (referenced
			// by slug) open by slug and delete just removes the reference.
			html.find(".insert-add-move").on("click", () => this._pickOrCreateMove());
			html.find(".insert-move-open").on("click", async ev => {
				const { moveId, moveSlug } = ev.currentTarget.dataset;
				if (moveId) return game.items?.get(moveId)?.sheet?.render(true);
				if (!moveSlug) return;
				const repo = new FoundryMoveRepository();
				const m    = (await repo.buildSlugIndex()).get(moveSlug);
				if (m) (await repo.getInsertMoveDocument(m.id))?.sheet?.render(true);
			});
			html.find(".insert-move-delete").on("click", async ev => {
				const { moveId, moveSlug } = ev.currentTarget.dataset;
				if (moveId) await game.items?.get(moveId)?.delete();        // owned: delete the world move
				else if (moveSlug != null) await this._removeReferencedMove(moveSlug);
				this.render(false);
			});
		}

		// A move belongs to this insert when tagged `system.playbook = <slug>` + moveType "playbook".
		_moveTag() {
			return { moveType: "playbook", playbook: this.item.system.slug };
		}

		async _createNewMove() {
			const move = await Item.create({ name: "New Move", type: "move", system: { ...this._moveTag(), acquired: false } });
			move?.sheet?.render(true);
			this.render(false);
		}

		// Reference an existing move (compendium OR world) by its slug — no copy, no re-tag.
		async _addExistingMove(moveSlug) {
			if (!moveSlug) return;
			const moves = [...(this.item.system.moves ?? [])];
			if (!moves.includes(moveSlug)) moves.push(moveSlug);
			await this.item.update({ "system.moves": moves });
			this.render(false);
		}

		async _removeReferencedMove(moveSlug) {
			const moves = (this.item.system.moves ?? []).filter(s => s !== moveSlug);
			await this.item.update({ "system.moves": moves });
		}

		// Dialog: create a new move, or reference an existing one by slug.
		async _pickOrCreateMove() {
			const repo  = new FoundryMoveRepository();
			const index = await repo.buildSlugIndex();
			const moves = [...index.values()].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
			const options = moves.map(m => `<option value="${m.slug}">${foundry.utils.escapeHTML?.(m.name) ?? m.name}</option>`).join("");
			const content = `<form>
				<p>Add a move to this insert:</p>
				<select name="move" style="width:100%">
					<option value="">— Create new move —</option>
					${options}
				</select>
			</form>`;
			new Dialog({
				title: "Add move",
				content,
				buttons: {
					add: {
						label: "Add",
						callback: html => {
							const moveSlug = html[0].querySelector("select[name=move]")?.value;
							if (moveSlug) this._addExistingMove(moveSlug);
							else          this._createNewMove();
						},
					},
					cancel: { label: "Cancel" },
				},
				default: "add",
			}).render(true);
		}
	};
}
