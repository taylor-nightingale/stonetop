import { rich } from "./RichText.js";

export function documentLink(uuid) {
	return uuid ? rich(`@UUID[${uuid}]`) : null;
}
