import { describe, it, expect } from "vitest"
import { slugify } from "@/lib/format/slugify"

describe("slugify", () => {
  it("normaliza acentos y minúsculas", () => {
    expect(slugify("Acción Ciudadana")).toBe("accion-ciudadana")
  })

  it("reemplaza secuencias no alfanuméricas por un único guion", () => {
    expect(slugify("Instituto Provincial de Salud (IPS)")).toBe("instituto-provincial-de-salud-ips")
  })

  it("recorta guiones iniciales y finales", () => {
    expect(slugify("  --Licencia de Conducir--  ")).toBe("licencia-de-conducir")
  })

  it("colapsa múltiples separadores", () => {
    expect(slugify("uno///dos___tres")).toBe("uno-dos-tres")
  })

  it("maneja strings vacíos", () => {
    expect(slugify("")).toBe("")
  })
})
