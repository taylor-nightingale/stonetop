import { QUESTION_END } from "./question-bullets.js";

// The Character Creation FAQ renders each Q&A as a single
// `<p><strong>Question?</strong><br>Answer…</p>` block (see onboarding-faq.js).
// Those aren't list items, so the spiral-bullet list CSS never reaches them —
// tag each with `faq-item` so CSS can hang one spiral bullet beside the pair,
// shared by the bold question and the answer below it.
//
// A paragraph qualifies only when its very first node is a <strong> whose text
// reads as a question (ends in "?"). That's exactly the FAQ pattern and nothing
// else this system ships: other prose opens <p><strong>…</strong> runs too (the
// place-name links in the Setting Overview), but those leads never end in "?".
// Section <h3> headers and the intro paragraph carry no such lead, so they stay
// unmarked — and get no bullet. Idempotent.

/** @param {Element} root */
export function markFaqItems(root) {
	if (!root?.querySelectorAll) return;
	root.querySelectorAll("p").forEach(p => {
		// firstChild having a STRONG tagName means the bold run is the paragraph's
		// very first node (text/element nodes that aren't a leading <strong> fail
		// this) — i.e. the bold question is the lead, not an inline bold mid-answer.
		const lead = p.firstChild;
		const isFaq = lead?.tagName === "STRONG"
			&& QUESTION_END.test((lead.textContent ?? "").trim());
		p.classList.toggle("faq-item", !!isFaq);
	});
}
