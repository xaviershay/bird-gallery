/// <reference types="@cloudflare/workers-types" />
/// <reference types="vitest/globals" />

// Add type declaration for raw SQL imports
declare module '*.sql?raw' {
    const content: string;
    export default content;
}

declare module 'cloudflare:test' {
	interface ProvidedEnv extends Env {
		DB: D1Database;
	}
}