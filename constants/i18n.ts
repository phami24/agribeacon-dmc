// constants/i18n.ts
// Re-export translations for convenience
export { defaultViTranslations, defaultEnTranslations, MissionTranslations } from '../types/i18n';

// Helper function to get translations by language code
import { MissionTranslations, defaultViTranslations, defaultEnTranslations } from '../types/i18n';

export function getTranslations(language: 'vi' | 'en'): MissionTranslations {
  return language === 'en' ? defaultEnTranslations : defaultViTranslations;
}

