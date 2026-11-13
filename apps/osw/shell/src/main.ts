import { registerRemotes } from '@module-federation/enhanced/runtime';
import { startAnalytics } from './analytics';

// First, and independent of the remotes: a failing manifest must not hide the visit
startAnalytics();

fetch('/assets/module-federation.manifest.json')
  .then((res) => res.json())
  .then((remotes: Record<string, string>) =>
    Object.entries(remotes).map(([name, entry]) => ({ name, entry }))
  )
  .then((remotes) => registerRemotes(remotes))
  .then(() => Promise.all([
    import('@telperion/elements/router'),
    // Registers <tp-icon>, used by the home remote (which compiles with Babel and can't parse Lit decorators)
    import('@telperion/elements/icon'),
    // Registers the header/footer outlets in index.html and the <tp-portal> remotes render into them
    import('@telperion/elements/portal'),
    // Registers <tp-code> for every remote's code samples; Shiki grammars load lazily per language
    import('@telperion/elements/code'),
    // Registers <tp-date> for the footer's copyright year
    import('@telperion/elements/date'),
  ]))
  .then(() => import('./bootstrap').catch((err) => console.error(err)));
