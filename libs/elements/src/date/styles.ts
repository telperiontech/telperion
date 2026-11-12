import { css } from "lit";

export const dateStyles = css`
  :host {
    display: inline;
  }

  :host([hidden]) {
    display: none;
  }

  /* Tabular digits keep live dates from jittering as numbers change. */
  time {
    font-variant-numeric: var(--tp-date-numeric, tabular-nums);
  }
`;
