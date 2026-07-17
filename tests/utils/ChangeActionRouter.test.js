// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChangeActionRouter } from "../../src/utils/ChangeActionRouter.js";
import { warn } from "../../src/utils/logger.js";

// The logger binds console.warn at module load, so spy on the logger itself.
vi.mock("../../src/utils/logger.js", () => ({ warn: vi.fn() }));

const change = el => el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));

function makeRoot(innerHTML) {
	document.body.innerHTML = `<div id="root">${innerHTML}</div>`;
	return document.getElementById("root");
}

describe("ChangeActionRouter", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("dispatches a change on a data-change-action element to its named handler", () => {
		const setHp = vi.fn();
		const root = makeRoot(`<input data-change-action="setHp" value="7">`);
		new ChangeActionRouter({ setHp }).attach(root);

		const input = root.querySelector("input");
		change(input);

		expect(setHp).toHaveBeenCalledTimes(1);
		const [el, ev] = setHp.mock.calls[0];
		expect(el).toBe(input);
		expect(ev.type).toBe("change");
	});

	it("resolves the action from an ancestor, so wrapped inputs route too", () => {
		const setName = vi.fn();
		const root = makeRoot(`
			<label data-change-action="setName" data-slug="bo">
				<input type="text">
			</label>`);
		new ChangeActionRouter({ setName }).attach(root);

		change(root.querySelector("input"));

		expect(setName).toHaveBeenCalledTimes(1);
		expect(setName.mock.calls[0][0].dataset.slug).toBe("bo"); // handler gets the annotated element
	});

	it("routes different actions to different handlers through the one listener", () => {
		const setHp = vi.fn();
		const setName = vi.fn();
		const root = makeRoot(`
			<input class="hp" data-change-action="setHp">
			<input class="name" data-change-action="setName">`);
		new ChangeActionRouter({ setHp, setName }).attach(root);

		change(root.querySelector(".hp"));
		change(root.querySelector(".name"));

		expect(setHp).toHaveBeenCalledTimes(1);
		expect(setName).toHaveBeenCalledTimes(1);
	});

	it("ignores changes on elements without a data-change-action", () => {
		const setHp = vi.fn();
		const root = makeRoot(`<input class="plain">`);
		new ChangeActionRouter({ setHp }).attach(root);

		change(root.querySelector(".plain"));

		expect(setHp).not.toHaveBeenCalled();
	});

	it("still routes when a bubble-phase listener between input and root stops propagation", () => {
		const setHp = vi.fn();
		const root = makeRoot(`<div class="widget"><input data-change-action="setHp"></div>`);
		root.querySelector(".widget").addEventListener("change", ev => ev.stopPropagation());
		new ChangeActionRouter({ setHp }).attach(root);

		change(root.querySelector("input"));

		expect(setHp).toHaveBeenCalledTimes(1);
	});

	it("the when predicate gates every handler per event", () => {
		const setHp = vi.fn();
		let editable = false;
		const root = makeRoot(`<input data-change-action="setHp">`);
		new ChangeActionRouter({ setHp }, { when: () => editable }).attach(root);

		change(root.querySelector("input"));
		expect(setHp).not.toHaveBeenCalled();

		editable = true; // the gate is evaluated per event, not at wiring time
		change(root.querySelector("input"));
		expect(setHp).toHaveBeenCalledTimes(1);
	});

	it("warns (and does not throw) on an action with no registered handler", () => {
		const root = makeRoot(`<input data-change-action="typoedAction">`);
		new ChangeActionRouter({}).attach(root);

		expect(() => change(root.querySelector("input"))).not.toThrow();

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0].join(" ")).toContain("typoedAction");
	});
});
