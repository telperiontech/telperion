// Loaded via dynamic import from main.ts: shared federated modules such as `@osw/core`
// can only be consumed behind this async boundary, never from main.ts directly.
import { defineOswElements, interceptLinks } from '@osw/core';
import { startTracking } from './analytics/tracking';
import { trackPageHead } from './page-head';
import { defineRemoteElement } from './remote-element';
import { REMOTES } from './remotes';

// Shared custom elements and client-side navigation for plain `<a href>` links in every remote
defineOswElements();
interceptLinks();

// Canonical URL and default description per page, before remotes mount and override the description
trackPageHead();

// Page views and 404s; remotes report their own events through `trackEvent` from `@osw/core`
startTracking();

// One element per entry of config/remotes.json; its route is already in the router (see main.ts)
REMOTES.forEach((remote) => defineRemoteElement(remote.tagName, remote.module));

export {};
