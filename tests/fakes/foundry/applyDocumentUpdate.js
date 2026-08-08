// ONE description of what Document#update does to stored data, so every fake actor agrees.
//
// The rule that matters for tests: Foundry DEEP-MERGES plain objects. An update can add or overwrite
// a nested key but can never drop one by leaving it out (that needs an explicit `-=key`). Arrays and
// scalars replace wholesale. A fake that replaced instead would let "clear this by omitting its key"
// pass in tests and silently do nothing in the game.

const isPlainObject = v => typeof v === "object" && v !== null && !Array.isArray(v);

export function mergeValue(existing, incoming) {
	if (!isPlainObject(existing) || !isPlainObject(incoming)) return incoming;
	const merged = { ...existing };
	for (const [key, value] of Object.entries(incoming)) merged[key] = mergeValue(existing[key], value);
	return merged;
}

/** Apply one dot-path write (`"system.firstSession"`) to `target`, merging as Foundry does. */
export function applyDotPath(target, path, value) {
	const parts = path.split(".");
	let obj = target;
	for (let i = 0; i < parts.length - 1; i++) {
		if (obj[parts[i]] === undefined || obj[parts[i]] === null) obj[parts[i]] = {};
		obj = obj[parts[i]];
	}
	const leaf = parts[parts.length - 1];
	obj[leaf] = mergeValue(obj[leaf], value);
}

/** Apply a whole `update()` payload of dot-path → value entries. */
export function applyDocumentUpdate(target, data) {
	for (const [path, value] of Object.entries(data)) applyDotPath(target, path, value);
}
