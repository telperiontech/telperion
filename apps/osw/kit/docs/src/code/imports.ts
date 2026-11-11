/** `import { a, b } from "<from>";` */
export const namedImport = (names: string[], from: string) => `import { ${names.join(', ')} } from "${from}";`;

/** `import "<from>";`, for modules imported for their side effect */
export const sideEffectImport = (from: string) => `import "${from}";`;
