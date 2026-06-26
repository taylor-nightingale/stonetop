/**
 * Opt-in Stonetop skin for *core* Foundry windows we don't own.
 *
 * Our own sheets and modals are styled directly, but core windows like
 * "User Configuration" are plain Foundry applications (ApplicationV2 in v13+).
 * Rather than restyle every `.application` globally — which would also reskin
 * every other module's dialogs and constantly fight core updates — we tag a
 * curated allowlist of core windows with a single marker class and scope ALL
 * theming to it (`.stonetop-themed` in stonetop.css). Nothing untagged is
 * touched, so the blast radius is exactly this list.
 *
 * To theme another core window: open it, read its class name from the console
 * (`ui.activeWindow.constructor.name`, or inspect the id-derived class on its
 * root element), and add that name to THEMED_WINDOWS. The render hook Foundry
 * fires is `render<ClassName>` — e.g. `UserConfig` → `renderUserConfig` — and
 * is stable across v12 (jQuery) and v13+ (native element); tagWindow handles
 * both element shapes.
 */

// ApplicationV2 (or v12 AppV1) class names whose windows get the Stonetop skin.
// Each entry `N` registers a `renderN` hook. Keep this tight — every window
// here is one we've actually eyeballed themed.
const THEMED_WINDOWS = [
	"UserConfig", // right-click a player in the sidebar → "User Configuration"
];

const MARKER_CLASS = "stonetop-themed";

/** Tag a freshly-rendered core window's root element so the scoped CSS applies. */
function tagWindow(_app, element) {
	// v13+ passes the root HTMLElement; v12 passes jQuery. Normalize to a node.
	const root = element?.jquery ? element[0] : element;
	// classList.add is idempotent, so re-renders are harmless.
	root?.classList?.add(MARKER_CLASS);
}

/** Register render hooks for every allowlisted core window. Call once, in init. */
export function registerStonetopWindowTheme() {
	for (const className of THEMED_WINDOWS) Hooks.on(`render${className}`, tagWindow);
}
