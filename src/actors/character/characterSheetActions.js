import { editOnly, confirmedDelete } from "../../utils/sheetActions.js";
import { InventoryOwner } from "./InventoryOwner.js";

/**
 * The character sheet's two flat action tables.
 *
 * Both are pure element→domain-method routing with no dependency on sheet state, so they live here
 * rather than in the sheet's own actions map alongside the view-state toggles (which do reach into
 * sheet fields).
 */

// A pip button carries its position and its CURRENT state; the domain does the ±1 math from there.
// resource-track.hbs is what stamps `data-index` and the `is-checked` class.
const pipIndex   = target => target.dataset.index;
const pipChecked = target => target.classList.contains("is-checked");

export const PIP_ACTIONS = {
	possessionUsePip: editOnly(function (ev, target) {
		return this._stonetopCharacter.togglePossessionUsePip(
			target.dataset.possessionSlug, target.dataset.choiceSlug ?? null,
			pipIndex(target), pipChecked(target));
	}),
	inventoryResourcePip: editOnly(function (ev, target) {
		return this._stonetopCharacter.toggleInventoryResourcePipFor(
			InventoryOwner.fromElement(target), target.dataset.slug,
			pipIndex(target), pipChecked(target));
	}),
	arcanumResourcePip: editOnly(function (ev, target) {
		return this._stonetopCharacter.toggleArcanumResourcePip(
			target.dataset.slug, pipIndex(target), pipChecked(target));
	}),
	backgroundResourcePip: editOnly(function (ev, target) {
		return this._stonetopCharacter.toggleBackgroundResourcePip(
			target.dataset.slug, pipIndex(target), pipChecked(target));
	}),
	followerLoyaltyPip: editOnly(function (ev, target) {
		return this._stonetopCharacter.toggleFollowerLoyaltyPip(
			target.dataset.slug, pipIndex(target), pipChecked(target));
	}),
};

// Click confirms, right-click skips.
export const DELETE_ACTIONS = {
	deleteArcanum: confirmedDelete(function (target) {
		return this._stonetopCharacter.removeArcanum(target.dataset.slug);
	}),
	deletePossession: confirmedDelete(function (target) {
		return this._stonetopCharacter.deletePossession(target.dataset.slug);
	}),
	deleteFollower: confirmedDelete(function (target) {
		return this._stonetopCharacter.removeFollower(target.dataset.slug);
	}),
	deleteOtherMove: confirmedDelete(function (target) {
		return this._stonetopCharacter.deleteMove(target.dataset.moveSlug);
	}),
	deleteInventoryItem: confirmedDelete(function (target) {
		return this._stonetopCharacter.removeCustomInventoryItemFor(
			InventoryOwner.fromElement(target), target.dataset.ownedId);
	}),
};
