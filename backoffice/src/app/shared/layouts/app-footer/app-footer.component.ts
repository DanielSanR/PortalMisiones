import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UnavailableDirective } from '../../directives/unavailable.directive';
import { APP_VERSION } from '../../../core/constants/app-info.constants';

/** Pie del shell: © · Sugerencias · Soporte ········· versión · Digital Factory. */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [UnavailableDirective],
  templateUrl: './app-footer.component.html',
  styleUrl: './app-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppFooterComponent {
  readonly anioActual = new Date().getFullYear();
  readonly appVersion = APP_VERSION;
}
