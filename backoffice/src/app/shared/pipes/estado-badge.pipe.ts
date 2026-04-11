import { Pipe, PipeTransform } from '@angular/core';
import { TramiteEstado } from '../../core/models/tramite.model';

@Pipe({ name: 'estadoBadge', standalone: true })
export class EstadoBadgePipe implements PipeTransform {
  private readonly labels: Record<TramiteEstado, string> = {
    borrador: 'Borrador',
    revision: 'En revisión',
    publicado: 'Publicado',
    despublicado: 'Despublicado',
  };

  transform(estado: TramiteEstado): string {
    return this.labels[estado] || estado;
  }
}
