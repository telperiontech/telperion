// Add explicit types for import.meta.env used in the browser app
// Extend this with specific keys you expect to use (like OSW_HOME)

declare global {
  interface ImportMetaEnv {
    // Example public env variables (add your project keys here)
    readonly OSW_HOME?: string;

    // Allow other string keys (optional)
    readonly [key: string]: string | undefined;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    /** gtag.js command queue; `window.gtag` itself is declared by `@osw/core` */
    dataLayer: unknown[];
  }
}

export {};
