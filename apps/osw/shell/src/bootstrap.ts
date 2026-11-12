// Loaded via dynamic import from main.ts: shared federated modules such as `@osw/core`
// can only be consumed behind this async boundary, never from main.ts directly.
import { defineOswElements, interceptLinks } from '@osw/core';
import { defineRemoteElement } from './remote-element';

// Shared custom elements and client-side navigation for plain `<a href>` links in every remote
defineOswElements();
interceptLinks();

defineRemoteElement('osw-home', 'osw/home/Home');
defineRemoteElement('osw-js-utils', 'osw/js-utils/Docs');
defineRemoteElement('osw-paintlet', 'osw/paintlet/Docs');
defineRemoteElement('osw-elements', 'osw/elements/Docs');

export {};
