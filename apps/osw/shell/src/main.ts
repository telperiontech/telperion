import { registerRemotes } from '@module-federation/enhanced/runtime';
import { startAnalytics } from './analytics';
import { renderRemoteRoutes } from './remotes';

// First, and independent of the remotes: a failing manifest must not hide the visit
startAnalytics();

// Before `<tp-router>` is defined below, so it starts with every remote's route
renderRemoteRoutes();

/** Imports the shared elements one by one, so a failing one is logged instead of blocking the others */
const defineSharedElements = () =>
  Promise.allSettled([
    import('@telperion/elements/router'),
    // Registers <tp-icon>, used by the home remote (which compiles with Babel and can't parse Lit decorators)
    import('@telperion/elements/icon'),
    // Registers the header/footer outlets in index.html and the <tp-portal> remotes render into them
    import('@telperion/elements/portal'),
    // Registers <tp-code> for every remote's code samples; Shiki grammars load lazily per language
    import('@telperion/elements/code'),
    // Registers <tp-mermaid> for diagrams in docs; Mermaid itself loads on the first diagram
    import('@telperion/elements/mermaid'),
    // Registers <tp-date> for the footer's copyright year
    import('@telperion/elements/date'),
  ]).then((results) =>
    results.forEach((result) => result.status === 'rejected' && console.error(result.reason))
  );

// Every step logs its failure and the next one still runs: an unreachable remote must break only its
// own pages, never leave the whole shell (router, header, other remotes) unrendered
fetch('/assets/module-federation.manifest.json')
  .then((res) => res.json())
  .then((remotes: Record<string, string>) =>
    registerRemotes(Object.entries(remotes).map(([name, entry]) => ({ name, entry })))
  )
  .catch((err) => console.error('Error registering remotes:', err))
  .then(defineSharedElements)
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));
