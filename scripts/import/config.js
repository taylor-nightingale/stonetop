import path from "path";

/** Root of the PrinceWitherdick fork we import book content from. Override with FORK_ROOT. */
export const FORK_ROOT = process.env.FORK_ROOT
	?? "/home/taylor/WebstormProjects/princewitherdick/stonetop";

/** Fork pack source directory. */
export function forkSrc(pack) {
	return path.join(FORK_ROOT, "packs", "src", pack);
}

/** Our pack source directory (what we generate + commit). */
export function ourSrc(pack) {
	return path.join(process.cwd(), "packs", "src", pack);
}
