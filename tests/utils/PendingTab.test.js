// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { PendingTab } from "../../src/utils/PendingTab.js";

const root = tabs => {
	const el = document.createElement("div");
	el.innerHTML = tabs.map(id => `<div class="tab" data-tab="${id}"></div>`).join("");
	return el;
};

describe("PendingTab", () => {
	it("waits for the tab to exist, then switches to it once", () => {
		const pending = new PendingTab();
		const changeTab = vi.fn();
		pending.set("insert-thrall");
		pending.applyTo(root(["playbook"]), changeTab);
		expect(changeTab).not.toHaveBeenCalled();
		pending.applyTo(root(["playbook", "insert-thrall"]), changeTab);
		pending.applyTo(root(["playbook", "insert-thrall"]), changeTab);
		expect(changeTab).toHaveBeenCalledTimes(1);
		expect(changeTab).toHaveBeenCalledWith("insert-thrall");
	});

	it("does nothing with nothing pending", () => {
		const changeTab = vi.fn();
		new PendingTab().applyTo(root(["playbook"]), changeTab);
		expect(changeTab).not.toHaveBeenCalled();
	});
});
