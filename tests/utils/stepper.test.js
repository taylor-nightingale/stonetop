// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { activateSteppers } from "../../src/utils/stepper.js";
import { renderPartial } from "../fakes/renderTemplate.js";

// The stepper's markup now comes from the templates, so these drive the REAL rendered controls
// rather than markup written here that only claims to match. The behaviour asserted is the same as
// before the move — that is the point.

function mount(html) {
	document.body.innerHTML = `<div id="root">${html}</div>`;
	const root = document.getElementById("root");
	activateSteppers(root);
	return root;
}

// A stepper exactly as a template emits one: the wrapper, the input, and the rendered buttons.
function stepper(attrs = "") {
	return mount(`
		<span class="stonetop-stepper">
			<input class="stonetop-step" type="number" value="3" ${attrs}>
			${renderPartial("stonetop.stepper-buttons", {})}
		</span>`);
}

const up    = root => root.querySelector(".stonetop-stepper-btn--up");
const down  = root => root.querySelector(".stonetop-stepper-btn--down");
const input = root => root.querySelector("input.stonetop-step");
const click = el => el.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));

beforeEach(() => { document.body.innerHTML = ""; });

describe("stepper-buttons partial", () => {
	it("emits an up and a down button carrying their direction", () => {
		const root = stepper();

		expect(up(root).dataset.stepDir).toBe("1");
		expect(down(root).dataset.stepDir).toBe("-1");
	});

	// The buttons must never take tab focus or submit the form they sit in.
	it("emits non-submitting, non-focusable buttons", () => {
		const root = stepper();

		for (const btn of [up(root), down(root)]) {
			expect(btn.getAttribute("type")).toBe("button");
			expect(btn.tabIndex).toBe(-1);
		}
	});

	// The CSS positions the buttons with `:has(> .some-input)`, so the input has to stay a direct
	// child of the wrapper.
	it("leaves the input a direct child of the wrapper", () => {
		const root = stepper();

		expect(input(root).parentElement).toBe(root.querySelector(".stonetop-stepper"));
	});
});

// The end-to-end shape: a real sheet partial, rendered, with a working stepper in it. This is the
// check the old JS-built stepper could not have — the markup and the handler now have to agree.
describe("steppers in a real rendered partial", () => {
	const attributes = () => renderPartial("stonetop.actor-attributes", {
		stonetop: { vitals: { hp: { value: 5, max: 8 }, armor: 1, xp: 2, level: 3, sources: {} } },
	});

	it("renders each stepper input wrapped, with both buttons", () => {
		const root = mount(attributes());

		const wrappers = root.querySelectorAll(".stonetop-stepper");
		expect(wrappers.length).toBeGreaterThan(0);
		for (const wrap of wrappers) {
			expect(wrap.querySelector(":scope > input.stonetop-step")).not.toBeNull();
			expect(wrap.querySelectorAll(":scope > .stonetop-stepper-btn")).toHaveLength(2);
		}
	});

	it("steps the HP field the sheet actually renders", () => {
		const root = mount(attributes());
		const hp = root.querySelector("input.stonetop-char-hp");

		click(hp.closest(".stonetop-stepper").querySelector(".stonetop-stepper-btn--up"));

		expect(hp.value).toBe("6");
	});

	it("clamps at the min the template declares", () => {
		const root = mount(renderPartial("stonetop.actor-attributes", {
			stonetop: { vitals: { hp: { value: 0, max: 8 }, armor: 0, xp: 0, level: 1, sources: {} } },
		}));
		const hp = root.querySelector("input.stonetop-char-hp");

		click(hp.closest(".stonetop-stepper").querySelector(".stonetop-stepper-btn--down"));

		expect(hp.value).toBe("0"); // min="0" in the template
	});
});

describe("activateSteppers", () => {
	it("increments and decrements by one by default", () => {
		const root = stepper();

		click(up(root));
		expect(input(root).value).toBe("4");

		click(down(root));
		click(down(root));
		expect(input(root).value).toBe("2");
	});

	it("respects a custom step", () => {
		const root = stepper(`step="5"`);

		click(up(root));

		expect(input(root).value).toBe("8");
	});

	it("clamps at min and max", () => {
		const root = stepper(`min="2" max="4"`);

		click(down(root));
		click(down(root)); // already at min, must not go below
		expect(input(root).value).toBe("2");

		click(up(root)); click(up(root)); click(up(root));
		expect(input(root).value).toBe("4");
	});

	it("treats a blank value as zero rather than NaN", () => {
		const root = mount(`
			<span class="stonetop-stepper">
				<input class="stonetop-step" type="number" value="">
				${renderPartial("stonetop.stepper-buttons", {})}
			</span>`);

		click(up(root));

		expect(input(root).value).toBe("1");
	});

	// The value is what the sheet persists, so stepping has to look like typing.
	it("dispatches a bubbling change so the field's own handler saves", () => {
		const root = stepper();
		const seen = vi.fn();
		root.addEventListener("change", seen);

		click(up(root));

		expect(seen).toHaveBeenCalledTimes(1);
		expect(seen.mock.calls[0][0].bubbles).toBe(true);
	});

	it("does not let its click reach the surrounding row", () => {
		const root = stepper();
		const rowClick = vi.fn();
		root.addEventListener("click", rowClick);

		click(up(root));

		expect(rowClick).not.toHaveBeenCalled();
	});

	it("leaves a disabled input alone", () => {
		const root = stepper(`disabled`);

		click(up(root));

		expect(input(root).value).toBe("3");
	});

	// Wired once on first render; the delegated listener keeps working as part content is replaced.
	it("keeps working after the content it was wired over is replaced", () => {
		const root = stepper();

		root.innerHTML = `
			<span class="stonetop-stepper">
				<input class="stonetop-step" type="number" value="10">
				${renderPartial("stonetop.stepper-buttons", {})}
			</span>`;
		click(up(root));

		expect(input(root).value).toBe("11");
	});

	it("drives several steppers under one root independently", () => {
		const root = mount(`
			<span class="stonetop-stepper">
				<input id="a" class="stonetop-step" type="number" value="1">
				${renderPartial("stonetop.stepper-buttons", {})}
			</span>
			<span class="stonetop-stepper">
				<input id="b" class="stonetop-step" type="number" value="5">
				${renderPartial("stonetop.stepper-buttons", {})}
			</span>`);

		click(root.querySelectorAll(".stonetop-stepper")[1].querySelector(".stonetop-stepper-btn--up"));

		expect(root.querySelector("#a").value).toBe("1");
		expect(root.querySelector("#b").value).toBe("6");
	});

	it("ignores clicks that are not on a stepper button", () => {
		const root = stepper();

		expect(() => click(input(root))).not.toThrow();
		expect(input(root).value).toBe("3");
	});

	it("tolerates a missing root", () => {
		expect(() => activateSteppers(null)).not.toThrow();
	});
});
