// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RollModeDialog } from "../../src/actors/RollModeDialog.js";
import { RollChoice, RollPrompt, RollRule } from "../../src/actors/RollPrompt.js";
import { RollableStat } from "../../src/actors/RollableStat.js";
import { RollModeNote, RollModeNotes } from "../../src/model/snapshot/steading/RollModeNote.js";
import { renderTemplate } from "../fakes/renderTemplate.js";
import { fakeI18n } from "../fakes/foundry/FakeI18n.js";

// The dialog every 2d6 roll asks through: Advantage, Normal or Disadvantage, under a heading, the
// dice, and the formula they make (or a dropdown of stats, for a move that rolls "ask"). DialogV2.wait
// is the Foundry boundary — the fake captures the config it was handed and answers the way the real
// one does: the clicked button's callback result, or null when the dialog is dismissed.

const int = new RollableStat("int", "Intelligence", 2, "INT");
const dex = new RollableStat("dex", "Dexterity", -1, "DEX");
const rule = new RollRule("advantage-disadvantage", "Advantage/Disadvantage");
const maelen = { rollerName: "Maelen", rollerNote: "The Seeker" };

let config;
let answer;

function makeDialog() {
	return new RollModeDialog({
		wait:   async c => { config = c; return answer(c); },
		render: async (path, context) => renderTemplate(path, context),
	});
}

/** The dialog as DialogV2 draws it: the content, then a footer of the configured buttons. */
function drawn(c) {
	const root = document.createElement("dialog");
	const buttons = c.buttons.map(b =>
		`<button type="${b.type}" data-action="${b.action}" class="${b.class}"${b.default ? " autofocus" : ""}>${b.label}</button>`);
	root.innerHTML = `<form><div class="dialog-content">${c.content}</div><footer class="form-footer">${buttons.join("")}</footer></form>`;
	document.body.replaceChildren(root);
	return root;
}

const click = (c, action, root = drawn(c)) =>
	c.buttons.find(b => b.action === action).callback(new Event("click"), root.querySelector(`[data-action="${action}"]`), {});

const text = (root, selector) => root.querySelector(selector)?.textContent.trim() ?? null;

beforeEach(() => {
	config = null;
	answer = () => null;
	vi.stubGlobal("game", { i18n: fakeI18n() });
});

describe("RollModeDialog — the modes", () => {
	it("offers Advantage, Normal and Disadvantage, in that order", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen));
		expect(config.buttons.map(b => b.action)).toEqual(["adv", "normal", "dis"]);
		expect(config.buttons.map(b => b.label))
			.toEqual(["stonetop.rollMode.adv", "stonetop.rollMode.normal", "stonetop.rollMode.dis"]);
	});

	// The default is marked by focus alone. A Normal drawn differently from the other two read as one
	// already selected, and the three read as a selector rather than as three ways to roll.
	it("draws the three alike", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen));
		expect(new Set(config.buttons.map(b => b.class))).toEqual(new Set(["stonetop-roll-mode-btn"]));
	});

	it("makes Normal the default", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen));
		expect(config.buttons.filter(b => b.default).map(b => b.action)).toEqual(["normal"]);
	});

	// Enter submits a form through its first submit button. Only Normal is one, so Enter can only
	// ever roll Normal — never Advantage because it happens to come first.
	it("makes Normal the only submit button", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen));
		expect(config.buttons.map(b => b.type)).toEqual(["button", "submit", "button"]);
	});

	it("answers with the mode clicked", async () => {
		answer = c => click(c, "adv");
		expect(await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen))).toEqual(new RollChoice(null, "adv"));
	});

	it("answers null when the dialog is dismissed", async () => {
		expect(await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen))).toBeNull();
	});
});

describe("RollModeDialog — the window", () => {
	// The heading in the body says it; the frame carries only the dice icon. The title stays as the
	// window's accessible name.
	it("names the window by the roll and gives its frame a dice icon", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen));
		expect(config.window.title).toBe("Defy Danger");
		expect(config.window.icon).toContain("fa-dice");
	});

	// `sheet` puts it on the sheets' own tokens and type, so it follows the theme as they do.
	it("wears the sheets' classes", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen));
		expect(config.classes).toEqual(["stonetop", "sheet", "stonetop-roll-dialog"]);
	});

	// DialogV2's own "auto" sizes it to what it holds, and follows the Font Size setting.
	it("sizes itself to its contents", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen));
		expect(config.position).toBeUndefined();
	});

	// Rolled from a popped-out sheet, it opens over that sheet rather than back in the main workspace.
	it("opens in the window of the sheet it is asked over", async () => {
		const sheet = { window: { windowId: "stonetop-character-abc" } };
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen), { app: sheet });
		expect(config.renderOptions).toEqual({ window: { windowId: "stonetop-character-abc" } });
	});

	it("leaves the window to Foundry when there is no sheet to open over", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen));
		expect(config.renderOptions).toEqual({});
	});
});

describe("RollModeDialog — the heading", () => {
	it("names the roll", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen));
		expect(text(drawn(config), ".stonetop-roll-prompt-title")).toBe("Defy Danger");
	});

	// As the character's masthead says it: the name, then the playbook in its own voice.
	it("says who is rolling, with their note", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen));
		const root = drawn(config);
		expect(text(root, ".stonetop-roll-prompt-roller")).toBe("Maelen The Seeker");
		expect(text(root, ".stonetop-roll-prompt-note")).toBe("The Seeker");
	});

	it("says just the name where the roller has no note", async () => {
		await makeDialog().pick(RollPrompt.forStat("Muster", int, { rollerName: "Stonetop" }));
		const root = drawn(config);
		expect(text(root, ".stonetop-roll-prompt-roller")).toBe("Stonetop");
		expect(root.querySelector(".stonetop-roll-prompt-note")).toBeNull();
	});
});

describe("RollModeDialog — the dice and the formula", () => {
	it("draws the dice and names them", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen));
		const root = drawn(config);
		expect(root.querySelectorAll(".stonetop-roll-prompt-die")).toHaveLength(2);
		expect(text(root, ".stonetop-roll-prompt-dice-label")).toBe("2d6");
	});

	it("states the formula and the stat it adds", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen));
		const root = drawn(config);
		expect(text(root, ".stonetop-roll-prompt-formula")).toBe("2d6 + 2");
		expect(text(root, ".stonetop-roll-prompt-stat")).toBe("INT");
	});

	it("subtracts a negative stat with a real minus sign", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", dex, maelen));
		expect(text(drawn(config), ".stonetop-roll-prompt-formula")).toBe("2d6 − 1");
	});

	it("states the bare dice for a roll with no stat", async () => {
		await makeDialog().pick(RollPrompt.forStat("Roll", null, maelen));
		const root = drawn(config);
		expect(text(root, ".stonetop-roll-prompt-formula")).toBe("2d6");
		expect(text(root, ".stonetop-roll-prompt-stat")).toBe("");
	});

	it("offers no stat to choose", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen));
		expect(drawn(config).querySelector("select")).toBeNull();
	});
});

describe("RollModeDialog — choosing the stat", () => {
	const prompt = () => RollPrompt.forChoice("Defy Danger", [int, dex], maelen);
	const rendered = async () => {
		await makeDialog().pick(prompt());
		const root = drawn(config);
		config.render(new Event("render"), { element: root });
		return root;
	};
	const choose = (root, key) => {
		const select = root.querySelector("select[name=stat]");
		select.value = key;
		select.dispatchEvent(new Event("change", { bubbles: true }));
	};

	it("offers every stat in a dropdown, each with its value", async () => {
		const root = await rendered();
		const options = [...root.querySelectorAll("select[name=stat] option")].filter(o => o.value);
		expect(options.map(o => o.value)).toEqual(["int", "dex"]);
		expect(options.map(o => o.textContent.trim())).toEqual(["Intelligence (+2)", "Dexterity (-1)"]);
	});

	it("labels the dropdown", async () => {
		const root = await rendered();
		expect(root.querySelector("select[name=stat]").closest("label")).not.toBeNull();
	});

	it("picks none for you", async () => {
		const root = await rendered();
		expect(root.querySelector("select[name=stat]").value).toBe("");
	});

	it("states the bare dice until a stat is picked", async () => {
		const root = await rendered();
		expect(text(root, ".stonetop-roll-prompt-formula")).toBe("2d6");
		expect(text(root, ".stonetop-roll-prompt-stat")).toBe("");
	});

	it("holds the modes until a stat is picked", async () => {
		const root = await rendered();
		const modes = [...root.querySelectorAll(".form-footer button")];
		expect(modes.every(b => b.disabled)).toBe(true);
		choose(root, "int");
		expect(modes.some(b => b.disabled)).toBe(false);
	});

	it("states the formula of the stat picked", async () => {
		const root = await rendered();
		choose(root, "dex");
		expect(text(root, ".stonetop-roll-prompt-formula")).toBe("2d6 − 1");
		expect(text(root, ".stonetop-roll-prompt-stat")).toBe("DEX");
	});

	// The default button is disabled until then, so core's autofocus lands nowhere; the dropdown takes it.
	it("starts focus on the dropdown", async () => {
		const root = await rendered();
		expect(document.activeElement).toBe(root.querySelector("select[name=stat]"));
	});

	it("answers with the stat picked and the mode clicked", async () => {
		answer = c => {
			const root = drawn(c);
			root.querySelector("select[name=stat]").value = "dex";
			return click(c, "dis", root);
		};
		expect(await makeDialog().pick(prompt())).toEqual(new RollChoice("dex", "dis"));
	});

	it("leaves a named-stat dialog's modes alone", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen));
		const root = drawn(config);
		config.render(new Event("render"), { element: root });
		expect([...root.querySelectorAll(".form-footer button")].some(b => b.disabled)).toBe(false);
	});
});

describe("RollModeDialog — reminders", () => {
	const notes = new RollModeNotes([new RollModeNote({ mode: "adv", source: "Township", clause: "you take ***advantage*** of it" })]);

	it("shows the move's reminders, as its row does", async () => {
		await makeDialog().pick(RollPrompt.forStat("Muster", int, { ...maelen, notes }));
		const lines = drawn(config).querySelectorAll(".stonetop-move-rollnotes .stonetop-move-rollnote");
		expect(lines).toHaveLength(1);
		expect(lines[0].textContent).toContain("Township");
		expect(lines[0].querySelector(".stonetop-move-rollnote-clause em, .stonetop-move-rollnote-clause strong")).not.toBeNull();
	});

	it("shows none when there are none", async () => {
		await makeDialog().pick(RollPrompt.forStat("Muster", int, maelen));
		expect(drawn(config).querySelector(".stonetop-move-rollnotes")).toBeNull();
	});
});

describe("RollModeDialog — the rule", () => {
	const notes = new RollModeNotes([new RollModeNote({ mode: "adv", source: "Township" })]);

	// It explains the modes, so it sits with them: the last thing before the buttons. On the formula
	// line it read as a note on the stat beside it.
	it("links the rule by its name, just above the modes", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, { ...maelen, rule }));
		const prompt = drawn(config).querySelector(".stonetop-roll-prompt");
		const button = prompt.lastElementChild.querySelector("[data-action=openRule]") ?? prompt.lastElementChild;
		expect(button.matches("[data-action=openRule]")).toBe(true);
		expect(button.type).toBe("button");
		expect(button.textContent.trim()).toBe("Advantage/Disadvantage");
		expect(button.title).toContain("Advantage/Disadvantage");
	});

	it("keeps it off the formula line", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, { ...maelen, rule }));
		expect(drawn(config).querySelector(".stonetop-roll-prompt-formula-line [data-action=openRule]")).toBeNull();
	});

	it("follows the move's reminders, which are about the same modes", async () => {
		await makeDialog().pick(RollPrompt.forStat("Muster", int, { ...maelen, notes, rule }));
		const root = drawn(config);
		const reminders = root.querySelector(".stonetop-move-rollnotes");
		const link = root.querySelector("[data-action=openRule]");
		expect(reminders.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it("opens the rule by its slug", async () => {
		const openRule = vi.fn();
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, { ...maelen, rule }), { openRule });
		config.actions.openRule();
		expect(openRule).toHaveBeenCalledWith("advantage-disadvantage");
	});

	it("draws no link when there is no rule to open", async () => {
		await makeDialog().pick(RollPrompt.forStat("Defy Danger", int, maelen));
		expect(drawn(config).querySelector("[data-action=openRule]")).toBeNull();
	});
});
