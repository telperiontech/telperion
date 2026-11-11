/**
 * The preview page is copied next to this remote's chunks (`preview/`), on the remote's own origin.
 *
 * `__webpack_public_path__` cannot locate it: inside the shell, webpack's automatic public path
 * falls back to the page's last `<script>`, which belongs to the shell. The URL of the ES module
 * chunk this code runs in does, so webpack is told to leave `import.meta.url` untouched in this
 * file (see `keepRuntimeImportMeta` in webpack.config.ts) instead of inlining the source path.
 */
export const previewUrl = (): string => new URL('preview/index.html', import.meta.url).href;
