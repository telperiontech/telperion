# Accessibility

Several packages in this repository render UI, most notably `@telperion/elements` (web components), `@telperion/ng-ui` (Angular components) and the OSW applications. We want everything we ship to be usable by as many people as possible, including people who rely on assistive technologies.

## Our Commitment

We aim for UI components to conform to [WCAG 2.2](https://www.w3.org/TR/WCAG22/) Level AA and to follow the [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/). In practice, we strive for:

- Full keyboard operability with visible focus indicators
- Correct semantics and ARIA roles, states and properties
- Compatibility with common screen readers
- Sufficient color contrast, and respect for `prefers-reduced-motion` and `prefers-color-scheme`
- Layouts that keep working with zoom and text resizing

We treat an accessibility barrier as a bug.

## Supported Environments

UI packages target the latest two versions of evergreen browsers (Chrome, Edge, Firefox, Safari). We aim to support common assistive technologies on those browsers, such as NVDA and JAWS on Windows and VoiceOver on macOS and iOS.

## Known Limitations

Not every component has been audited yet. Decorative or experimental features (for example, animated paintlet backgrounds) may not yet fully respect user motion preferences. Known issues are tracked on GitHub with the `accessibility` label.

## Reporting Barriers

If you encounter an accessibility barrier, please [open an issue](https://github.com/telperiontech/telperion/issues/new/choose) and mention "accessibility" in the title. Helpful details include:

- The affected package and component
- What you were trying to do and what happened instead
- Your browser, operating system and assistive technology (with versions)

## Contributing

When contributing UI changes, please test keyboard navigation and screen reader output, and mention any accessibility considerations in your pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for general guidelines.
