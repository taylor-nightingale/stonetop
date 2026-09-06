/**
 * One render of a sheet's root part, in the order ApplicationV2 does it.
 *
 * The order is the point. Core captures the prior state (focus, scroll) BEFORE the tree is replaced
 * and puts it back in _syncPartState, which is also where the sheet restores everything the reader
 * opened, filtered or folded — because that is what decides how tall the part is. A test that swaps
 * innerHTML and calls _onRender alone proves nothing about a scroll position, and would have agreed
 * happily with the bug that made a ticked checkbox throw the view hundreds of pixels.
 *
 * The root-part case, which is what every Stonetop sheet declares: the root element persists and its
 * children are replaced, so core hands the same element in as both the new and the prior one.
 *
 * @param {object} sheet      the sheet under test, already holding its root element
 * @param {string} html       the freshly rendered markup for the part
 * @param {boolean} first     a first render — no prior tree to sync against, so core fires
 *                            _onFirstRender instead
 * @param {Function} beforeSync  called with the swapped-in tree before the sync runs — the seam for
 *                            a test that needs to see the part the way core is about to measure it
 * @returns {HTMLElement}     the sheet's root, rendered
 */
export async function renderSheetPart(sheet, html, { first = false, partId = "form", beforeSync } = {}) {
	const root = sheet.element;
	const state = {};
	if (!first) sheet._preSyncPartState(partId, root, root, state);
	root.innerHTML = html;
	beforeSync?.(root);
	if (first) await sheet._onFirstRender({}, {});
	else sheet._syncPartState(partId, root, root, state);
	sheet._onRender({}, {});
	return root;
}
