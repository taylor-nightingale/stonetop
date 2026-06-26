export function normalizeRollType(rollType) {
	if (rollType == null || rollType === "") return null;
	if (typeof rollType === "string") return rollType;
	if (typeof rollType === "object") {
		return normalizeRollType(
			rollType.value
			?? rollType.key
			?? rollType.id
			?? rollType.slug
			?? rollType.stat
			?? rollType.type
			?? null
		);
	}
	return String(rollType);
}
