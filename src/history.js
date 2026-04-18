// ===== HISTORY MODULE =====
// Loads and caches all round data for historical analysis

const BASE_URL = '/api';
const CACHE_PREFIX = 'cartola_history_';
const DELAY_MS = 400; // Rate limiting delay between API calls

let _roundData = {}; // { round: { athletes: {}, matches: [] } }
let _isLoaded = false;
let _loadingCallbacks = [];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCachedRound(round, type) {
  try {
    const key = `${CACHE_PREFIX}${type}_r${round}`;
    const cached = sessionStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch (e) { /* ignore */ }
  return null;
}

function setCachedRound(round, type, data) {
  try {
    const key = `${CACHE_PREFIX}${type}_r${round}`;
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    // sessionStorage might be full, silently fail
    console.warn('SessionStorage cache failed for round', round, type);
  }
}

async function fetchRoundScored(round) {
  const cached = getCachedRound(round, 'scored');
  if (cached) return cached;

  const response = await fetch(`${BASE_URL}/atletas/pontuados/${round}`);
  if (!response.ok) return null;
  const data = await response.json();
  setCachedRound(round, 'scored', data);
  return data;
}

async function fetchRoundMatches(round) {
  const cached = getCachedRound(round, 'matches');
  if (cached) return cached;

  const response = await fetch(`${BASE_URL}/partidas/${round}`);
  if (!response.ok) return null;
  const data = await response.json();
  setCachedRound(round, 'matches', data);
  return data;
}

/**
 * Load all historical data from round 1 to currentRound-1
 * @param {number} currentRound - Current round number
 * @param {function} onProgress - Callback with (loaded, total) for progress bar
 */
export async function loadHistory(currentRound, onProgress) {
  if (_isLoaded) return;

  const roundsToLoad = currentRound - 1; // Load completed rounds only
  let loaded = 0;

  for (let round = 1; round <= roundsToLoad; round++) {
    try {
      const [scored, matches] = await Promise.all([
        fetchRoundScored(round),
        fetchRoundMatches(round),
      ]);

      _roundData[round] = {
        athletes: scored?.atletas || {},
        matches: matches?.partidas || [],
        clubs: matches?.clubes || {},
      };
    } catch (e) {
      console.warn(`Failed to load round ${round}:`, e);
      _roundData[round] = { athletes: {}, matches: [], clubs: {} };
    }

    loaded++;
    if (onProgress) onProgress(loaded, roundsToLoad);

    // Rate limit: don't hammer the API
    if (loaded < roundsToLoad) {
      await sleep(DELAY_MS);
    }
  }

  _isLoaded = true;

  // Notify waiting callbacks
  _loadingCallbacks.forEach(cb => cb());
  _loadingCallbacks = [];
}

export function isHistoryLoaded() {
  return _isLoaded;
}

export function onHistoryLoaded(callback) {
  if (_isLoaded) {
    callback();
  } else {
    _loadingCallbacks.push(callback);
  }
}

// ===== PLAYER HISTORY =====

/**
 * Get a player's history across all loaded rounds
 * @returns Array of { round, pontuacao, scout, clube_id, posicao_id, entrou_em_campo }
 */
export function getPlayerHistory(atletaId) {
  const history = [];
  const id = String(atletaId);

  for (const [round, data] of Object.entries(_roundData)) {
    const athlete = data.athletes[id];
    if (athlete) {
      history.push({
        round: parseInt(round),
        pontuacao: athlete.pontuacao || 0,
        scout: athlete.scout || {},
        clube_id: athlete.clube_id,
        posicao_id: athlete.posicao_id,
        entrou_em_campo: athlete.entrou_em_campo || false,
        apelido: athlete.apelido,
      });
    }
  }

  return history.sort((a, b) => a.round - b.round);
}

/**
 * Get all players who scored in a specific round
 */
export function getRoundScored(round) {
  return _roundData[round]?.athletes || {};
}

// ===== MATCH HISTORY =====

/**
 * Get all matches across all loaded rounds
 */
export function getAllMatches() {
  const allMatches = [];
  for (const [round, data] of Object.entries(_roundData)) {
    for (const match of data.matches) {
      allMatches.push({
        ...match,
        round: parseInt(round),
      });
    }
  }
  return allMatches.sort((a, b) => a.round - b.round);
}

/**
 * Get all matches for a specific club
 * @returns Array of { round, isHome, goalsFor, goalsAgainst, opponentId, result, ... }
 */
export function getClubMatches(clubeId) {
  const matches = [];

  for (const [round, data] of Object.entries(_roundData)) {
    for (const match of data.matches) {
      if (!match.valida) continue;
      
      const isHome = match.clube_casa_id === clubeId;
      const isAway = match.clube_visitante_id === clubeId;

      if (isHome) {
        matches.push({
          round: parseInt(round),
          isHome: true,
          goalsFor: match.placar_oficial_mandante,
          goalsAgainst: match.placar_oficial_visitante,
          opponentId: match.clube_visitante_id,
          result: match.placar_oficial_mandante > match.placar_oficial_visitante ? 'V'
            : match.placar_oficial_mandante < match.placar_oficial_visitante ? 'D' : 'E',
          local: match.local,
          partida_data: match.partida_data,
        });
      } else if (isAway) {
        matches.push({
          round: parseInt(round),
          isHome: false,
          goalsFor: match.placar_oficial_visitante,
          goalsAgainst: match.placar_oficial_mandante,
          opponentId: match.clube_casa_id,
          result: match.placar_oficial_visitante > match.placar_oficial_mandante ? 'V'
            : match.placar_oficial_visitante < match.placar_oficial_mandante ? 'D' : 'E',
          local: match.local,
          partida_data: match.partida_data,
        });
      }
    }
  }

  return matches.sort((a, b) => a.round - b.round);
}

/**
 * Get match by round for a specific club
 */
export function getClubMatchInRound(clubeId, round) {
  const data = _roundData[round];
  if (!data) return null;

  for (const match of data.matches) {
    if (match.clube_casa_id === clubeId || match.clube_visitante_id === clubeId) {
      const isHome = match.clube_casa_id === clubeId;
      return {
        ...match,
        isHome,
        goalsFor: isHome ? match.placar_oficial_mandante : match.placar_oficial_visitante,
        goalsAgainst: isHome ? match.placar_oficial_visitante : match.placar_oficial_mandante,
      };
    }
  }
  return null;
}

/**
 * Get the total number of loaded rounds
 */
export function getLoadedRoundsCount() {
  return Object.keys(_roundData).length;
}

export function getRoundData() {
  return _roundData;
}
