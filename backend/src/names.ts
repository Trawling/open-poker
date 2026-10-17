const ADJECTIVES = [
  "Тихий", "Смелый", "Быстрый", "Спокойный", "Хитрый", "Ловкий", "Удачливый",
  "Весёлый", "Внимательный", "Дерзкий", "Расчётливый", "Невозмутимый",
];

const NOUNS = [
  "Тигр", "Сокол", "Барсук", "Волк", "Лис", "Орёл", "Ёж", "Рысь", "Медведь",
  "Ворон", "Филин", "Бобр",
];

const BOT_NAMES = [
  "Бот Степан", "Бот Глеб", "Бот Марфа", "Бот Кузьма", "Бот Люся", "Бот Архип",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateGuestNickname(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

export function generateBotNickname(usedNames: Set<string>): string {
  const free = BOT_NAMES.filter((n) => !usedNames.has(n));
  if (free.length > 0) return pick(free);
  return `Бот ${Math.floor(Math.random() * 9000 + 1000)}`;
}
