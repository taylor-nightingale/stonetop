import crypto from "crypto";

// Foundry document IDs are 16 chars from this alphabet.
const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Deterministic 16-char Foundry ID derived from a namespace + key. Stable across runs so
 * re-importing produces the same IDs (and cross-references keep resolving). The namespace
 * keeps IDs distinct when the same slug appears in two packs (e.g. a monster actor and its
 * bestiary writeup both slugged "boar").
 */
export function deterministicId(namespace, key) {
	const digest = crypto.createHash("sha256").update(`${namespace}:${key}`).digest();
	let id = "";
	for (let i = 0; i < 16; i++) id += ID_CHARS[digest[i] % ID_CHARS.length];
	return id;
}

// Foundry pack document type → the `_key` collection prefix used in pack source JSON.
const KEY_PREFIX = {
	Actor:        "!actors",
	Item:         "!items",
	JournalEntry: "!journal",
};

/** The `_key` for a top-level pack document of the given type. */
export function documentKey(documentType, id) {
	const prefix = KEY_PREFIX[documentType];
	if (!prefix) throw new Error(`Unknown pack document type: ${documentType}`);
	return `${prefix}!${id}`;
}
