/**
 * Proxies a narrow slice of the GitHub REST API for the AI Social in-app
 * feedback/bug-report tool. The GitHub PAT lives only as a Worker secret —
 * it is never shipped inside the Android app. The app instead sends a
 * lightweight shared secret (X-App-Secret) that is far cheaper to rotate
 * than a repo-scoped GitHub token if it ever leaks from a decompiled APK.
 *
 * Only requests that match one of ALLOWED_ROUTES, for the configured
 * owner/repo, are forwarded to api.github.com.
 */

export interface Env {
  GITHUB_TOKEN: string;
  APP_SHARED_SECRET: string;
  ALLOWED_OWNER: string;
  ALLOWED_REPO: string;
}

type Route = {
  method: string;
  // Matches the path AFTER /repos/{owner}/{repo}/
  pattern: RegExp;
};

const ALLOWED_ROUTES: Route[] = [
  { method: 'POST', pattern: /^issues$/ },
  { method: 'GET', pattern: /^issues\/\d+$/ },
  { method: 'GET', pattern: /^issues\/\d+\/comments$/ },
  { method: 'POST', pattern: /^issues\/\d+\/comments$/ },
  // Screenshot uploads for feedback reports only — never arbitrary repo paths.
  { method: 'PUT', pattern: /^contents\/feedback-assets\/[\w.\-]+$/ },
];

const GITHUB_API = 'https://api.github.com';

// Labels the client is allowed to attach when creating an issue (used by the
// in-app content-report feature). Anything else supplied by the client is
// dropped server-side so a modified/decompiled app can't inject arbitrary
// labels (e.g. spoofing priority/triage labels).
const ALLOWED_ISSUE_LABELS = new Set([
  'content-report',
  'reason:offensive',
  'reason:factually-wrong',
  'reason:broken-garbled',
  'reason:other',
]);

async function sanitizeCreateIssueBody(request: Request): Promise<string> {
  const raw = await request.text();
  try {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    if (Array.isArray(payload.labels)) {
      payload.labels = payload.labels.filter(
        (label) => typeof label === 'string' && ALLOWED_ISSUE_LABELS.has(label),
      );
    }
    return JSON.stringify(payload);
  } catch {
    return raw;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  // Never branch on length: an early return there leaks the secret's length
  // via response timing. Compare over the longer length, padding the shorter
  // string's missing chars with a sentinel that can't equal a real char code.
  const len = Math.max(a.length, b.length);
  let result = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : -1;
    const cb = i < b.length ? b.charCodeAt(i) : -1;
    result |= ca ^ cb;
  }
  return result === 0;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.GITHUB_TOKEN || !env.APP_SHARED_SECRET) {
      return json({ message: 'Worker is not configured.' }, 500);
    }

    const suppliedSecret = request.headers.get('x-app-secret') ?? '';
    if (!timingSafeEqual(suppliedSecret, env.APP_SHARED_SECRET)) {
      return json({ message: 'Unauthorized' }, 401);
    }

    const url = new URL(request.url);
    const owner = env.ALLOWED_OWNER;
    const repo = env.ALLOWED_REPO;
    const prefix = `/repos/${owner}/${repo}/`;

    if (!url.pathname.startsWith(prefix)) {
      return json({ message: 'Not found' }, 404);
    }

    const subPath = url.pathname.slice(prefix.length);
    const routeMatches = ALLOWED_ROUTES.some(
      (route) => route.method === request.method && route.pattern.test(subPath),
    );
    if (!routeMatches) {
      return json({ message: 'Route not allowed' }, 403);
    }

    const isCreateIssue = request.method === 'POST' && subPath === 'issues';
    const body =
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : isCreateIssue
          ? await sanitizeCreateIssueBody(request)
          : request.body;

    const upstreamUrl = `${GITHUB_API}${url.pathname}${url.search}`;
    const upstreamRequest = new Request(upstreamUrl, {
      method: request.method,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AISocial-Feedback-Proxy',
        'Content-Type': request.headers.get('content-type') ?? 'application/json',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      },
      body,
    });

    const upstreamResponse = await fetch(upstreamRequest);
    const responseHeaders = new Headers();
    const contentType = upstreamResponse.headers.get('content-type');
    if (contentType) responseHeaders.set('content-type', contentType);

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  },
} satisfies ExportedHandler<Env>;
