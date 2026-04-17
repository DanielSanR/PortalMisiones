"use server"

export interface ContactFormState {
  ok: boolean
  message?: string
  errors?: {
    nombre?: string
    email?: string
    asunto?: string
    mensaje?: string
  }
  values?: {
    nombre: string
    email: string
    asunto: string
    mensaje: string
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const nombre = String(formData.get("nombre") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const asunto = String(formData.get("asunto") ?? "").trim()
  const mensaje = String(formData.get("mensaje") ?? "").trim()

  const errors: ContactFormState["errors"] = {}
  if (nombre.length < 2) errors.nombre = "Ingresá tu nombre (mínimo 2 caracteres)."
  if (!EMAIL_RE.test(email)) errors.email = "Ingresá un email válido."
  if (asunto.length < 3) errors.asunto = "El asunto debe tener al menos 3 caracteres."
  if (mensaje.length < 10) errors.mensaje = "El mensaje debe tener al menos 10 caracteres."
  if (mensaje.length > 2000) errors.mensaje = "El mensaje no puede superar 2000 caracteres."

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      values: { nombre, email, asunto, mensaje },
    }
  }

  // TODO: enviar a backend / mail / ticketing cuando exista API.
  console.info("[contacto] nuevo mensaje", { nombre, email, asunto, mensaje })

  return {
    ok: true,
    message: "Gracias por escribirnos. Te responderemos a la brevedad.",
  }
}
