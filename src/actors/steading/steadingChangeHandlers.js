/**
 * Every `data-change-action` the steading templates emit, mapped to the ONE named method on the
 * typed steading that persists it.
 *
 * Replaces ~30 per-render `bindAll` calls: those re-bound every control on every render and
 * addressed them by CSS class, so a template restyle could silently unwire the sheet.
 *
 * @param s               the typed StonetopSteading.
 * @param availableSteadfasts  () => the steadfast list the name box resolves a typed name against.
 */
export function steadingChangeHandlers(s, { availableSteadfasts }) {
	return {
		// The typed steading decides whether a value applies a steadfast or just renames.
		steadfastName: el => s.renameOrApplySteadfast(el.value, availableSteadfasts()),
		rollMode: el => s.setRollMode(el.value),
		notes:    el => s.setNotes(el.value),

		// Fortunes / surplus
		fortunes: el => s.setFortunes(parseInt(el.value)),
		surplus:  el => s.setSurplus(parseInt(el.value) || 0),

		// Attributes: ratings store a number, size stores its tier string.
		attribute: el => {
			const { attr } = el.dataset;
			return s.setAttribute(attr, attr === "size" ? el.value : parseInt(el.value));
		},
		attributeItem: el => s.updateAttributeItem(el.dataset.attr, el.dataset.index, el.value),

		debility:    el => s.setDebility(el.dataset.slug, el.checked),
		contentText: el => s.updateContentText(el.dataset.type, el.value),

		// Assets + coinage
		assetItem:       el => s.updateAssetItem(parseInt(el.dataset.index), el.value),
		coinagePurses:   el => s.updateCoinagePurses(el.dataset.title, parseInt(el.value) || 0),
		coinageHandfuls: el => s.updateCoinageHandfuls(el.dataset.title, parseInt(el.value) || 0),
		coinageCoins:    el => s.updateCoinageCoins(el.dataset.title, parseInt(el.value) || 0),

		// Residents
		residentName:         el => s.updateResidentName(el.dataset.id, el.value),
		residentOccupation:   el => s.updateResidentOccupation(el.dataset.id, el.value),
		residentTraits:       el => s.updateResidentTraits(el.dataset.id, el.value),
		// Residents owns the one-per-line parse.
		residentTraitsSource: el => s.updateResidentTraitsSource(el.value),

		// Neighbors — people and places
		neighborName:       el => s.updateNeighborName(el.dataset.id, el.value),
		neighborOccupation: el => s.updateNeighborOccupation(el.dataset.id, el.value),
		neighborTraits:     el => s.updateNeighborTraits(el.dataset.id, el.value),
		neighborHome:       el => s.updateNeighborHome(el.dataset.id, el.value),
		neighborPlaceNote:  el => s.updateNeighborPlaceNote(el.dataset.id, el.value),

		// Places of Interest
		placeField: el => s.setPlaceValue(parseInt(el.dataset.index), el.value),
	};
}
