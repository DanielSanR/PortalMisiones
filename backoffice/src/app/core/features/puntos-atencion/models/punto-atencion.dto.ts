/**
 * Contrato real de `/api/attention-point` (backend `origin/dev` @ `23fd8f9`, `AttentionPointRequestDTO`
 * / `AttentionPointResponseDTO`). Ver PLAN_TRAMITES_API.md §1.5. Los UUID viajan como string.
 *
 * `latitude`/`longitude` son `BigDecimal` (`NUMERIC(9,6)` desde `V2.22`): Jackson los serializa como
 * número. Se tipan `number | string` en el response por si se configura `WRITE_BIGDECIMAL_AS_PLAIN`
 * como string; la columna admite `NULL` (filas previas a la validación), así que también `null`.
 */
export interface AttentionPointResponseDTO {
  id: string;
  organismProcedureLocationId: string;
  name: string;
  address: string;
  contactInfo: string | null;
  openingHours: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  active: boolean;
}

/**
 * POST/PUT. El PUT es reemplazo total. Validaciones del backend:
 * - `@NotNull organismProcedureLocationId`, `@NotBlank name`, `@NotBlank address`, `@NotNull latitude`,
 *   `@NotNull longitude`, `@NotNull active` → 400 `4012`.
 * - Latitud fuera de [-90, 90] o longitud fuera de [-180, 180] → 400 `4012`.
 * - Ficha o punto inexistente o fuera del alcance → 404 `4073`.
 * - Más de 6 decimales: la base los redondea en silencio (`NUMERIC(9,6)`); el front redondea antes.
 */
export interface AttentionPointRequestDTO {
  organismProcedureLocationId: string;
  name: string;
  address: string;
  contactInfo: string | null;
  openingHours: string | null;
  latitude: number;
  longitude: number;
  active: boolean;
}
