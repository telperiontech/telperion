import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The main screen: packages and the gaps in their release chains. Empty until packages are configured. */
@Component({
  selector: 'bcn-overview',
  templateUrl: './overview.html',
  styleUrl: './overview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Overview {}
