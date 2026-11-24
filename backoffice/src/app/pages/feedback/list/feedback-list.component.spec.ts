import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { FeedbackFacade, FeedbackPageVM, FeedbackStatsVM } from '@features/feedback';
import { CuentaFacade } from '@features/cuenta';
import { FeedbackListComponent } from './feedback-list.component';

/** Paginado en servidor (no va sobre `ListaCliente`): el tamaño inicial sale de "Filas por página". */
describe('FeedbackListComponent — tamaño de página', () => {
  const PAGINA: FeedbackPageVM = { items: [], total: 75 };
  const STATS: FeedbackStatsVM = { total: 75, totalUtil: 70, totalNoUtil: 5, totalConComentario: 0, porcentajeUtil: 93 };
  let list: jasmine.Spy;

  function montar(filasPorPagina: number): FeedbackListComponent {
    list = jasmine.createSpy('list').and.returnValue(of(PAGINA));
    TestBed.configureTestingModule({
      imports: [FeedbackListComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: FeedbackFacade, useValue: { list, getStats: () => of(STATS) } },
        { provide: CuentaFacade, useValue: { filasPorPagina } },
      ],
    });
    const fixture = TestBed.createComponent(FeedbackListComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('la primera carga pide tantas filas como dice la preferencia "Filas por página"', () => {
    const lista = montar(50);
    expect(lista.pageSize).toBe(50);
    expect(list).toHaveBeenCalledOnceWith(jasmine.objectContaining({ page: 1, pageSize: 50 }));
  });

  it('después el paginador sigue mandando: cambiar de página y tamaño pide con esos valores', () => {
    const lista = montar(20);
    lista.onPageChange({ pageIndex: 2, pageSize: 10 });
    expect(list).toHaveBeenCalledWith(jasmine.objectContaining({ page: 3, pageSize: 10 }));
  });
});
