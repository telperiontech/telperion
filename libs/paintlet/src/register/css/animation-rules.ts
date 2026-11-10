import { assertDashedIdent, assertIdent } from '../validate-ident';

/**
 * Builds the rules for looping animations, one CSS rule per string:
 * - `@keyframes <animationName>` animating `<propertyName>` from 0 to 100
 * - `@function --<animationName>(--seconds <time>)` returning the animation shorthand
 */
export function createAnimationRules(animations: Readonly<Record<string, string>>): string[] {
  return Object.entries(animations).flatMap(([animationName, propertyName]) => {
    assertIdent(animationName, 'animation name');
    assertDashedIdent(propertyName, 'animated property');

    return [
      `@keyframes ${animationName} { from { ${propertyName}: 0; } to { ${propertyName}: 100; } }`,
      `@function --${animationName}(--seconds <time>) { result: ${animationName} var(--seconds, 1s) linear infinite; }`,
    ];
  });
}
