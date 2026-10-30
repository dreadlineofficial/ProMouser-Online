/* Picks the backend: Supabase when supabase-config.js has keys, otherwise the local demo. */
const c = window.PMO_SUPABASE || {};
export const { api } = (c.url && c.anonKey) ? await import('./api-sb.js') : await import('./api-demo.js');
