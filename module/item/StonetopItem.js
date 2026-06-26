import {StonetopPlaybook} from "./StonetopPlaybook.js";
import {rollFormula, rollStat} from "../utils/roll-engine.js";
import {normalizeRollType} from "../utils/roll-types.js";
import {filterStatOptionLines} from "../utils/strings.js";

// Item sub-types that only ever exist as packaged content or embedded documents:
// playbooks ship in the compendium, npcMove/monsterMove are added through the
// follower/monster sheets. None of them has a registered sheet, so hand-creating
// one from the sidebar "Create Item" dialog only produces a broken item — hide
// them from the type picker, leaving just the generic "move" (arcana) creatable.
const NON_CREATABLE_ITEM_TYPES = ["playbook", "npcMove", "monsterMove"];

export function createStonetopItemClass(BaseItem) {
	return class StonetopItem extends BaseItem {

		/**
		 * Restrict the "Create Item" dialog's type menu to the sub-types a user can
		 * actually author. Callers that pass an explicit `types` restriction (e.g.
		 * internal tooling) are left untouched.
		 * @override
		 */
		static async createDialog(data = {}, createOptions = {}, options = {}, renderOptions = {}) {
			if (!options.types) {
				options = {
					...options,
					types: this.TYPES.filter(type => !NON_CREATABLE_ITEM_TYPES.includes(type)),
				};
			}
			return super.createDialog(data, createOptions, options, renderOptions);
		}

		asPlaybook() {
			return new StonetopPlaybook(this);
		}

		/**
		 * Execute this item as a move.
		 * - rollType present  → 2d6+stat via rollStat (stonetop roll card)
		 * - rollFormula only  → evaluate the raw formula and post a plain chat message
		 * - neither (or descriptionOnly) → post description to chat
		 *
		 * @param {object} options
		 * @param {boolean} [options.descriptionOnly]
		 * @param {string}  [options.rollMode]           - "adv" | "dis" | "def" | "normal"
		 * @param {string}  [options.stonetopDebility]
		 * @param {string}  [options.stonetopDebilityTooltip]
		 */
		async roll(options = {}) {
			const actor = this.parent;
			if (!actor) return;

			const rollType    = normalizeRollType(this.system?.rollType);
			const stat        = options.statOverride ?? rollType;
			const rawFormula  = this.system?.rollFormula ?? null;
			const descriptionOnly = options.descriptionOnly ?? (!stat && !rawFormula);

			if (descriptionOnly) {
				return ChatMessage.create({
					content: `<div class="stonetop-chat-move">
						<h3 class="stonetop-chat-move-name">${this.name}</h3>
						<div class="stonetop-chat-move-description">${this.system?.description ?? ""}</div>
					</div>`,
					speaker: ChatMessage.getSpeaker({ actor }),
				});
			}

			// "ask" moves (Defy Danger/Interfere) carry per-stat option lines to filter.
			const isStatChoice = rollType === "ask" && !!options.statOverride;
			// A fixed-stat move rolled with an alternate stat (e.g. Skill at Arms → Clash
			// with DEX) isn't an "ask" move but should still label the chosen stat.
			const usingAltStat = !!options.statOverride && options.statOverride !== rollType;
			const description = this.system?.description ?? "";
			const moveDescription = isStatChoice
				? filterStatOptionLines(description, options.statOverride)
				: description;
			const moveName = (isStatChoice || usingAltStat)
				? `${this.name} with ${options.statOverride.toUpperCase()}`
				: this.name;

			if (stat) return rollStat(stat, actor, {
				...options,
				moveName,
				moveDescription,
				moveResults: this.system?.moveResults ?? null,
				// Moves that explicitly override the standard "+1 XP on a miss" (e.g. Danger
				// Sense, Hard to Kill / Death's Door rolls) set system.noXpOnMiss.
				noXpOnMiss:  this.system?.noXpOnMiss ?? false,
			});

			// Raw formula path — used by npcMove items
			return rollFormula(rawFormula, actor, { label: this.name, description: moveDescription });
		}
	};
}
