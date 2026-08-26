// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EDIT_IMAGE_ACTIONS } from "../../src/utils/editImageAction.js";

// Core's editImage handler throws for any target that is not an IMG, and our portraits are a
// <button> wrapping the image (a bare <img> with [data-action] is keyboard-dead). This action is
// the adapter between the two, so what it hands core is the whole point.

let core;

beforeEach(() => {
	core = vi.fn();
	foundry.applications.api = { DocumentSheetV2: { DEFAULT_OPTIONS: { actions: { editImage: core } } } };
});

afterEach(() => {
	delete foundry.applications.api;
});

function mount(html) {
	document.body.innerHTML = html;
	return document.body.firstElementChild;
}

const button = () => mount(
	`<button data-action="editImage"><img data-edit="img" src="worlds/w/portrait.webp"></button>`
);

describe("EDIT_IMAGE_ACTIONS.editImage", () => {
	it("hands core the wrapped image, not the button that fired it", () => {
		const target = button();
		const sheet = {};
		const ev = { type: "click" };

		EDIT_IMAGE_ACTIONS.editImage.call(sheet, ev, target);

		expect(core).toHaveBeenCalledWith(ev, target.querySelector("img"));
	});

	it("invokes core's handler with the sheet as `this`, which is where it reads the document", () => {
		const sheet = { id: "sheet" };
		EDIT_IMAGE_ACTIONS.editImage.call(sheet, {}, button());
		expect(core.mock.instances[0]).toBe(sheet);
	});

	it("returns core's result, so the caller can await the picker", () => {
		const picker = Promise.resolve();
		core.mockReturnValue(picker);
		expect(EDIT_IMAGE_ACTIONS.editImage.call({}, {}, button())).toBe(picker);
	});

	it("passes an IMG target straight through, for a sheet that addresses the image directly", () => {
		const target = mount(`<img data-edit="img" src="a.webp">`);
		EDIT_IMAGE_ACTIONS.editImage.call({}, {}, target);
		expect(core).toHaveBeenCalledWith(expect.anything(), target);
	});

	it("refuses a control with no image to edit rather than letting core throw about IMG elements", () => {
		const target = mount(`<button data-action="editImage">Portrait</button>`);
		expect(() => EDIT_IMAGE_ACTIONS.editImage.call({}, {}, target)).toThrow(/img\[data-edit\]/);
		expect(core).not.toHaveBeenCalled();
	});
});
