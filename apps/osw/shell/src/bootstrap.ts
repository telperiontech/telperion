// Loaded via dynamic import from main.ts: shared federated modules such as `@osw/core`
// can only be consumed behind this async boundary, never from main.ts directly.
import { defineOswElements, interceptLinks } from '@osw/core';
import { startTracking } from './analytics/tracking';
import { defineRemoteElement } from './remote-element';

// Shared custom elements and client-side navigation for plain `<a href>` links in every remote
defineOswElements();
interceptLinks();

// Page views and 404s; remotes report their own events through `trackEvent` from `@osw/core`
startTracking();

defineRemoteElement('osw-home', 'osw/home/Home');
defineRemoteElement('osw-js-utils', 'osw/js-utils/Docs');
defineRemoteElement('osw-paintlet', 'osw/paintlet/Docs');
defineRemoteElement('osw-elements', 'osw/elements/Docs');

export {};
