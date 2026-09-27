/**
 * Opens the deck, from a Foundry page, with nothing cached.
 *
 * Paste this into the console of any page on Foundry's origin (the game, /join, /setup — it does not
 * matter which, and it does not need a world loaded):
 *
 *     await import("/systems/stonetop/scripts/development/redesign-mock/open.js?b=" + Date.now())
 *
 * The `?b=` is what makes THIS file reload; everything it pulls is busted below. Re-paste after every
 * edit. Nothing here touches the world, so it is safe to run against a live session — it replaces
 * the document in the tab, which a refresh undoes.
 *
 * ── The one-click version ───────────────────────────────────────────────────
 *
 * The same line as a bookmarklet. Make a bookmark on the bar, call it "Deck", and paste this as its
 * URL — one line, the `javascript:` included:
 *
 *     javascript:void import("/systems/stonetop/scripts/development/redesign-mock/open.js?b="+Date.now())
 *
 * Open http://localhost:30003/join and click it. Every edit after that is one click, no console.
 *
 * `/join` rather than `/game` because the deck REPLACES the document in whatever tab it opens in,
 * and the join screen is the page on this origin that costs nothing to lose — the loader wants the
 * ORIGIN, not a world, which is the whole reason it can run there at all. Clicking it on a live game
 * is survivable, since a refresh brings the game back, but there is no reason to.
 *
 * `void` is not decoration. A `javascript:` URL whose expression evaluates to a STRING replaces the
 * document with that string. `import()` returns a promise, so this one was already safe; the leading
 * `void` says so without the reader having to know the rule.
 *
 * Checked before writing it down: Foundry sends no Content-Security-Policy on this origin — only
 * `X-Frame-Options: DENY`, which is about framing and has nothing to say about bookmarklets — so
 * nothing blocks a `javascript:` URL here. A CSP carrying `script-src` would, and that is the thing
 * to suspect first if this ever stops working.
 *
 * ── Why a loader exists at all ──────────────────────────────────────────────
 *
 * Two problems, and both of them are silent, which is what makes them worth a file.
 *
 * FOUNDRY WILL NOT EXECUTE THE PAGE. It serves .html out of a system folder as `text/plain` — user
 * writable HTML on the app's own origin is a cross-site scripting hole — so navigating to sheet.html
 * renders the source as text. The page has to be written into a document already on that origin,
 * which is what `document.write` below does. The consequence to remember: the deck has no URL, so
 * F5 does not reload it, it LEAVES it. That is not a bug to fix, it is the trade for having the
 * app's own stylesheet, fonts and art resolve.
 *
 * MODULES CACHE BY URL, AND ONLY THE ENTRY POINT GETS BUSTED. Adding `?b=` to main.js reloads main.js
 * and nothing else: its own `import "./band.js"` is a different URL that the browser already holds.
 * The result is the worst kind of wrong — a deck that renders, looks plausible, and is running the
 * code you edited mixed with the code you thought you had replaced. The whole graph is rewritten
 * here in dependency order, each module becoming a blob whose import specifiers point at the blobs
 * already made for its dependencies.
 */

const BASE = "/systems/stonetop/scripts/development/redesign-mock/";

/**
 * Dependency order, not alphabetical: a module can only be turned into a blob once every module it
 * imports already has one, because its specifiers are rewritten to point at them.
 */
const MODULES = ["text.js", "sections.js", "CharacterSnapshot.js", "standIns.js", "parts.js", "band.js", "rail.js", "motion.js", "main.js"];

const stamp = Date.now();
const fetchText = path => fetch(BASE + path + "?b=" + stamp).then(r => {
	if (!r.ok) throw new Error(`${path} → ${r.status} ${r.statusText}`);
	return r.text();
});

const blobs = {};
for (const name of MODULES) {
	const source = await fetchText(name);
	// The deck's own modules (`./`) become blobs. The system's (`../`) are the shipped code the deck
	// reuses rather than copies — the condenser that draws a locked choice group — and they are
	// pointed at where they really live: a blob has no folder, so a relative path from one resolves
	// against nothing — and so does a bare "/systems/…" path, since a blob URL has no hierarchy to
	// take a root from. Hence a full URL, resolved against THIS file's own: the deck's modules sit
	// beside it, so their `../` means the same from here. Not against the page — a page the deck has
	// already been written into can report its origin as "null", and "null/systems/…" is no base at
	// all. They are not busted, because the deck edits none of them.
	const rewritten = source
		.replace(/from\s+"\.\/([A-Za-z][\w.-]*\.js)"/g, (whole, dep) => {
			if (!blobs[dep]) throw new Error(`${name} imports ${dep}, which has no blob yet — MODULES is out of dependency order`);
			return `from "${blobs[dep]}"`;
		})
		.replace(/from\s+"(\.\.\/[^"]+\.js)"/g, (whole, dep) => `from "${new URL(dep, import.meta.url).href}"`);
	blobs[name] = URL.createObjectURL(new Blob([rewritten], { type: "text/javascript" }));
}

// The stylesheets are plain <link>s and cache the same way, so they take the same stamp. The entry
// script becomes the blob built above — the one URL in the page that is not a real file.
const page = (await fetchText("sheet.html"))
	.replace(/href="([^"]+\.css)"/g, (whole, href) => `href="${href}?b=${stamp}"`)
	.replace(/<script type="module" src="main\.js"><\/script>/,
		`<script type="module" src="${blobs["main.js"]}"></script>`);

document.open();
document.write(page);
document.close();

console.log(`[deck] opened at ${new Date(stamp).toLocaleTimeString()} — ${MODULES.length} modules, nothing cached`);
