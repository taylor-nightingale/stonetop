/**
 * The image-picker action shared by every Stonetop sheet with a portrait or icon.
 *
 * Core's own `editImage` handler throws for any target that is not an IMG, but a bare `<img>`
 * carrying `[data-action]` is keyboard-dead — core binds only click, so the picker would be
 * mouse-only. The templates therefore wrap the image in a real `<button>`, and this action resolves
 * the wrapped `img[data-edit]` before handing it to core's handler unchanged.
 *
 * The `data-edit` attribute has to stay on the IMG for the same reason it cannot be on the button:
 * FormDataExtended folds every `[data-edit]` element into the submit payload, reading an IMG's
 * `src` but any other element's innerHTML. It is also what persists the pick — core's picker
 * callback assigns the chosen path to `target.src`, which the next submit reads back as `img`.
 */

function coreEditImage() {
	const handler = foundry.applications.api.DocumentSheetV2.DEFAULT_OPTIONS.actions?.editImage;
	if (!handler) throw new Error("Core's editImage action is unavailable.");
	return handler;
}

export const EDIT_IMAGE_ACTIONS = {
	editImage(ev, target) {
		const image = target.nodeName === "IMG" ? target : target.querySelector("img[data-edit]");
		if (!image) throw new Error("editImage needs an img[data-edit] inside the control that fired it.");
		return coreEditImage().call(this, ev, image);
	},
};
