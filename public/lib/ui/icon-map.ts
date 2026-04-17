import {
  Banknote,
  BookOpen,
  Building2,
  Bus,
  Car,
  CheckSquare,
  CreditCard,
  FileText,
  HeartPulse,
  IdCard,
  Receipt,
  RefreshCw,
  Scale,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

const lucideIconMap: Record<string, LucideIcon> = {
  card_membership:   CreditCard,
  gavel:             Scale,
  receipt_long:      Receipt,
  approval:          CheckSquare,
  directions_car:    Car,
  school:            BookOpen,
  payments:          Banknote,
  security:          ShieldCheck,
  storefront:        Building2,
  autorenew:         RefreshCw,
  health_and_safety: HeartPulse,
  directions_bus:    Bus,
  badge:             IdCard,
}

export function getTramiteIcon(icono: string | null | undefined): LucideIcon {
  return (icono ? lucideIconMap[icono] : undefined) ?? FileText
}
