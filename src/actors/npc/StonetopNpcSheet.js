export function createStonetopNpcSheetClass(Base) {
    return class StonetopNpcSheet extends Base {

        constructor(...args) {
            super(...args);
            this._stonetopNpc = this.actor.typedActor;
        }

        static get defaultOptions() {
            return foundry.utils.mergeObject(super.defaultOptions, {
                classes: ["stonetop", "sheet", "actor", "npc"],
                tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
                dragDrop: [{ dragSelector: ".items-list .item" }],
				width: 315,
				height: 425,
            });
        }

        async getData() {
			const ctx = await super.getData();
			ctx.stonetop = await this._stonetopNpc.buildSnapshot();
			return ctx;
		}

        activateListeners(html) {
			super.activateListeners(html);
			if (!this.isEditable) return;

			// HP
			html.find("#npc-hp").on("change", async ev => {
				await this._stonetopNpc.setHp(ev.currentTarget.value);
			});

			// HP
			html.find("#npc-max-hp").on("change", async ev => {
				await this._stonetopNpc.setMaxHp(ev.currentTarget.value);
			});

            // Armor
			html.find("#npc-armor").on("change", async ev => {
				await this._stonetopNpc.setArmor(ev.currentTarget.value);
			});

            // Damage
			html.find("#npc-damage").on("change", async ev => {
				await this._stonetopNpc.setDamage(ev.currentTarget.value);
			});

            // Special Quality
			html.find("#npc-special-qualities").on("change", async ev => {
				await this._stonetopNpc.setSpecialQuality(ev.currentTarget.value);
			});

            // Instinct
			html.find("#npc-instinct").on("change", async ev => {
				await this._stonetopNpc.setInstinct(ev.currentTarget.value);
			});

			// Tags
			html.find("#npc-tags").on("change", async ev => {
				await this._stonetopNpc.setTags(ev.currentTarget.value);
			});

			// Moves
			html.find("#npc-moves").on("change", async ev => {
				await this._stonetopNpc.setMoves(ev.currentTarget.value);
			});

			 // Description
			html.find(".stonetop-follower-description-textarea").on("change", async ev => {
				await this._stonetopNpc.setDescription(ev.currentTarget.value);
			});

		}

        get template() {
            return "systems/stonetop/templates/actor/npc.hbs";
        }

    };
}