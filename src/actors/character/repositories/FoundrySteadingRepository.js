/**
 * Finds the steading a character calls home. That one steading answers both what the sheet
 * displays (Prosperity) and what a character rolls when a move reaches past its own stats
 * (Requisition's +Fortunes), so this hands back the typed actor and lets callers ask it directly.
 */
export class FoundrySteadingRepository {
	/**
	 * A world should have one steading, but strays happen (test actors left at the
	 * default name). Prefer the one named "Stonetop", then any renamed one, then first.
	 * @returns {import("../../steading/StonetopSteading.js").StonetopSteading|null} the typed actor
	 */
	getPrimary() {
		const steadings = globalThis.game?.actors?.filter?.(a => a.type === "steading") ?? [];
		const doc = steadings.length <= 1
			? steadings[0] ?? null
			: steadings.find(a => a.name?.trim().toLowerCase() === "stonetop")
				?? steadings.find(a => !_isDefaultNamed(a.name))
				?? steadings[0];
		return doc?.typedActor ?? null;
	}
}

/**
 * True for a steading left at the name Foundry generates on create: the localized type label,
 * plus the " (2)" suffix core appends when that name is already taken.
 * @see Document.defaultName
 */
function _isDefaultNamed(name) {
	const label = _loc("TYPES.Actor.steading").trim().toLowerCase();
	const trimmed = (name ?? "").trim().toLowerCase();
	return trimmed === label || new RegExp(`^${_escape(label)} \\(\\d+\\)$`).test(trimmed);
}

function _escape(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function _loc(key) {
	return globalThis.game?.i18n?.localize?.(key) ?? key;
}
