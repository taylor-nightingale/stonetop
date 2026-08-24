/**
 * Click handler for a tag rendered by `tag-list.hbs`.
 *
 * The hover tooltip is Foundry's, and Foundry binds it to pointer events only — a keyboard user
 * focusing the tag never sees it. Activating the same tooltip from the action gives the definition
 * to a click and to Enter/Space on the focused tag alike, which is why the tag is a real button.
 *
 * Not `editOnly`: reading what a tag means is not an edit, and the tag carries `data-view-state` so
 * it stays live on a locked sheet.
 */
export const TAG_DEFINITION_ACTIONS = {
	showTagDefinition: function (ev, target) {
		const text = target?.dataset?.definition;
		if (!text) return;
		// No `direction`: Foundry places `data-tooltip` on hover by whichever side has room, so naming
		// one here made a click jump the tooltip from below the tag to above it. Letting core decide
		// puts the click and the hover in the same place.
		game.tooltip?.activate(target, { text });
	},
};
