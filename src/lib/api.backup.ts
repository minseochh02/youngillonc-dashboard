// src/lib/api.ts
const basePath = process.env.NEXT_PUBLIC_EGDESK_BASE_PATH || '';

export async function apiFetch(path: string, options?: RequestInit) {
  // Automatically prepend basePath to relative URLs
  const url = path.startsWith('/') && !path.startsWith('//')
    ? `${basePath}${path}`
    : path;
  return fetch(url, options);
}
