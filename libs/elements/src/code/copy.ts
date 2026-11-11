/**
 * Writes `text` to the clipboard. Prefers the async Clipboard API and falls
 * back to `document.execCommand("copy")` (insecure contexts, older browsers).
 *
 * @returns `true` when the text was copied.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);

      return true;
    }
  } catch {
    /* permission denied / insecure context — try the legacy path */
  }

  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);

  try {
    textarea.select();

    return document.execCommand?.("copy") ?? false;
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
