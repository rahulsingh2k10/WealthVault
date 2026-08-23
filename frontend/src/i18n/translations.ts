export type Locale =
  | "en-US"
  | "fr-FR"
  | "de-DE"
  | "hi-IN"
  | "id-ID"
  | "it-IT"
  | "ja-JP"
  | "ko-KR"
  | "pt-BR"
  | "es-419"
  | "es-ES";

export interface Translations {
  nav: {
    dashboard:         string;
    stocks:            string;
    mutualFunds:       string;
    goldCommodities:   string;
    realEstate:        string;
    cryptocurrency:    string;
    insurance:         string;
    cashBanking:       string;
    liabilities:       string;
    fixedIncome:       string;
    governmentSchemes: string;
  };
  sidebar: {
    settings:   string;
    language:   string;
    country:    string;
    plan:       string;
    lockScreen: string;
    logout:     string;
    freePlan:   string;
    proPlan:    string;
    maxPlan:    string;
  };
  language: {
    title: string;
  };
}

export const LOCALES: { code: Locale; label: string; native: string }[] = [
  { code: "en-US",  label: "English (United States)",  native: "English (United States)"  },
  { code: "fr-FR",  label: "French (France)",           native: "Français (France)"         },
  { code: "de-DE",  label: "German (Germany)",          native: "Deutsch (Deutschland)"     },
  { code: "hi-IN",  label: "Hindi (India)",             native: "हिंदी (भारत)"              },
  { code: "id-ID",  label: "Indonesian (Indonesia)",    native: "Indonesia (Indonesia)"     },
  { code: "it-IT",  label: "Italian (Italy)",           native: "Italiano (Italia)"         },
  { code: "ja-JP",  label: "Japanese (Japan)",          native: "日本語 (日本)"               },
  { code: "ko-KR",  label: "Korean (South Korea)",      native: "한국어 (대한민국)"            },
  { code: "pt-BR",  label: "Portuguese (Brazil)",       native: "Português (Brasil)"        },
  { code: "es-419", label: "Spanish (Latin America)",   native: "Español (Latinoamérica)"   },
  { code: "es-ES",  label: "Spanish (Spain)",           native: "Español (España)"          },
];

const translations: Record<Locale, Translations> = {
  "en-US": {
    nav: {
      dashboard:         "Dashboard",
      stocks:            "Stocks",
      mutualFunds:       "Mutual Funds",
      goldCommodities:   "Gold & Commodities",
      realEstate:        "Real Estate",
      cryptocurrency:    "Cryptocurrency",
      insurance:         "Insurance",
      cashBanking:       "Cash & Banking",
      liabilities:       "Liabilities",
      fixedIncome:       "Fixed Income",
      governmentSchemes: "Government Schemes",
    },
    sidebar: {
      settings:   "Settings",
      language:   "Language",
      country:    "Country",
      plan:       "Plan",
      lockScreen: "Lock Screen",
      logout:     "Log out",
      freePlan:   "Free plan",
      proPlan:    "Pro plan",
      maxPlan:    "Max plan",
    },
    language: { title: "Language" },
  },

  "fr-FR": {
    nav: {
      dashboard:         "Tableau de bord",
      stocks:            "Actions",
      mutualFunds:       "Fonds communs",
      goldCommodities:   "Or & Matières premières",
      realEstate:        "Immobilier",
      cryptocurrency:    "Cryptomonnaie",
      insurance:         "Assurance",
      cashBanking:       "Liquidités & Banque",
      liabilities:       "Passif",
      fixedIncome:       "Revenu fixe",
      governmentSchemes: "Programmes gouvernementaux",
    },
    sidebar: {
      settings:   "Paramètres",
      language:   "Langue",
      country:    "Pays",
      plan:       "Forfait",
      lockScreen: "Verrouiller l'écran",
      logout:     "Déconnexion",
      freePlan:   "Forfait gratuit",
      proPlan:    "Forfait Pro",
      maxPlan:    "Forfait Max",
    },
    language: { title: "Langue" },
  },

  "de-DE": {
    nav: {
      dashboard:         "Dashboard",
      stocks:            "Aktien",
      mutualFunds:       "Investmentfonds",
      goldCommodities:   "Gold & Rohstoffe",
      realEstate:        "Immobilien",
      cryptocurrency:    "Kryptowährung",
      insurance:         "Versicherung",
      cashBanking:       "Bargeld & Banken",
      liabilities:       "Verbindlichkeiten",
      fixedIncome:       "Festverzinslich",
      governmentSchemes: "Regierungsprogramme",
    },
    sidebar: {
      settings:   "Einstellungen",
      language:   "Sprache",
      country:    "Land",
      plan:       "Tarif",
      lockScreen: "Bildschirm sperren",
      logout:     "Abmelden",
      freePlan:   "Kostenloser Tarif",
      proPlan:    "Pro-Tarif",
      maxPlan:    "Max-Tarif",
    },
    language: { title: "Sprache" },
  },

  "hi-IN": {
    nav: {
      dashboard:         "डैशबोर्ड",
      stocks:            "शेयर",
      mutualFunds:       "म्यूचुअल फंड",
      goldCommodities:   "सोना और वस्तुएं",
      realEstate:        "रियल एस्टेट",
      cryptocurrency:    "क्रिप्टोकरेंसी",
      insurance:         "बीमा",
      cashBanking:       "नकद और बैंकिंग",
      liabilities:       "देनदारियां",
      fixedIncome:       "फिक्स्ड इनकम",
      governmentSchemes: "सरकारी योजनाएं",
    },
    sidebar: {
      settings:   "सेटिंग्स",
      language:   "भाषा",
      country:    "देश",
      plan:       "योजना",
      lockScreen: "स्क्रीन लॉक करें",
      logout:     "लॉग आउट",
      freePlan:   "निःशुल्क योजना",
      proPlan:    "प्रो योजना",
      maxPlan:    "मैक्स योजना",
    },
    language: { title: "भाषा" },
  },

  "id-ID": {
    nav: {
      dashboard:         "Dasbor",
      stocks:            "Saham",
      mutualFunds:       "Reksa Dana",
      goldCommodities:   "Emas & Komoditas",
      realEstate:        "Properti",
      cryptocurrency:    "Kripto",
      insurance:         "Asuransi",
      cashBanking:       "Kas & Perbankan",
      liabilities:       "Kewajiban",
      fixedIncome:       "Pendapatan Tetap",
      governmentSchemes: "Program Pemerintah",
    },
    sidebar: {
      settings:   "Pengaturan",
      language:   "Bahasa",
      country:    "Negara",
      plan:       "Paket",
      lockScreen: "Kunci Layar",
      logout:     "Keluar",
      freePlan:   "Paket Gratis",
      proPlan:    "Paket Pro",
      maxPlan:    "Paket Max",
    },
    language: { title: "Bahasa" },
  },

  "it-IT": {
    nav: {
      dashboard:         "Dashboard",
      stocks:            "Azioni",
      mutualFunds:       "Fondi comuni",
      goldCommodities:   "Oro & Materie prime",
      realEstate:        "Immobiliare",
      cryptocurrency:    "Criptovaluta",
      insurance:         "Assicurazione",
      cashBanking:       "Contante & Banca",
      liabilities:       "Passività",
      fixedIncome:       "Reddito fisso",
      governmentSchemes: "Programmi governativi",
    },
    sidebar: {
      settings:   "Impostazioni",
      language:   "Lingua",
      country:    "Paese",
      plan:       "Piano",
      lockScreen: "Blocca schermo",
      logout:     "Esci",
      freePlan:   "Piano gratuito",
      proPlan:    "Piano Pro",
      maxPlan:    "Piano Max",
    },
    language: { title: "Lingua" },
  },

  "ja-JP": {
    nav: {
      dashboard:         "ダッシュボード",
      stocks:            "株式",
      mutualFunds:       "投資信託",
      goldCommodities:   "金・コモディティ",
      realEstate:        "不動産",
      cryptocurrency:    "暗号資産",
      insurance:         "保険",
      cashBanking:       "現金・銀行",
      liabilities:       "負債",
      fixedIncome:       "固定収益",
      governmentSchemes: "政府制度",
    },
    sidebar: {
      settings:   "設定",
      language:   "言語",
      country:    "国",
      plan:       "プラン",
      lockScreen: "画面をロック",
      logout:     "ログアウト",
      freePlan:   "無料プラン",
      proPlan:    "プロプラン",
      maxPlan:    "マックスプラン",
    },
    language: { title: "言語" },
  },

  "ko-KR": {
    nav: {
      dashboard:         "대시보드",
      stocks:            "주식",
      mutualFunds:       "뮤추얼 펀드",
      goldCommodities:   "금 & 원자재",
      realEstate:        "부동산",
      cryptocurrency:    "암호화폐",
      insurance:         "보험",
      cashBanking:       "현금 & 뱅킹",
      liabilities:       "부채",
      fixedIncome:       "고정 수입",
      governmentSchemes: "정부 제도",
    },
    sidebar: {
      settings:   "설정",
      language:   "언어",
      country:    "국가",
      plan:       "플랜",
      lockScreen: "화면 잠금",
      logout:     "로그아웃",
      freePlan:   "무료 플랜",
      proPlan:    "프로 플랜",
      maxPlan:    "맥스 플랜",
    },
    language: { title: "언어" },
  },

  "pt-BR": {
    nav: {
      dashboard:         "Painel",
      stocks:            "Ações",
      mutualFunds:       "Fundos mútuos",
      goldCommodities:   "Ouro & Commodities",
      realEstate:        "Imóveis",
      cryptocurrency:    "Criptomoedas",
      insurance:         "Seguro",
      cashBanking:       "Dinheiro & Banco",
      liabilities:       "Passivos",
      fixedIncome:       "Renda Fixa",
      governmentSchemes: "Programas Governamentais",
    },
    sidebar: {
      settings:   "Configurações",
      language:   "Idioma",
      country:    "País",
      plan:       "Plano",
      lockScreen: "Bloquear tela",
      logout:     "Sair",
      freePlan:   "Plano gratuito",
      proPlan:    "Plano Pro",
      maxPlan:    "Plano Max",
    },
    language: { title: "Idioma" },
  },

  "es-419": {
    nav: {
      dashboard:         "Panel",
      stocks:            "Acciones",
      mutualFunds:       "Fondos mutuos",
      goldCommodities:   "Oro & Materias primas",
      realEstate:        "Bienes raíces",
      cryptocurrency:    "Criptomonedas",
      insurance:         "Seguros",
      cashBanking:       "Efectivo & Banca",
      liabilities:       "Pasivos",
      fixedIncome:       "Renta fija",
      governmentSchemes: "Programas gubernamentales",
    },
    sidebar: {
      settings:   "Configuración",
      language:   "Idioma",
      country:    "País",
      plan:       "Plan",
      lockScreen: "Bloquear pantalla",
      logout:     "Cerrar sesión",
      freePlan:   "Plan gratuito",
      proPlan:    "Plan Pro",
      maxPlan:    "Plan Max",
    },
    language: { title: "Idioma" },
  },

  "es-ES": {
    nav: {
      dashboard:         "Panel",
      stocks:            "Acciones",
      mutualFunds:       "Fondos de inversión",
      goldCommodities:   "Oro & Materias primas",
      realEstate:        "Bienes raíces",
      cryptocurrency:    "Criptomonedas",
      insurance:         "Seguros",
      cashBanking:       "Efectivo & Banca",
      liabilities:       "Pasivos",
      fixedIncome:       "Renta fija",
      governmentSchemes: "Programas gubernamentales",
    },
    sidebar: {
      settings:   "Configuración",
      language:   "Idioma",
      country:    "País",
      plan:       "Plan",
      lockScreen: "Bloquear pantalla",
      logout:     "Cerrar sesión",
      freePlan:   "Plan gratuito",
      proPlan:    "Plan Pro",
      maxPlan:    "Plan Max",
    },
    language: { title: "Idioma" },
  },
};

export default translations;
