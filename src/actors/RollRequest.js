export class RollRequest {
	constructor({ stat, rollMode, label, description = "", moveResults = null }) {
		this.stat = stat;
		this.rollMode = rollMode;
		this.label = label;
		this.description = description;
		this.moveResults = moveResults;
	}

	static fromItem(item, rollStat, rollMode) {
		return new RollRequest({
			stat: rollStat ?? item.system?.rollStat,
			rollMode,
			label: item.name,
			description: item.system?.description ?? "",
			moveResults: item.system?.moveResults ?? null,
		});
	}

	static fromStat(stat, rollMode) {
		return new RollRequest({ stat, rollMode, label: stat.toUpperCase() });
	}

	resultText(resultKey) {
		return this.moveResults?.[resultKey]?.value ?? "";
	}

	buildDisplayName(statKey, resultLabel, isPrompt = false) {
		const statLabel = isPrompt ? "" : ` (+${statKey.toUpperCase()})`;
		return this.moveResults !== null
			? `${this.label}${statLabel} — ${resultLabel}`
			: `${statKey.toUpperCase()} — ${resultLabel}`;
	}
}
