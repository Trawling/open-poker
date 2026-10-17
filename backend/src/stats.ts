/**
 * Простая статистика игрока, привязанная к guestId (см. frontend/src/lib/identity.ts).
 * Не хранит ничего о раздачах по отдельности — только агрегаты. Намеренно
 * не учитывает ботов (их id случайны и не нужны в статистике живых людей).
 */
export interface PlayerStats {
  nickname: string;
  handsPlayed: number;
  handsWon: number;
  chipsWon: number;
  biggestPotWon: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
}

function emptyStats(nickname: string): PlayerStats {
  return {
    nickname,
    handsPlayed: 0,
    handsWon: 0,
    chipsWon: 0,
    biggestPotWon: 0,
    tournamentsPlayed: 0,
    tournamentsWon: 0,
  };
}

export class StatsStore {
  private readonly byId = new Map<string, PlayerStats>();

  private ensure(id: string, nickname: string): PlayerStats {
    let stats = this.byId.get(id);
    if (!stats) {
      stats = emptyStats(nickname);
      this.byId.set(id, stats);
    } else {
      stats.nickname = nickname;
    }
    return stats;
  }

  recordHandPlayed(id: string, nickname: string): void {
    this.ensure(id, nickname).handsPlayed += 1;
  }

  recordHandWon(id: string, nickname: string, amount: number): void {
    const stats = this.ensure(id, nickname);
    stats.handsWon += 1;
    stats.chipsWon += amount;
    stats.biggestPotWon = Math.max(stats.biggestPotWon, amount);
  }

  recordTournamentPlayed(id: string, nickname: string): void {
    this.ensure(id, nickname).tournamentsPlayed += 1;
  }

  recordTournamentWon(id: string, nickname: string): void {
    this.ensure(id, nickname).tournamentsWon += 1;
  }

  get(id: string): PlayerStats | null {
    return this.byId.get(id) ?? null;
  }

  exportAll(): Record<string, PlayerStats> {
    return Object.fromEntries(this.byId.entries());
  }

  importAll(data: Record<string, PlayerStats>): void {
    for (const [id, stats] of Object.entries(data)) {
      this.byId.set(id, stats);
    }
  }
}

/** Единый на процесс стор статистики — столы обновляют его напрямую. */
export const statsStore = new StatsStore();
