import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  Gem,
  Home,
  Bitcoin,
  Shield,
  Building2,
  CreditCard,
  PiggyBank,
  Landmark,
} from 'lucide-react'
import type { ElementType } from 'react'

export const ICON_MAP: Record<string, ElementType> = {
  LayoutDashboard,  // Dashboard
  TrendingUp,       // Stocks
  BarChart3,        // Mutual Funds
  Gem,              // Gold & Commodities
  Home,             // Real Estate
  Bitcoin,          // Cryptocurrency
  Shield,           // Insurance
  Building2,        // Cash & Banking
  CreditCard,       // Liabilities
  PiggyBank,        // Fixed Income
  Landmark,         // Government Schemes
}

export interface NavItemDto {
  id:        number
  country:   string
  href:      string
  labelKey:  string
  iconName:  string
  sortOrder: number
}
