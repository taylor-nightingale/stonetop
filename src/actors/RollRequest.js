import { moveIcon } from "./embeddedMoves.js";
export class RollRequest {
	constructor({ stat, rollMode, label, description = "", moveResults = null, xpOnMiss = true, moveSlug = null, icon = null }) {
		this.stat = stat;
		this.rollMode = rollMode;
		this.label = label;
		this.description = description;
		this.moveResults = moveResults;
		this.xpOnMiss = xpOnMiss;
		// Which move is being rolled, for rules scoped to named moves rather than to a stat (the
		// steading's *diminished* debility). Null for a bare stat roll.
		this.moveSlug = moveSlug;
		// The move's own icon, so a chat card shows the same glyph the sheet does. Null for a bare
		// stat roll, or for a move whose image was never set.
		this.icon = icon;
	}

	static fromItem(item, rollStat, rollMode) {
		return new RollRequest({
			stat: rollStat ?? item.system?.rollStat,
			rollMode,
			label: item.name,
			moveSlug: item.system?.slug ?? null,
			icon: moveIcon(item),
			description: item.system?.description ?? "",
			moveResults: item.system?.moveResults ?? null,
			// The book's XP rule applies "unless the move says otherwise" — a move says otherwise
			// by carrying xpOnMiss: false in its data.
			xpOnMiss: item.system?.xpOnMiss !== false,
		});
	}

	static fromStat(stat, rollMode) {
		return new RollRequest({ stat, rollMode, label: stat.toUpperCase() });
	}

	resultText(resultKey) {
		return this.moveResults?.[resultKey]?.value ?? "";
	}

	// A move roll is titled by the move; a bare rating roll has no move behind it, so the stat is
	// the only name it has.
	titleFor(statKey) {
		return this.moveResults !== null ? this.label : statKey.toUpperCase();
	}
}
