const ISO_TO_NAME: Record<string, string> = {
  'IT': 'Italy', 'FR': 'France', 'DE': 'Germany', 'GB': 'United Kingdom',
  'SE': 'Sweden', 'ES': 'Spain', 'NL': 'Netherlands', 'US': 'United States',
  'CA': 'Canada', 'AU': 'Australia', 'AT': 'Austria', 'BE': 'Belgium',
  'CH': 'Switzerland', 'DK': 'Denmark', 'FI': 'Finland', 'GR': 'Greece',
  'IE': 'Ireland', 'NO': 'Norway', 'PL': 'Poland', 'PT': 'Portugal',
  'CZ': 'Czech Republic', 'HR': 'Croatia', 'HU': 'Hungary', 'RO': 'Romania',
  'SK': 'Slovakia', 'SI': 'Slovenia', 'BG': 'Bulgaria', 'LT': 'Lithuania',
  'LV': 'Latvia', 'EE': 'Estonia', 'MT': 'Malta', 'CY': 'Cyprus',
  'LU': 'Luxembourg', 'TR': 'Turkey', 'JP': 'Japan', 'BR': 'Brazil',
  'MX': 'Mexico', 'NZ': 'New Zealand', 'ZA': 'South Africa',
  'MC': 'Monaco', 'IS': 'Iceland', 'IL': 'Israel', 'AE': 'United Arab Emirates',
  'SG': 'Singapore', 'HK': 'Hong Kong', 'KR': 'South Korea', 'IN': 'India',
  'CN': 'China', 'TW': 'Taiwan', 'TH': 'Thailand', 'MY': 'Malaysia',
  'PH': 'Philippines', 'AR': 'Argentina', 'CL': 'Chile', 'CO': 'Colombia',
  'PE': 'Peru', 'UY': 'Uruguay', 'EC': 'Ecuador',
};

export function normalizeCountryName(input: string | undefined | null): string {
  if (!input) return 'Sconosciuto';
  const trimmed = input.trim();
  if (!trimmed) return 'Sconosciuto';
  const upper = trimmed.toUpperCase();
  if (ISO_TO_NAME[upper]) return ISO_TO_NAME[upper];
  return trimmed;
}
