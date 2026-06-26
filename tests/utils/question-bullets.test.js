import { describe, expect, it } from "vitest";
import { markQuestionBullets } from "../../module/utils/question-bullets.js";

// markQuestionBullets walks the DOM, but the test env is node (no DOM), so use a
// tiny fake <li>/root that exposes just what the function touches: textContent
// and a classList.toggle(name, force).
function makeLi(text) {
	const classes = new Set();
	return {
		textContent: text,
		classList: {
			toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)),
			contains: (name) => classes.has(name),
		},
		get marked() { return classes.has("question-bullet"); },
	};
}

function markAll(...texts) {
	const lis = texts.map(makeLi);
	markQuestionBullets({ querySelectorAll: () => lis });
	return lis;
}

describe("markQuestionBullets", () => {
	it("marks list items that end in a question mark", () => {
		const [li] = markAll("Who will fight for the village?");
		expect(li.marked).toBe(true);
	});

	it("leaves statements unmarked", () => {
		const [li] = markAll("Begin and end with the fiction.");
		expect(li.marked).toBe(false);
	});

	it("treats a question closed by brackets/quotes as a question", () => {
		const [paren, quote] = markAll("A council of elders? Or what?)", 'they ask "what now?"');
		expect(paren.marked).toBe(true);
		expect(quote.marked).toBe(true);
	});

	it("does not treat a mid-sentence question mark as a question bullet", () => {
		const [li] = markAll("Is it raining? Probably not.");
		expect(li.marked).toBe(false);
	});

	it("clears a stale marking when the text is no longer a question", () => {
		const li = makeLi("No longer a question.");
		li.classList.toggle("question-bullet", true);
		markQuestionBullets({ querySelectorAll: () => [li] });
		expect(li.marked).toBe(false);
	});
});
