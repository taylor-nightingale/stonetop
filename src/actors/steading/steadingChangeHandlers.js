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

		// The three content-policy lists. Keyed by section slug + row index, the same pair the
		// ratings lists use — an entry is a line in a list, not a field with a name of its own.
		contentItem: el => s.updateContentItem(el.dataset.slug, el.dataset.index, el.value),

		// Assets + coinage
		assetItem:          el => s.updateAssetItem(parseInt(el.dataset.index), el.value),
		assetRequisitioned: el => s.setAssetRequisitioned(parseInt(el.dataset.index), el.checked),
		coinagePurses:   el => s.updateCoinagePurses(el.dataset.title, parseInt(el.value) || 0),
		coinageHandfuls: el => s.updateCoinageHandfuls(el.dataset.title, parseInt(el.value) || 0),
		coinageCoins:    el => s.updateCoinageCoins(el.dataset.title, parseInt(el.value) || 0),

		// Folk — one roster; a blank home means this steading.
		personName:       el => s.updatePersonName(el.dataset.id, el.value),
		personOccupation: el => s.updatePersonOccupation(el.dataset.id, el.value),
		personTraits:     el => s.updatePersonTraits(el.dataset.id, el.value),
		personHome:       el => s.updatePersonHome(el.dataset.id, el.value),
		// Folk owns the one-per-line parse.

		// Neighboring places. Size is definitional and edited on the steadfast item sheet, so the
		// steading emits no action for it — it reads the word and nothing more.
		neighborPlaceNote:   el => s.updateNeighborPlaceNote(el.dataset.id, el.value),
		neighborPlaceTravel: el => s.updateNeighborPlaceTravel(el.dataset.id, el.value),

		// Places of Interest
		placeField: el => s.setPlaceValue(parseInt(el.dataset.index), el.value),
	};
}
