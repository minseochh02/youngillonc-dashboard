/** Appends `includeVat` to a URL that may already have a query string. */
export function withIncludeVat(url: string, includeVat: boolean): string {
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}includeVat=${includeVat}`;
}
