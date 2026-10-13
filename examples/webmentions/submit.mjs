/** Operator-only example. Endpoint discovery and live-backlink review are separate. */
export async function submitWebmention({ source, target, endpoint, authorized, publishedBacklinkChecked }, fetchImpl = fetch) {
  if (authorized !== true || publishedBacklinkChecked !== true) {
    throw new Error('Explicit sending authority and a checked live source backlink are required.');
  }
  for (const value of [source, target, endpoint]) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('Use reviewed public HTTPS URLs without credentials.');
    }
  }
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ source, target }).toString(),
    redirect: 'error',
    credentials: 'omit',
    signal: AbortSignal.timeout(10000),
  });
  return {
    status: response.status,
    outcome: response.status === 202 ? 'accepted-for-processing' : response.ok ? 'accepted' : 'failed',
    // Success is not evidence that the recipient has verified or displayed a reply.
    displayed: 'unverified',
    location: response.headers.get('location'),
  };
}
