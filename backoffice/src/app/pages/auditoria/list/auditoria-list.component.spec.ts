import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject, of } from 'rxjs';
import { AuditoriaFacade, AuditoriaPaginaVM } from '@features/auditoria';
import { CuentaFacade } from '@features/cuenta';
import { AuditoriaListComponent } from './auditoria-list.component';

/** Paginado en servidor (no va sobre `ListaCliente`): el tamaño inicial sale de "Filas por página". */
describe('AuditoriaListComponent — tamaño de página', () => {
  const PAGINA: AuditoriaPaginaVM = { registros: [], total: 120 };
  let loadPagina: jasmine.Spy;

  function montar(filasPorPagina: number): AuditoriaListComponent {
    loadPagina = jasmine.createSpy('loadPagina').and.returnValue(of(PAGINA));
    TestBed.configureTestingModule({
      imports: [AuditoriaListComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuditoriaFacade, useValue: { pagina$: new BehaviorSubject(PAGINA), loadPagina } },
        { provide: CuentaFacade, useValue: { filasPorPagina } },
      ],
    });
    const fixture = TestBed.createComponent(AuditoriaListComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('la primera carga pide tantas filas como dice la preferencia "Filas por página"', () => {
    const lista = montar(20);
    expect(lista.pageSize).toBe(20);
    expect(loadPagina).toHaveBeenCalledOnceWith(jasmine.objectContaining({ page: 1, pageSize: 20 }));
  });

  it('después el paginador sigue mandando: cambiar de tamaño pide la página con el tamaño nuevo', () => {
    const lista = montar(50);
    lista.onPageChange({ pageIndex: 0, pageSize: 10 });
    expect(loadPagina).toHaveBeenCalledWith(jasmine.objectContaining({ page: 1, pageSize: 10 }));
  });
});
