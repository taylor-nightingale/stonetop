import { bindAll } from "../../utils/bindAll.js";
import { ChangeActionRouter } from "../../utils/ChangeActionRouter.js";
import { TAG_CHIP_ACTIONS, tagChipChangeHandlers } from "../tagChips.js";

export function createStonetopNpcSheetClass(Base) {
    return class StonetopNpcSheet extends Base {
        get _stonetopNpc() {
            return this.typedActor;
        }

        static DEFAULT_OPTIONS = {
            classes: ["npc"],
            position: { width: 315, height: 425 },
            actions: {
                ...TAG_CHIP_ACTIONS,
            },
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

        // An NPC's chips address a Selection field directly — it has no followers or members, so
        // the wrap's field is the whole answer.
        toggleTag(wrap, value) {
            return this._stonetopNpc.toggleSelection(wrap.field, value);
        }

        async _onFirstRender(context, options) {
            await super._onFirstRender(context, options);
            new ChangeActionRouter(tagChipChangeHandlers(this), { when: () => this.isEditable })
                .attach(this.element);
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

            // Instinct is a single-select input + dropdown, not chips.
            bindAll(root, ".stonetop-npc-instinct", "change", ev => npc.setInstinct(ev.currentTarget.value.trim()));

            // Moves + description
            bindAll(root, "#npc-moves", "change", ev => npc.setMoves(ev.currentTarget.value));
            bindAll(root, ".stonetop-follower-description-textarea", "change", ev => npc.setDescription(ev.currentTarget.value));
        }

    };
}
