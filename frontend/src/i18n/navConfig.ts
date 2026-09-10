import {
  LayoutDashboard,
  CandlestickChart,
  BarChart3,
  Gem,
  Home,
  Bitcoin,
  Shield,
  Wallet,
  HandCoins,
  Vault,
  Landmark,
} from 'lucide-react'
import type { ElementType } from 'react'

export const ICON_MAP: Record<string, ElementType> = {
  LayoutDashboard,   // Dashboard
  CandlestickChart,  // Stocks
  BarChart3,         // Mutual Funds
  Gem,               // Gold & Commodities
  Home,              // Real Estate
  Bitcoin,           // Cryptocurrency
  Shield,            // Insurance
  Wallet,            // Cash & Banking
  HandCoins,         // Liabilities
  Vault,             // Fixed Income
  Landmark,          // Government Schemes
}

export interface NavItemDto {
  id:        string
  country:   string
  href:      string
  labelKey:  string
  iconName:  string
  sortOrder: number
}
