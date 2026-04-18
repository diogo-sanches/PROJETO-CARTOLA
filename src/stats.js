// ===== STATS MODULE =====
// Advanced statistical calculations for teams and players

import { getClubMatches, getPlayerHistory, getClubMatchInRound } from './history.js';

// ===== TEAM STATS =====

/**
 * Calculate comprehensive team statistics
 * @returns { gmTotal, gsTotal, gmCasa, gmFora, gsCasa, gsFora, 
 *            jcgmCasa, jcgmFora, jcgsCasa, jcgsFora, 
 *            aproveitamento, forma, jogos, vitorias, empates, derrotas }
 */
export function calcClubStats(clubeId) {
  const matches = getClubMatches(clubeId);
  if (matches.length === 0) return null;

  const homeMatches = matches.filter(m => m.isHome);
  const awayMatches = matches.filter(m => !m.isHome);

  // Goals
  const gmCasa = homeMatches.reduce((s, m) => s + m.goalsFor, 0);
  const gmFora = awayMatches.reduce((s, m) => s + m.goalsFor, 0);
  const gsCasa = homeMatches.reduce((s, m) => s + m.goalsAgainst, 0);
  const gsFora = awayMatches.reduce((s, m) => s + m.goalsAgainst, 0);

  // JCGM - Jogos Com Gol Marcado
  const jcgmCasa = homeMatches.length > 0 
    ? homeMatches.filter(m => m.goalsFor > 0).length / homeMatches.length : 0;
  const jcgmFora = awayMatches.length > 0 
    ? awayMatches.filter(m => m.goalsFor > 0).length / awayMatches.length : 0;
  const jcgmTotal = matches.length > 0 
    ? matches.filter(m => m.goalsFor > 0).length / matches.length : 0;

  // JCGS - Jogos Com Gol Sofrido
  const jcgsCasa = homeMatches.length > 0 
    ? homeMatches.filter(m => m.goalsAgainst > 0).length / homeMatches.length : 0;
  const jcgsFora = awayMatches.length > 0 
    ? awayMatches.filter(m => m.goalsAgainst > 0).length / awayMatches.length : 0;
  const jcgsTotal = matches.length > 0 
    ? matches.filter(m => m.goalsAgainst > 0).length / matches.length : 0;

  // Results
  const vitorias = matches.filter(m => m.result === 'V').length;
  const empates = matches.filter(m => m.result === 'E').length;
  const derrotas = matches.filter(m => m.result === 'D').length;
  const pontos = vitorias * 3 + empates;

  // Aproveitamento
  const aproveitamento = matches.length > 0 
    ? (pontos / (matches.length * 3)) * 100 : 0;

  // Forma recente (últimos 5 jogos)
  const recentMatches = matches.slice(-5);
  const forma = recentMatches.map(m => m.result);

  // Média de gols
  const mediaGM = matches.length > 0 ? (gmCasa + gmFora) / matches.length : 0;
  const mediaGS = matches.length > 0 ? (gsCasa + gsFora) / matches.length : 0;
  const mediaGMCasa = homeMatches.length > 0 ? gmCasa / homeMatches.length : 0;
  const mediaGMFora = awayMatches.length > 0 ? gmFora / awayMatches.length : 0;
  const mediaGSCasa = homeMatches.length > 0 ? gsCasa / homeMatches.length : 0;
  const mediaGSFora = awayMatches.length > 0 ? gsFora / awayMatches.length : 0;

  return {
    jogos: matches.length,
    jogosCasa: homeMatches.length,
    jogosFora: awayMatches.length,
    gmTotal: gmCasa + gmFora,
    gsTotal: gsCasa + gsFora,
    gmCasa, gmFora, gsCasa, gsFora,
    mediaGM, mediaGS, mediaGMCasa, mediaGMFora, mediaGSCasa, mediaGSFora,
    jcgmCasa, jcgmFora, jcgmTotal,
    jcgsCasa, jcgsFora, jcgsTotal,
    vitorias, empates, derrotas, pontos,
    aproveitamento,
    forma,
    matches,
    saldoGols: (gmCasa + gmFora) - (gsCasa + gsFora),
  };
}

// ===== PLAYER STATS =====

/**
 * Calculate individual player statistics from history
 */
export function calcPlayerStats(atletaId) {
  const history = getPlayerHistory(atletaId);
  if (history.length === 0) return null;

  const played = history.filter(h => h.entrou_em_campo);
  const pontos = played.map(h => h.pontuacao);

  // Basic stats
  const media = pontos.length > 0 ? pontos.reduce((s, v) => s + v, 0) / pontos.length : 0;
  const mediana = pontos.length > 0 ? calcMedian(pontos) : 0;
  const desvioPadrao = pontos.length > 0 ? calcStdDev(pontos) : 0;

  // Consistency rating (1-5 stars)
  // Lower std dev = more consistent
  let consistencia = 5;
  if (desvioPadrao > 7) consistencia = 1;
  else if (desvioPadrao > 5) consistencia = 2;
  else if (desvioPadrao > 4) consistencia = 3;
  else if (desvioPadrao > 2.5) consistencia = 4;

  // Home vs Away performance
  const homeRounds = [];
  const awayRounds = [];
  for (const h of played) {
    const match = getClubMatchInRound(h.clube_id, h.round);
    if (match) {
      if (match.isHome) {
        homeRounds.push(h);
      } else {
        awayRounds.push(h);
      }
    }
  }

  const mediaCasa = homeRounds.length > 0 
    ? homeRounds.reduce((s, h) => s + h.pontuacao, 0) / homeRounds.length : 0;
  const mediaFora = awayRounds.length > 0 
    ? awayRounds.reduce((s, h) => s + h.pontuacao, 0) / awayRounds.length : 0;

  // Trend (last 5 rounds linear regression)
  const recent = played.slice(-5);
  const trend = calcTrend(recent.map(h => h.pontuacao));

  // Scouts accumulated from history
  const scoutsTotal = {};
  for (const h of played) {
    for (const [key, val] of Object.entries(h.scout || {})) {
      scoutsTotal[key] = (scoutsTotal[key] || 0) + val;
    }
  }

  // Moving average (window of 3)
  const movingAvg = calcMovingAverage(played.map(h => h.pontuacao), 3);

  // Highest and lowest points
  const maxPts = pontos.length > 0 ? Math.max(...pontos) : 0;
  const minPts = pontos.length > 0 ? Math.min(...pontos) : 0;
  const maxRound = played.find(h => h.pontuacao === maxPts);
  const minRound = played.find(h => h.pontuacao === minPts);

  return {
    history: played,
    fullHistory: history,
    jogos: played.length,
    media,
    mediana,
    desvioPadrao,
    consistencia,
    mediaCasa,
    mediaFora,
    jogosCasa: homeRounds.length,
    jogosFora: awayRounds.length,
    trend, // positive = improving, negative = declining
    scoutsTotal,
    movingAvg,
    maxPts, minPts,
    maxRound: maxRound?.round,
    minRound: minRound?.round,
  };
}

// ===== CONFRONTO ANALYSIS =====

/**
 * Analyze a specific matchup between two teams
 * @returns Attack/defense indices, SG probability
 */
export function analyzeConfronto(homeClubId, awayClubId) {
  const homeStats = calcClubStats(homeClubId);
  const awayStats = calcClubStats(awayClubId);

  if (!homeStats || !awayStats) return null;

  // Attack index of home team
  // (GM casa do mandante × %JCGM casa) vs (GS fora do visitante × %JCGS fora)
  const ataqueHome = homeStats.mediaGMCasa * homeStats.jcgmCasa;
  const defesaAway = awayStats.mediaGSFora * awayStats.jcgsFora;

  // Attack index of away team
  const ataqueAway = awayStats.mediaGMFora * awayStats.jcgmFora;
  const defesaHome = homeStats.mediaGSCasa * homeStats.jcgsCasa;

  // Clean sheet probability for home team
  // P(SG casa) ≈ (1 - jcgsCasa do mandante) × (1 - jcgmFora do visitante)
  const probSgHome = (1 - homeStats.jcgsCasa) * (1 - awayStats.jcgmFora);

  // Clean sheet probability for away team
  const probSgAway = (1 - awayStats.jcgsFora) * (1 - homeStats.jcgmCasa);

  // Expected goals (simplified)
  const expGoalsHome = homeStats.mediaGMCasa * (awayStats.mediaGSFora > 0 ? awayStats.mediaGSFora / awayStats.mediaGS || 1 : 1);
  const expGoalsAway = awayStats.mediaGMFora * (homeStats.mediaGSCasa > 0 ? homeStats.mediaGSCasa / homeStats.mediaGS || 1 : 1);

  return {
    homeStats,
    awayStats,
    ataqueHome,
    defesaAway,
    ataqueAway,
    defesaHome,
    probSgHome,
    probSgAway,
    expGoalsHome: Math.max(0, expGoalsHome),
    expGoalsAway: Math.max(0, expGoalsAway),
    favorito: ataqueHome - defesaAway > ataqueAway - defesaHome ? 'home' : 'away',
  };
}

// ===== MATH HELPERS =====

function calcMedian(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calcStdDev(arr) {
  if (arr.length <= 1) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function calcTrend(values) {
  if (values.length < 2) return 0;
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return isNaN(slope) ? 0 : slope;
}

function calcMovingAverage(values, window) {
  const result = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    result.push(slice.reduce((s, v) => s + v, 0) / slice.length);
  }
  return result;
}
