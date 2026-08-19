/**
 * The Foundry-provided Handlebars helpers our templates use.
 *
 * Copied verbatim from core so the semantics match: FoundryVTT 13.351,
 * `resources/app/client/applications/handlebars.mjs:107-134`. Reimplementing them by eye would make
 * a rendered test agree with a helper Foundry does not actually have — the exact drift this harness
 * exists to remove. Only the ones the templates reach for are here; add from the same source if a
 * template starts using another.
 *
 * `localize` is the one deliberate deviation: it returns the key, since no test asserts on copy.
 */
export function registerFoundryHelpers(Handlebars) {
	Handlebars.registerHelper({
		eq:  (v1, v2) => v1 === v2,
		ne:  (v1, v2) => v1 !== v2,
		lt:  (v1, v2) => v1 < v2,
		gt:  (v1, v2) => v1 > v2,
		lte: (v1, v2) => v1 <= v2,
		gte: (v1, v2) => v1 >= v2,
		not: pred => !pred,
		and() { return Array.prototype.every.call(arguments, Boolean); },
		or()  { return Array.prototype.slice.call(arguments, 0, -1).some(Boolean); },
	});
	Handlebars.registerHelper("localize", key => key);
}
