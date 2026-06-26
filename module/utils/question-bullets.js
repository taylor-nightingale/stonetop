// A list item counts as a question if its text ends in "?", allowing trailing
// closing quotes/brackets (e.g. "…Or what?)"). Kept identical to the gazetteer
// generator's baked-in test (scripts/local/shared/gazetteer.mjs) so runtime
// marking and pre-baked content agree.
export const QUESTION_END = /\?["'’)\]]*\s*$/;

/**
 * Marks <li> elements whose text poses a question with the "question-bullet"
 * class, so CSS can swap in the question-spiral icon.
 * @param {Element} root
 */
export function markQuestionBullets(root) {
	root.querySelectorAll("li").forEach(li => {
		li.classList.toggle("question-bullet", QUESTION_END.test(li.textContent.trim()));
	});
}
