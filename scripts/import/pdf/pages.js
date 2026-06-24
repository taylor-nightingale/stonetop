/** Format a set of printed page numbers, collapsing consecutive runs: [22,23,24,25] → "22-25". */
export function formatPageRange(nums) {
	const s = [...new Set(nums.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
	const out = [];
	for (let i = 0; i < s.length; ) {
		let j = i;
		while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
		out.push(i === j ? `${s[i]}` : `${s[i]}-${s[j]}`);
		i = j + 1;
	}
	return out.join(", ");
}
