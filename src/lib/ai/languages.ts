export const languages = { en: "English", ta: "தமிழ்", tanglish: "Tanglish" } as const;
export type AnswerLanguage = keyof typeof languages;
