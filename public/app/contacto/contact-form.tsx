"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { submitContactForm, type ContactFormState } from "./actions"

const initialState: ContactFormState = { ok: false }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-brand hover:bg-brand-dark inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Enviando…" : "Enviar mensaje"}
    </button>
  )
}

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactForm, initialState)

  if (state.ok) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-6 py-8 text-center"
      >
        <p className="text-[18px] font-semibold text-emerald-800">{state.message}</p>
        <p className="mt-2 text-sm text-emerald-700">
          Podés enviar otro mensaje recargando la página.
        </p>
      </div>
    )
  }

  const { errors, values } = state

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Field
          id="nombre"
          name="nombre"
          label="Nombre y apellido"
          type="text"
          autoComplete="name"
          required
          defaultValue={values?.nombre}
          error={errors?.nombre}
        />
        <Field
          id="email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          defaultValue={values?.email}
          error={errors?.email}
        />
      </div>

      <Field
        id="asunto"
        name="asunto"
        label="Asunto"
        type="text"
        required
        defaultValue={values?.asunto}
        error={errors?.asunto}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="mensaje" className="text-ink text-sm font-medium">
          Mensaje
        </label>
        <textarea
          id="mensaje"
          name="mensaje"
          required
          rows={6}
          maxLength={2000}
          defaultValue={values?.mensaje}
          aria-invalid={errors?.mensaje ? "true" : undefined}
          aria-describedby={errors?.mensaje ? "mensaje-error" : undefined}
          className="border-border-soft text-ink focus:border-brand focus:ring-brand/30 w-full resize-y rounded-[12px] border bg-white px-4 py-3 text-sm shadow-sm focus:ring-2 focus:outline-none"
        />
        {errors?.mensaje && (
          <p id="mensaje-error" className="text-xs text-red-600">
            {errors.mensaje}
          </p>
        )}
      </div>

      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  )
}

interface FieldProps {
  id: string
  name: string
  label: string
  type: string
  required?: boolean
  autoComplete?: string
  defaultValue?: string
  error?: string
}

function Field({ id, name, label, type, required, autoComplete, defaultValue, error }: FieldProps) {
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className="border-border-soft text-ink focus:border-brand focus:ring-brand/30 w-full rounded-[12px] border bg-white px-4 py-3 text-sm shadow-sm focus:ring-2 focus:outline-none"
      />
      {error && (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
