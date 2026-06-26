const PREFIX = "Stonetop |";

function makeLogger(consoleFn, prefixColor) {
	return (...args) => consoleFn(
		`%c${PREFIX}%c ${args.join(" ")}`,
		`font-weight: bold; color: ${prefixColor};`,
		"",
	);
}

export const info = makeLogger(console.log, "hsl(210, 60%, 50%)");
export const warn = makeLogger(console.warn, "hsl(40, 80%, 45%)");
export const error = makeLogger(console.error, "hsl(350, 73%, 45%)");
