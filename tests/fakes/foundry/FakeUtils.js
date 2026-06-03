export function setPath(obj, path, value) {
	const parts = path.split(".");
	let target = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		if (target[parts[i]] === undefined || target[parts[i]] === null) {
			target[parts[i]] = {};
		}
		target = target[parts[i]];
	}
	target[parts[parts.length - 1]] = value;
}

export function getPath(obj, path) {
	return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

export function deletePath(obj, path) {
	const parts = path.split(".");
	const parent = parts.slice(0, -1).reduce((acc, key) => acc?.[key], obj);
	if (parent !== undefined && parent !== null) {
		delete parent[parts[parts.length - 1]];
	}
}
