import { enrichRichTextTree } from "../../utils/enrichRichText.js";
import { bindAll } from "../../utils/bindAll.js";
import { takeTagInputValue } from "../../utils/takeTagInputValue.js";

export function createStonetopNpcSheetClass(Base) {
    return class StonetopNpcSheet extends Base {

        constructor(...args) {
            super(...args);
            this._stonetopNpc = this.actor.typedActor;
        }

        static DEFAULT_OPTIONS = {
            classes: ["npc"],
            position: { width: 315, height: 425 },
        };

        static PARTS = {
            form: {
                // No `scrollable`: the card's border frame is an inset:0 ::before, so the card
                // itself must not scroll — .window-content is the scroll container instead, and
                // it persists across V2 re-renders, so its scrollTop survives without part-level
                // restore.
                template: "systems/stonetop/templates/actor/npc.hbs",
            },
        };

        async _prepareContext(options) {
            const context = await super._prepareContext(options);
            context.actor = this.actor;
            context.editable = this.isEditable;
            context.stonetop = await this._stonetopNpc.buildSnapshot();
            await enrichRichTextTree(context.stonetop, this.actor?.getRollData?.() ?? {});
            return context;
        }

        // Direct bindings to the card's controls — re-run per render (part content is replaced).
        // Root-delegated behavior (edit toggles, steppers, comboboxes, rollables) lives in the base.
        _onRender(context, options) {
            super._onRender(context, options);
            if (!this.isEditable) return;
            const root = this.element;
            const npc  = this._stonetopNpc;

            // Creature core
            bindAll(root, "#npc-hp", "change", ev => npc.setHp(ev.currentTarget.value));
            bindAll(root, "#npc-max-hp", "change", ev => npc.setMaxHp(ev.currentTarget.value));
            bindAll(root, "#npc-armor", "change", ev => npc.setArmor(ev.currentTarget.value));
            bindAll(root, "#npc-damage", "change", ev => npc.setDamage(ev.currentTarget.value));
            bindAll(root, "#npc-special-qualities", "change", ev => npc.setSpecialQuality(ev.currentTarget.value));

            // Selection chips (tags) — toggle on click, add via free-text box.
            bindAll(root, ".stonetop-tag-chip", "click", ev => {
                const wrap = ev.currentTarget.closest(".stonetop-tags");
                return npc.toggleSelection(wrap?.dataset.field, ev.currentTarget.dataset.tag);
            });
            bindAll(root, ".stonetop-tag-add", "change", ev => {
                const input = ev.currentTarget;
                const value = takeTagInputValue(input);
                if (!value) return;
                return npc.toggleSelection(input.dataset.field, value);
            });
            // Instinct (single-select input + dropdown, not chips)
            bindAll(root, ".stonetop-npc-instinct", "change", ev => npc.setInstinct(ev.currentTarget.value.trim()));

            // Moves + description
            bindAll(root, "#npc-moves", "change", ev => npc.setMoves(ev.currentTarget.value));
            bindAll(root, ".stonetop-follower-description-textarea", "change", ev => npc.setDescription(ev.currentTarget.value));
        }

    };
}
