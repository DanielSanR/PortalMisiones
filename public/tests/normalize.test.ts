import { describe, it, expect } from "vitest"
import { normalize } from "@/lib/format/normalize"

describe("normalize", () => {
  it("elimina diacríticos", () => {
    expect(normalize("Á É Í Ó Ú Ñ")).toBe("a e i o u n")
  })

  it("pasa a minúsculas", () => {
    expect(normalize("MAYÚSCULAS")).toBe("mayusculas")
  })

  it("preserva espacios y puntuación", () => {
    expect(normalize("Hola, Mundó!")).toBe("hola, mundo!")
  })

  it("es idempotente sobre texto ya normalizado", () => {
    const once = normalize("Acción")
    expect(normalize(once)).toBe(once)
  })
})
