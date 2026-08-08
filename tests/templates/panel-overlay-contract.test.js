import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// A panel frame lifts its content above the decorative corners/edges with a generic direct-child
// rule. That selector is more specific than any single component's, so it silently overrides a
// child's own `position: absolute` and drops it back into flow — which is how the improvements'
// remove button ended up a full-width bar with a centred icon at the top of the panel. Nothing
// errors and no test fails; it just looks wrong until someone opens the tab.
//
// Overlay children opt out by carrying `.stonetop-panel-overlay`. These pin that contract.

const read = rel => readFileSync(path.resolve(process.cwd(), rel), "utf8");
const css = read("styles/stonetop.css");
const OVERLAY = "stonetop-panel-overlay";

describe("panel-frame overlay contract", () => {
	it("exempts overlay children from the content-lifting rule", () => {
		const rule = css.split("\n").find(l => l.includes(".steading-panel-frame > :not("));
		expect(rule).toBeDefined();
		expect(rule).toContain(`:not(.${OVERLAY})`);
	});

	// If a button positions itself against the frame but doesn't opt out, the generic rule wins and
	// it lands back in flow.
	it.each([
		["templates/actor/partials/steading-improvement-panel.hbs", "steading-improvement-remove"],
	])("%s marks %s as an overlay", (file, cls) => {
		const button = read(file).split("\n").find(l => l.includes(cls) && l.includes("class="));
		expect(button).toBeDefined();
		expect(button).toContain(OVERLAY);
	});

	// It sits over the panel's content (z-index 3), not just its edges — the choice rows span the
	// full panel width and would otherwise take the click in that corner.
	it("stacks the improvement remove above the lifted content", () => {
		const block = css.slice(css.indexOf(".steading-improvement-remove {"));
		const zIndex = Number(block.slice(0, block.indexOf("}")).match(/z-index:\s*(\d+)/)?.[1]);
		expect(zIndex).toBeGreaterThan(3);
	});
});
