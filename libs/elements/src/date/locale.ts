/**
 * Resolves the locale for an element: its `locale` attribute, then the
 * nearest `lang` attribute (crossing shadow roots), then the browser default
 * (`undefined`). Invalid tags are skipped.
 */
export function resolveLocale(host: Element, explicit: string): string | undefined {
  return canonical(explicit) ?? canonical(closestLang(host));
}

function closestLang(host: Element): string {
  let node: Node | null = host;

  while (node) {
    if (node instanceof Element) {
      const lang = node.closest("[lang]")?.getAttribute("lang");

      if (lang) return lang;
    }

    const root = node.getRootNode();
    node = root instanceof ShadowRoot ? root.host : null;
  }

  return "";
}

function canonical(tag: string | null | undefined): string | undefined {
  if (!tag?.trim()) return undefined;

  try {
    return Intl.getCanonicalLocales(tag.trim())[0];
  } catch {
    return undefined;
  }
}
