import {StonetopCharacter} from "./character/StonetopCharacter.js";
import {StonetopSteading} from "./steading/StonetopSteading.js";
import {StonetopNpc} from "./npc/StonetopNpc.js";
import {CharacterLedger} from "./character/CharacterLedger.js";
import {SteadingLedger} from "./steading/SteadingLedger.js";
import {STAT_CHAT_LABELS, STEADING_STAT_CHAT_LABELS, postStatChangesToChat} from "../utils/chat.js";

export function createStonetopActorClass(BaseActor) {
	return class StonetopActor extends BaseActor {
		_typedActor;

		get typedActor() {
			if (this._typedActor) return this._typedActor;

			const customType = this.system?.customType;
			switch (customType || this.type) {
				case "character":
					this._typedActor = StonetopCharacter.create(this);
					break;
				case "stonetop":
					this._typedActor = new StonetopSteading(this);
					break;
				case "npc":
					this._typedActor = StonetopNpc.create(this);
					break;
			}

			return this._typedActor;
		}

		/**
		 * Give freshly-created actors a sensible default name from their type label when the
		 * create flow didn't supply one. Foundry's "Create Actor" dialog always provides a name,
		 * but programmatic / drag creates may not. Additive — never overrides a supplied name.
		 */
		async _preCreate(data, options, user) {
			const allowed = await super._preCreate(data, options, user);
			if (allowed === false) return false;
			if (data.name === undefined || data.name === null || data.name === "") {
				const label = game.i18n.localize(`TYPES.Actor.${this.type}`);
				this.updateSource({ name: game.i18n.format("DOCUMENT.New", { type: label || "Actor" }) });
			}
		}

		// Backward-compat: world actors created with the PBTA module used
		// type="other" with system.customType="stonetop" for the steading.
		// The sheet registry looks up by type, so intercept _getSheetClass
		// to return the steading sheet for these legacy actors.
		_getSheetClass() {
			if (this.system?.customType === "stonetop") {
				const cls = CONFIG.Actor.sheetClasses?.stonetop?.["stonetop.StonetopSteadingSheet"]?.cls;
				if (cls) return cls;
			}
			return super._getSheetClass();
		}

		async _preUpdate(changed, options, user) {
			const result = await super._preUpdate(changed, options, user);
			if (!options?.stonetopLedger) {
				if (this.type === "character") {
					options.stonetopLedgerEntries = this._tagLedgerMove(await CharacterLedger.entriesForActorUpdate(this, changed), options);
					options.stonetopStatChanges = this._collectStatChanges(changed, STAT_CHAT_LABELS);
				} else if (this.type === "stonetop" || this.system?.customType === "stonetop") {
					options.stonetopLedgerEntries = this._tagLedgerMove(SteadingLedger.entriesForActorUpdate(this, changed), options);
					options.stonetopStatChanges = this._collectStatChanges(changed, STEADING_STAT_CHAT_LABELS);
				}
			}
			return result;
		}

		/**
		 * Attribute ledger entries to the move that caused them. When an update is the
		 * automated effect of a move (the caller passes `options.stonetopMove`), stamp
		 * each generated entry with that move's name so the ledger can show "via <move>".
		 */
		_tagLedgerMove(entries, options) {
			const moveName = options?.stonetopMove;
			if (moveName) for (const entry of entries) entry.move = moveName;
			return entries;
		}

		/**
		 * Diff the incoming update against current values for the watched stats.
		 * @param {object} changed  The incoming update (nested or dot-path shape).
		 * @param {Record<string,string>} labels  Stat path → chat label map for this actor type.
		 */
		_collectStatChanges(changed, labels) {
			// Most updates (HP, XP, debilities, flags…) never touch the watched stats,
			// so skip the flatten unless this one could. Covers both update shapes:
			// nested ({system:{stats}}) and dot-path ({"system.stats.str.value"}).
			const groups = [...new Set(Object.keys(labels).map(p => p.split(".").slice(0, 2).join(".")))];
			const couldTouchStats = groups.some(group =>
				foundry.utils.getProperty(changed, group) !== undefined
				|| Object.keys(changed).some(k => k.startsWith(`${group}.`)));
			if (!couldTouchStats) return [];

			const flat = foundry.utils.flattenObject(changed);
			const changes = [];
			for (const [path, label] of Object.entries(labels)) {
				if (!(path in flat)) continue;
				const oldValue = foundry.utils.getProperty(this, path);
				const newValue = flat[path];
				if (oldValue !== newValue) changes.push({ label, oldValue, newValue });
			}
			return changes;
		}

		async _onUpdate(changed, options, userId) {
			await super._onUpdate(changed, options, userId);
			if (options?.stonetopLedger) return;
			if (this.type === "character") {
				await CharacterLedger.append(this, options.stonetopLedgerEntries ?? [], { userId });
				// Only the user who made the change posts, so the card isn't duplicated per client.
				if (userId === globalThis.game?.user?.id) {
					postStatChangesToChat(this, options.stonetopStatChanges ?? []);
				}
			} else if (this.type === "stonetop" || this.system?.customType === "stonetop") {
				await SteadingLedger.append(this, options.stonetopLedgerEntries ?? [], { userId });
				// Only the user who made the change posts, so the card isn't duplicated per client.
				if (userId === globalThis.game?.user?.id) {
					postStatChangesToChat(this, options.stonetopStatChanges ?? []);
				}
			}
		}

		async _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
			await super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
			if (this.typedActor?.type === "character" && collection === "items") {
				await Promise.all([
					CharacterLedger.append(this, CharacterLedger.entriesForCreatedItems(documents), { userId }),
					this.typedActor._onCreateDescendantDocuments(documents),
				]);
			}
		}

		async _onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
			await super._onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId);
			if (this.type === "character" && collection === "items") {
				await CharacterLedger.append(this, CharacterLedger.entriesForDeletedItems(documents), { userId });
			}
		}
	};
}
