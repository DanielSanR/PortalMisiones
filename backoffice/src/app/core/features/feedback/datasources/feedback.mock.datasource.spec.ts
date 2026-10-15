import { firstValueFrom } from 'rxjs';
import { FeedbackMockDataSource } from './feedback.mock.datasource';
import { MOCK_FEEDBACK_ITEMS } from './feedback.mock-data';

function dia(iso: string): string {
  const f = new Date(iso);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

describe('FeedbackMockDataSource · rango de fechas', () => {
  it('fechaHasta es inclusiva: incluye las opiniones del día final', async () => {
    const ds = new FeedbackMockDataSource();
    const muestra = MOCK_FEEDBACK_ITEMS[0];
    const elDia = dia(muestra.fechaFeedback);

    const pagina = await firstValueFrom(ds.list({ fechaDesde: elDia, fechaHasta: elDia, pageSize: 1000 }));

    expect(pagina.items.map((f) => f.id)).toContain(muestra.id);
    expect(pagina.items.every((f) => dia(f.fechaFeedback) === elDia)).toBeTrue();
  });
});
