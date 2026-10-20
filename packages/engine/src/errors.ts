/**
 * Игровая логика не должна знать про язык клиента — поэтому ошибки несут
 * машинно-читаемый `code` (+ при необходимости `params` для подстановки
 * чисел/значений), а не готовый текст на каком-то одном языке. Перевод
 * текста под конкретный `code` — забота фронтенда (см. frontend/src/i18n).
 * `message` всё равно остаётся — это английский текст для логов/тестов,
 * а не то, что видит игрок.
 */
export class TableError extends Error {
  readonly code: string;
  readonly params?: Record<string, string | number>;

  constructor(code: string, message: string, params?: Record<string, string | number>) {
    super(message);
    this.name = "TableError";
    this.code = code;
    this.params = params;
  }
}
