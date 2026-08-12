// Hand-written declarations for the framework-neutral policy module (it must
// stay plain .mjs so wrangler's esbuild AND the pre-merge guard's plain-Node
// vitest load the SAME file — the htmx precedent).
export declare function isFixtureCrate(crateName: string): boolean;
export declare function featuredIdFor(crateName: string): number;
