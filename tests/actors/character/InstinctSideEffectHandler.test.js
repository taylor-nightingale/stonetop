import { describe, it, expect, vi } from "vitest";
import { InstinctSideEffectHandler } from "../../../src/actors/character/InstinctSideEffectHandler.js";
import { ChoiceValueChange } from "../../../src/model/data/ChoiceValueChange.js";
import { ChoiceValues } from "../../../src/model/snapshot/character/ChoiceGroup.js";

// A character has one instinct, offered by two documents. Whatever an insert's instinct becomes has
// to reach the playbook's box, or the sheet shows a character driven by something it no longer is.

const INSTINCT = { slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [
	{ slug: "denial",    text: "Denial",    description: "To refuse to accept that you are dead." },
	{ slug: "obsession", text: "Obsession", description: "To pursue your purpose." },
]}]};

const insertItem  = { type: "insert",   system: { slug: "revenant", instinct: INSTINCT } };
const playbookItem = { type: "playbook", system: { slug: "the-fox",  instinct: INSTINCT } };

const playbookSpy = () => ({ selectCustomInstinct: vi.fn(async () => {}) });

const change = (item, values, fields = {}) => new ChoiceValueChange({
	item, namespace: "instinct", values: new ChoiceValues(values), kind: "count", ...fields,
});

describe("InstinctSideEffectHandler", () => {
	it("writes an insert's picked instinct into the playbook's box, label and all", async () => {
		const playbook = playbookSpy();
		await new InstinctSideEffectHandler(playbook)
			.handle(change(insertItem, { instinct: { denial: 1 } }, { optionSlug: "denial", count: 1 }));

		expect(playbook.selectCustomInstinct)
			.toHaveBeenCalledWith("Denial — To refuse to accept that you are dead.");
	});

	it("writes an insert's typed instinct through too", async () => {
		const playbook = playbookSpy();
		await new InstinctSideEffectHandler(playbook).handle(
			change(insertItem, { instinct: { __custom: "to finish what I started" } },
				{ optionSlug: "__custom", kind: "text" }));

		expect(playbook.selectCustomInstinct).toHaveBeenCalledWith("to finish what I started");
	});

	// Clearing the insert's instinct clears the character's, rather than leaving a stale line behind.
	it("clears the playbook's box when the insert's instinct is emptied", async () => {
		const playbook = playbookSpy();
		await new InstinctSideEffectHandler(playbook)
			.handle(change(insertItem, { instinct: {} }, { kind: "clear" }));

		expect(playbook.selectCustomInstinct).toHaveBeenCalledWith("");
	});

	// The mirror writes to the playbook, and that write publishes straight back through here.
	it("ignores the playbook's own writes, so the mirror cannot echo", async () => {
		const playbook = playbookSpy();
		await new InstinctSideEffectHandler(playbook)
			.handle(change(playbookItem, { instinct: { denial: 1 } }, { optionSlug: "denial" }));

		expect(playbook.selectCustomInstinct).not.toHaveBeenCalled();
	});

	it("ignores writes to any other group", async () => {
		const playbook = playbookSpy();
		await new InstinctSideEffectHandler(playbook)
			.handle(change(insertItem, { consequences: { c1: 1 } }, { namespace: "consequences" }));

		expect(playbook.selectCustomInstinct).not.toHaveBeenCalled();
	});
});
