// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { editOnly, confirmedDelete } from "../../src/utils/sheetActions.js";
import { confirmDelete } from "../../src/utils/confirmDelete.js";

vi.mock("../../src/utils/confirmDelete.js", () => ({ confirmDelete: vi.fn() }));

// Stands in for the sheet an action's `this` is bound to.
function sheet({ editable = true } = {}) {
	return { isEditable: editable };
}

function target(name = "Enfys") {
	const el = document.createElement("a");
	el.dataset.name = name;
	return el;
}

const leftClick  = () => ({ type: "click", button: 0, preventDefault: vi.fn() });
const rightClick = () => ({ type: "contextmenu", button: 2, preventDefault: vi.fn() });

beforeEach(() => { confirmDelete.mockReset(); });

describe("editOnly", () => {
	it("runs the handler on an editable sheet and forwards event and target", () => {
		const handler = vi.fn();
		const ev = leftClick();
		const el = target();

		editOnly(handler).call(sheet(), ev, el);

		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler.mock.calls[0]).toEqual([ev, el]);
	});

	it("does nothing on a locked sheet", () => {
		const handler = vi.fn();

		editOnly(handler).call(sheet({ editable: false }), leftClick(), target());

		expect(handler).not.toHaveBeenCalled();
	});

	it("binds `this` to the sheet so a handler can reach its typed actor", () => {
		const seen = [];
		const s = sheet();

		editOnly(function () { seen.push(this); }).call(s, leftClick(), target());

		expect(seen[0]).toBe(s);
	});

	it("returns the handler's value, so an async action is awaitable by core", async () => {
		const wrapped = editOnly(() => Promise.resolve("done"));

		await expect(wrapped.call(sheet(), leftClick(), target())).resolves.toBe("done");
	});

	// The gate is read per event, not captured when the actions map was built.
	it("follows ownership granted after the action was created", () => {
		const handler = vi.fn();
		const wrapped = editOnly(handler);
		const s = sheet({ editable: false });

		wrapped.call(s, leftClick(), target());
		expect(handler).not.toHaveBeenCalled();

		s.isEditable = true;
		wrapped.call(s, leftClick(), target());
		expect(handler).toHaveBeenCalledTimes(1);
	});
});

describe("confirmedDelete", () => {
	it("declares buttons [0, 2] so core routes right-click through the actions pipeline", () => {
		expect(confirmedDelete(vi.fn()).buttons).toEqual([0, 2]);
	});

	it("performs the delete on a left-click once confirmed, naming the target", async () => {
		confirmDelete.mockResolvedValue(true);
		const perform = vi.fn();
		const el = target("Enfys");

		await confirmedDelete(perform).handler.call(sheet(), leftClick(), el);

		expect(confirmDelete).toHaveBeenCalledWith("Enfys");
		expect(perform).toHaveBeenCalledWith(el);
	});

	it("does not delete when the confirmation is declined", async () => {
		confirmDelete.mockResolvedValue(false);
		const perform = vi.fn();

		await confirmedDelete(perform).handler.call(sheet(), leftClick(), target());

		expect(perform).not.toHaveBeenCalled();
	});

	it("skips the confirmation entirely on a right-click", async () => {
		const perform = vi.fn();

		await confirmedDelete(perform).handler.call(sheet(), rightClick(), target());

		expect(confirmDelete).not.toHaveBeenCalled();
		expect(perform).toHaveBeenCalledTimes(1);
	});

	it("suppresses the browser context menu on the right-click path", async () => {
		const ev = rightClick();

		await confirmedDelete(vi.fn()).handler.call(sheet(), ev, target());

		expect(ev.preventDefault).toHaveBeenCalled();
	});

	it("does nothing on a locked sheet, without even asking", async () => {
		const perform = vi.fn();

		await confirmedDelete(perform).handler.call(sheet({ editable: false }), leftClick(), target());

		expect(confirmDelete).not.toHaveBeenCalled();
		expect(perform).not.toHaveBeenCalled();
	});
});
