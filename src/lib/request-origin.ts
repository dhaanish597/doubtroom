export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  // Next can normalize a loopback IP to localhost. Preserve the browser's cookie origin.
  if (host && /^(?:[a-z\d.-]+|\[[a-f\d:]+\])(?::\d{1,5})?$/i.test(host)) {
    try {
      return new URL(`${url.protocol}//${host}`).origin;
    } catch {
      // Fall back to the origin from Next's validated request URL.
    }
  }
  return url.origin;
}
