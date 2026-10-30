// The app is in Vietnamese only; its texts are written where they are shown.
// The language code stays in the URLs (/vi/orders...).
export const supportedLocales = ['vi'] as const
export type SupportedLocale = (typeof supportedLocales)[number]
export const defaultLocale: SupportedLocale = 'vi'

export function isSupportedLocale(input: string): input is SupportedLocale {
  return supportedLocales.includes(input as SupportedLocale)
}
