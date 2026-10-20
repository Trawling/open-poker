/**
 * Автосгенерированные ники (гостя без никнейма и ботов) — единственный
 * пользовательский текст, который реально рождается на сервере, а не
 * переводится на фронте (см. frontend/src/i18n): сервер не знает языка
 * клиента до хендшейка, поэтому принимает `lang` явным параметром
 * (см. вызовы в server.ts/tableRoom.ts, которые читают его из
 * socket.handshake.auth.lang).
 */
export type Lang = "ru" | "en";

const ADJECTIVES: Record<Lang, string[]> = {
  ru: ["Тихий", "Смелый", "Быстрый", "Спокойный", "Хитрый", "Ловкий", "Удачливый", "Весёлый", "Внимательный", "Дерзкий", "Расчётливый", "Невозмутимый"],
  en: ["Quiet", "Bold", "Swift", "Calm", "Sly", "Nimble", "Lucky", "Cheerful", "Watchful", "Daring", "Shrewd", "Unshaken"],
};

const NOUNS: Record<Lang, string[]> = {
  ru: ["Тигр", "Сокол", "Барсук", "Волк", "Лис", "Орёл", "Ёж", "Рысь", "Медведь", "Ворон", "Филин", "Бобр"],
  en: ["Tiger", "Falcon", "Badger", "Wolf", "Fox", "Eagle", "Hedgehog", "Lynx", "Bear", "Raven", "Owl", "Beaver"],
};

const BOT_NAMES: Record<Lang, string[]> = {
  ru: ["Бот Степан", "Бот Глеб", "Бот Марфа", "Бот Кузьма", "Бот Люся", "Бот Архип"],
  en: ["Bot Steve", "Bot Glen", "Bot Martha", "Bot Casper", "Bot Lucy", "Bot Archie"],
};

const BOT_PREFIX: Record<Lang, string> = { ru: "Бот", en: "Bot" };

function normalizeLang(lang: Lang | undefined): Lang {
  return lang === "en" ? "en" : "ru";
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateGuestNickname(lang?: Lang): string {
  const l = normalizeLang(lang);
  return `${pick(ADJECTIVES[l])} ${pick(NOUNS[l])}`;
}

export function generateBotNickname(usedNames: Set<string>, lang?: Lang): string {
  const l = normalizeLang(lang);
  const free = BOT_NAMES[l].filter((n) => !usedNames.has(n));
  if (free.length > 0) return pick(free);
  return `${BOT_PREFIX[l]} ${Math.floor(Math.random() * 9000 + 1000)}`;
}
