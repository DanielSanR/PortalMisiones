import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { Tramite } from '../../../core/models/tramite.model';

@Component({
  selector: 'app-tramite-preview',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
  ],
  templateUrl: './tramite-preview.component.html',
  styleUrls: ['./tramite-preview.component.scss'],
})
export class TramitePreviewComponent {
  viewMode: 'desktop' | 'mobile' = 'desktop';

  constructor(
    public dialogRef: MatDialogRef<TramitePreviewComponent>,
    @Inject(MAT_DIALOG_DATA) public tramite: Tramite,
  ) {}
}
