import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { AtajoVisible } from '../../../core/services/atajos.service';

export interface AtajosAyudaDialogData {
  /** Atajos vigentes en la pantalla al abrir el diálogo (`AtajosService.listar()`). */
  atajos: readonly AtajoVisible[];
}

/** Lista de los atajos de teclado disponibles en la pantalla actual (se abre con `?`). */
@Component({
  selector: 'app-atajos-ayuda-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './atajos-ayuda-dialog.component.html',
  styleUrl: './atajos-ayuda-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtajosAyudaDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: AtajosAyudaDialogData) {}
}
