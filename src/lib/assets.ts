import {getStaticFiles} from 'remotion';

let cache: Set<string> | null = null;

/** True if /public/<path> exists. Lets missing footage render as a labelled placeholder. */
export function hasFile(path: string): boolean {
	if (!cache) cache = new Set(getStaticFiles().map((f) => f.name));
	return cache.has(path);
}

export function firstExisting(paths: string[]): string | null {
	return paths.find(hasFile) ?? null;
}
