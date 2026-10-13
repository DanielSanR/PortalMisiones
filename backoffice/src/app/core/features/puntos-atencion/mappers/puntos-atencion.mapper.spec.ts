import { AttentionPointResponseDTO } from '../models/punto-atencion.dto';
import { PuntoAtencionFormValue } from '../models/punto-atencion.vm';
import { redondearCoordenada, toAttentionPointRequest, toPuntoAtencionVM } from './puntos-atencion.mapper';

const DTO: AttentionPointResponseDTO = {
  id: 'pa-1',
  organismProcedureLocationId: 'fl-1',
  name: 'Sede central',
  address: 'Av. Siempre Viva 123',
  contactInfo: ' ',
  openingHours: 'Lun a vie 7 a 13',
  latitude: -27.3671,
  longitude: '-55.8961',
  active: true,
};

const FORM: PuntoAtencionFormValue = {
  fichaId: 'fl-1',
  nombre: '  Sede  ',
  direccion: ' Calle 1 ',
  contacto: '',
  horarios: ' 8 a 12 ',
  latitud: -27.12345678,
  longitud: -55.1,
  activo: true,
};

describe('puntos-atencion.mapper', () => {
  it('toPuntoAtencionVM acepta coordenadas como número o string y vacía los textos en blanco', () => {
    const vm = toPuntoAtencionVM(DTO);
    expect(vm.fichaId).toBe('fl-1');
    expect(vm.latitud).toBe(-27.3671);
    expect(vm.longitud).toBe(-55.8961);
    expect(vm.contacto).toBeNull();
    expect(vm.horarios).toBe('Lun a vie 7 a 13');
  });

  it('toPuntoAtencionVM deja null las coordenadas que faltan', () => {
    const vm = toPuntoAtencionVM({ ...DTO, latitude: null, longitude: null });
    expect(vm.latitud).toBeNull();
    expect(vm.longitud).toBeNull();
  });

  it('toAttentionPointRequest redondea a 6 decimales y recorta textos', () => {
    const req = toAttentionPointRequest(FORM);
    expect(req.latitude).toBe(-27.123457);
    expect(req.longitude).toBe(-55.1);
    expect(req.name).toBe('Sede');
    expect(req.address).toBe('Calle 1');
    expect(req.contactInfo).toBeNull();
    expect(req.openingHours).toBe('8 a 12');
    expect(req.organismProcedureLocationId).toBe('fl-1');
    expect(req.active).toBeTrue();
  });

  it('redondearCoordenada no arrastra error de coma flotante', () => {
    expect(redondearCoordenada(0.1 + 0.2)).toBe(0.3);
    expect(redondearCoordenada(-180)).toBe(-180);
  });
});
