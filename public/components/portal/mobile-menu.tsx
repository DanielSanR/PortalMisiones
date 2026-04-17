"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

export interface NavLinkItem {
  label: string
  href: string
  isExternal: boolean
}

interface MobileMenuProps {
  links: readonly NavLinkItem[]
}

export function MobileMenu({ links }: MobileMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-white md:hidden"
        aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {menuOpen && (
        <nav className="mt-2 rounded-2xl bg-[#2f6eb1] px-6 py-4 shadow-lg md:hidden">
          <ul className="flex flex-col gap-3">
            {links.map((link) => (
              <li key={link.label}>
                {link.isExternal ? (
                  <a
                    href={link.href}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    href={link.href as "/tramites" | "/" | "/organismos" | "/eventos"}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  )
}
