// Sheet for the "npc" Actor subtype. A single-card form (no tabs): tags, the
// armor/damage/instinct stat column beside a framed HP box, a special-quality line, and
// pencil-toggled Moves / Description prose blocks. Reads/writes through actor.typedActor
// (StonetopNpc). Ported/adapted from taylor-nightingale/stonetop.
import { activateEditToggles } from "../../utils/edit-toggle.js";

export function createStonetopNpcSheetClass(Base) {
	return class StonetopNpcSheet extends Base {
		constructor(...args) {
			super(...args);
			this._stonetopNpc = this.actor.typedActor;
		}

		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes:   ["stonetop", "sheet", "actor", "npc"],
				width:     340,
				height:    470,
				resizable: true,
			});
		}

		get template() {
			return "systems/stonetop/templates/actor/npc.hbs";
		}

		async getData() {
			const ctx = await super.getData();
			ctx.stonetop = await this._stonetopNpc.buildSnapshot();
			ctx.slug = this.actor.id;
			return ctx;
		}

		activateListeners(html) {
			super.activateListeners(html);
			const root = html[0] ?? html;
			// Pencil ↔ textarea/display toggles for the Moves & Description prose blocks.
			activateEditToggles(root);

			if (!this.isEditable) return;

			html.find("#npc-hp").on("change",  ev => this._stonetopNpc.setHp(ev.currentTarget.value));
			html.find("#npc-max-hp").on("change", ev => this._stonetopNpc.setMaxHp(ev.currentTarget.value));
			html.find("#npc-armor").on("change", ev => this._stonetopNpc.setArmor(ev.currentTarget.value));
			html.find("#npc-damage").on("change", ev => this._stonetopNpc.setDamage(ev.currentTarget.value));
			html.find("#npc-special-qualities").on("change", ev => this._stonetopNpc.setSpecialQuality(ev.currentTarget.value));

			// Tag chips: click a pill to remove it, type + commit (blur/Enter) to add one.
			html.find(".stonetop-tag-chip").on("click", ev => {
				const wrap = ev.currentTarget.closest(".stonetop-tags");
				this._stonetopNpc.toggleSelection(wrap?.dataset.field, ev.currentTarget.dataset.tag);
			});
			html.find(".stonetop-tag-add").on("change", ev => {
				const value = ev.currentTarget.value.trim();
				if (value) this._stonetopNpc.toggleSelection(ev.currentTarget.dataset.field, value);
			});
			html.find(".stonetop-tag-add").on("keydown", ev => {
				if (ev.key === "Enter") { ev.preventDefault(); ev.currentTarget.blur(); }
			});

			// Instinct (single-select free-text input).
			html.find(".stonetop-npc-instinct").on("change", ev => this._stonetopNpc.setInstinct(ev.currentTarget.value.trim()));

			html.find("#npc-moves").on("change", ev => this._stonetopNpc.setMoves(ev.currentTarget.value));
			html.find(".stonetop-npc-description-textarea").on("change", ev => this._stonetopNpc.setDescription(ev.currentTarget.value));
		}
	};
}
