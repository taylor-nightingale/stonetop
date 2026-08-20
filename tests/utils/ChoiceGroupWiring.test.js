// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChoiceGroupWiring } from "../../src/utils/ChoiceGroupWiring.js";
import { fire } from "../fakes/domEvents.js";

// One description of how a rendered choice row behaves, for every sheet that shows one. The host is
// any typed actor answering the four choice methods — nothing here knows what an improvement, an
// arcanum or a seasonal gain is.

const host = () => ({
	setChoiceTrackFor: vi.fn(), setChoicePickFor: vi.fn(),
	setChoiceTextFor: vi.fn(),  clearChoicePickFor: vi.fn(),
});

function mount(html, { editable = true } = {}) {
	const root = document.createElement("form");
	root.innerHTML = html;
	const h = host();
	new ChoiceGroupWiring(h, { when: () => editable }).attach(root);
	return { root, host: h, el: root.firstElementChild };
}

const track = `<input type="checkbox" class="stonetop-cg-track" data-change-action="cgTrack"
	data-cg-context="improvement" data-cg-group="g" data-cg-option="o" data-cg-index="2">`;
const pick = (checked = false) => `<input type="radio" class="stonetop-cg-pick" data-change-action="cgPick"
	data-cg-context="steading" data-cg-group="g" data-cg-option="o" data-cg-siblings="o,p" ${checked ? "checked" : ""}>`;
const text = `<input class="stonetop-cg-text" data-change-action="cgText"
	data-cg-context="arcana" data-cg-group="g" data-cg-option="o" value="written">`;

describe("ChoiceGroupWiring routing", () => {
	it("routes a track change with its index and checked state", () => {
		const { el, host } = mount(track);
		el.checked = true;
		fire(el, "change");
		const [target, index, checked] = host.setChoiceTrackFor.mock.calls[0];
		expect([target.context, target.group, target.option]).toEqual(["improvement", "g", "o"]);
		expect([index, checked]).toEqual(["2", true]);
	});

	it("routes a pick with the siblings its row named", () => {
		const { el, host } = mount(pick());
		el.checked = true;
		fire(el, "change");
		const [target, checked] = host.setChoicePickFor.mock.calls[0];
		expect(target.siblingsCsv).toBe("o,p");
		expect(checked).toBe(true);
	});

	it("routes a text change with its value", () => {
		const { el, host } = mount(text);
		fire(el, "change");
		expect(host.setChoiceTextFor.mock.calls[0][1]).toBe("written");
	});

	it("ignores a change on anything that is not a choice row", () => {
		const { root, host } = mount(`<input data-change-action="hp">`);
		fire(root.firstElementChild, "change");
		expect(host.setChoiceTrackFor).not.toHaveBeenCalled();
		expect(host.setChoicePickFor).not.toHaveBeenCalled();
	});

	// Checked per event, not at wiring time — a sheet that gains ownership mid-session just works.
	it("honours the editability gate per event", () => {
		const { el, host } = mount(track, { editable: false });
		fire(el, "change");
		expect(host.setChoiceTrackFor).not.toHaveBeenCalled();
	});
});

describe("ChoiceGroupWiring pick clearing", () => {
	// A "pick 1" row renders radios, which a browser will never let you untick.
	it("releases the pick when the already-selected option is re-clicked", () => {
		const { el, host } = mount(pick(true));
		fire(el, "click");
		expect(host.clearChoicePickFor).toHaveBeenCalledTimes(1);
		expect(host.clearChoicePickFor.mock.calls[0][0].option).toBe("o");
	});

	it("leaves a click on an unpicked option to the ordinary change route", () => {
		const { el, host } = mount(pick(false));
		fire(el, "click");
		expect(host.clearChoicePickFor).not.toHaveBeenCalled();
	});

	// Without this the browser re-checks it before the re-render lands, and it flickers back.
	it("prevents the browser re-checking the released option", () => {
		const { el } = mount(pick(true));
		const ev = new Event("click", { bubbles: true, cancelable: true });
		el.dispatchEvent(ev);
		expect(ev.defaultPrevented).toBe(true);
	});

	it("does not clear while the sheet is not editable", () => {
		const { el, host } = mount(pick(true), { editable: false });
		fire(el, "click");
		expect(host.clearChoicePickFor).not.toHaveBeenCalled();
	});
});

