// A debility never stacks past disadvantage: it cancels advantage rather than compounding into it,
// and an already-hindered roll stays where it is. Shared by the character and steading debilities so
// the two can't drift apart.
export function hinderRollMode(rollMode) {
	return rollMode === "adv" ? "normal" : "dis";
}
