/**
 * Resolve the trusted "address" (Mumble server host) for the connect dialog.
 *
 * The `address` URL query parameter is attacker-controllable via a crafted
 * link (e.g. `?address=evil.example.com`) and, if used unchecked, could
 * redirect the app's streaming WebSocket connection to a server the
 * attacker controls (CWE-346 / connection hijacking). A configured
 * `defaultAddress` (e.g. `mumbleWebConfig.defaults.address`) is set by the
 * deployment operator and is always trusted, even if it differs from the
 * page's own hostname (e.g. a dedicated Mumble host).
 *
 * @param {string|null|undefined} addressFromQuery - raw `?address=` value from the URL,
 *   or null/undefined/empty if not present in the query string
 * @param {string|undefined} defaultAddress - operator-configured default address
 * @param {string[]} allowedHosts - hosts the query param is allowed to target
 * @returns {{ address: string|undefined, rejected: boolean }}
 *   `address`: the value to apply (undefined means "leave unchanged")
 *   `rejected`: true if an untrusted query override was ignored
 */
export function resolveConnectAddress(addressFromQuery, defaultAddress, allowedHosts) {
  if (!addressFromQuery) {
    return { address: defaultAddress, rejected: false };
  }
  if (allowedHosts.includes(addressFromQuery)) {
    return { address: addressFromQuery, rejected: false };
  }
  return { address: undefined, rejected: true };
}
