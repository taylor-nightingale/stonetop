import Handlebars from "handlebars";
import { readFileSync } from "fs";
import path from "path";
import { registerStonetopHelpers } from "../../src/handlebars/helpers.js";
import { STONETOP_PARTIALS } from "../../src/handlebars/partials.js";
import { registerFoundryHelpers } from "./foundryHandlebarsHelpers.js";

/**
 * Renders the system's REAL Handlebars templates in tests.
 *
 * Sheet tests otherwise hand-write markup that mirrors a partial, which is a second description of
 * what the partial emits — and one that drifts silently. This compiles the actual file, using the
 * actual helpers (`src/handlebars/helpers.js`) and the actual partial map
 * (`src/handlebars/partials.js`), so a test that passes proves the handler and the template agree.
 *
 * Two helper sets are in play: ours, and the ones Foundry provides (`and`/`or`/`not`/`localize`) —
 * see foundryHandlebarsHelpers.js. Ours register last, so `eq`/`gt` resolve to our definitions
 * exactly as they do in play.
 */

// Partial paths are written as Foundry serves them ("systems/stonetop/…"); on disk they are
// repo-relative.
const REPO_PREFIX = "systems/stonetop/";

function toDiskPath(servedPath) {
	return path.resolve(process.cwd(), servedPath.replace(REPO_PREFIX, ""));
}

const PROTO_ACCESS = { allowProtoPropertiesByDefault: true, allowProtoMethodsByDefault: true };

let ready = false;

function ensureRegistered() {
	if (ready) return;
	registerFoundryHelpers(Handlebars);
	registerStonetopHelpers(Handlebars); // ours win where the names overlap, as in play
	for (const [name, servedPath] of Object.entries(STONETOP_PARTIALS)) {
		Handlebars.registerPartial(name, readFileSync(toDiskPath(servedPath), "utf8"));
	}
	ready = true;
}

const compiled = new Map();

/**
 * Render one template file.
 * @param servedPath  the Foundry-served path, e.g. "systems/stonetop/templates/actor/character.hbs"
 * @param context     the render context
 * @returns {string}  the rendered HTML
 */
export function renderTemplate(servedPath, context = {}) {
	ensureRegistered();
	if (!compiled.has(servedPath)) {
		compiled.set(servedPath, Handlebars.compile(readFileSync(toDiskPath(servedPath), "utf8")));
	}
	// Snapshots are class instances and the templates read their getters (FollowersSnapshot#tabCards,
	// …). Handlebars blocks prototype access by default; Foundry renders with it allowed, so a
	// harness without these options silently renders an empty block where the app renders content.
	return compiled.get(servedPath)(context, PROTO_ACCESS);
}

/** Render a registered partial by its name, e.g. "stonetop.move-item". */
export function renderPartial(name, context = {}) {
	ensureRegistered();
	const servedPath = STONETOP_PARTIALS[name];
	if (!servedPath) throw new Error(`No such Stonetop partial: ${name}`);
	return renderTemplate(servedPath, context);
}

/** Render a partial into a detached element, for tests that then fire events at it. */
export function renderPartialInto(root, name, context = {}) {
	root.innerHTML = renderPartial(name, context);
	return root;
}
