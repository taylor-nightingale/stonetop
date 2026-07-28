import { buildChoiceGroup } from "./buildChoiceGroup.js";
import { ChoiceValues } from "./ChoiceGroup.js";
import { ResourceController } from "../../../actors/character/ResourceController.js";

/**
 * The character's per-arcanum render inputs. Holds the choice-value store + stats so the snapshot
 * builders can resolve choice groups and resources through `group()`/`resource()` without touching a
 * choiceValues store or ResourceController themselves. The item-sheet preview builds one with defaults.
 */
export class ArcanumRenderContext {
	constructor({
		flipped       = false,
		choiceValues  = new ChoiceValues({}),
		stats         = new Map(),   // empty Map is safe for `.get(x)`
		current       = 0,
		checked       = false,
		owned         = true,
	} = {}) {
		this.flipped       = flipped;
		this.checked       = checked;
		this.owned         = owned;
		this._choiceValues = choiceValues;
		this._stats        = stats;
		this._current      = current;
	}

	/** Build the ChoiceGroup for one of the arcanum's groups (unlock / back-choices / consequences). */
	group(def) {
		return def ? buildChoiceGroup(def, this._choiceValues) : null;
	}

	/** Resolve a back RESOURCE def against the character's stats + current (null when there's no def). */
	resource(def) {
		if (!def) return null;
		return ResourceController.build({ ...def, max: def.maxStat ? (this._stats.get(def.maxStat) ?? 0) : def.max }, this._current);
	}

	/** Resolve a back ITEM's resource def. NOTE: preserves the legacy `stats[key]?.value` access (the
	 *  back resource above uses `stats.get(key)`) — a known inconsistency kept as-is by the refactor. */
	itemResource(def) {
		if (!def) return null;
		return ResourceController.build({ ...def, max: def.maxStat ? (this._stats[def.maxStat]?.value ?? 0) : def.max }, this._current);
	}
}
