// A minimal GitHub REST client for Beacon's scripts. The token only ever goes
// into the Authorization header: errors name the request and GitHub's message,
// never the headers.

/** A failed GitHub API request. */
export class GitHubError extends Error {
  constructor(method, path, status, message) {
    super(`${method} ${path} -> ${status}${message ? `: ${message}` : ''}`);
    this.status = status;
  }
}

/**
 * @param {string} token an installation (or other) access token
 * @param {string} [baseUrl] REST API root, e.g. for GitHub Enterprise Server
 */
export function githubRest(token, baseUrl = 'https://api.github.com') {
  const request = async (method, path, body) => {
    const res = await fetch(baseUrl + path, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'beacon-scripts',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw new GitHubError(method, path, res.status, data?.message);
    return data;
  };

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    delete: (path) => request('DELETE', path),
  };
}
