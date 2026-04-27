// ===== CARTOLA FC API MODULE =====
// Handles all API calls with caching to avoid excessive requests

const BASE_URL = '/api';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

async function fetchJSON(endpoint) {
  const cacheKey = endpoint;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`Failed to fetch ${endpoint}:`, error);
    throw error;
  }
}

// ===== PUBLIC API =====

export async function fetchMarketStatus() {
  return fetchJSON('/mercado/status');
}

export async function fetchAthletes() {
  return fetchJSON('/atletas/mercado');
}

export async function fetchScored() {
  try {
    return await fetchJSON('/atletas/pontuados');
  } catch {
    return { atletas: {} };
  }
}

export async function fetchMatches() {
  try {
    return await fetchJSON('/partidas');
  } catch {
    return { partidas: [] };
  }
}

export async function fetchMatchesByRound(round) {
  try {
    return await fetchJSON(`/partidas/${round}`);
  } catch {
    return { partidas: [] };
  }
}

export async function fetchScoredByRound(round) {
  try {
    return await fetchJSON(`/atletas/pontuados/${round}`);
  } catch {
    return { atletas: {} };
  }
}

export async function fetchMaisEscalados() {
  try {
    return await fetchJSON('/atletas/mercado?orderBy=escalacoes');
  } catch {
    return { atletas: [] };
  }
}

// ===== DATA HELPERS =====

const POSITION_MAP = {
  1: { nome: 'Goleiro', abr: 'GOL', class: 'gol' },
  2: { nome: 'Lateral', abr: 'LAT', class: 'lat' },
  3: { nome: 'Zagueiro', abr: 'ZAG', class: 'zag' },
  4: { nome: 'Meia', abr: 'MEI', class: 'mei' },
  5: { nome: 'Atacante', abr: 'ATA', class: 'ata' },
  6: { nome: 'Técnico', abr: 'TEC', class: 'tec' },
};

const STATUS_MAP = {
  2: { nome: 'Dúvida', class: 'duvida', icon: '⚠️' },
  3: { nome: 'Suspenso', class: 'suspenso', icon: '🟥' },
  5: { nome: 'Contundido', class: 'contundido', icon: '🏥' },
  6: { nome: 'Nulo', class: 'nulo', icon: '➖' },
  7: { nome: 'Provável', class: 'provavel', icon: '✅' },
};

const SCOUT_LABELS = {
  G: 'Gols', A: 'Assistências', CA: 'Cartão Amarelo', CV: 'Cartão Vermelho',
  DS: 'Desarmes', FC: 'Faltas Cometidas', FD: 'Finaliz. Defendidas',
  FF: 'Finaliz. Pra Fora', FS: 'Faltas Sofridas', FT: 'Finaliz. na Trave',
  GC: 'Gols Contra', GS: 'Gols Sofridos', I: 'Impedimentos',
  PC: 'Passes na Área', PP: 'Pênaltis Perdidos', PS: 'Pênaltis Sofridos',
  SG: 'Jogos Sem Gol', DE: 'Defesas', V: 'Vitórias (Téc.)',
  PE: 'Pênaltis'
};

export function getPosition(id) {
  return POSITION_MAP[id] || { nome: 'Desconhecido', abr: '???', class: '' };
}

export function getStatus(id) {
  return STATUS_MAP[id] || { nome: 'Desconhecido', class: 'nulo', icon: '❓' };
}

export function getScoutLabel(key) {
  return SCOUT_LABELS[key] || key;
}

export function getScoutLabels() {
  return SCOUT_LABELS;
}

export function formatPrice(value) {
  return `C$ ${value.toFixed(2)}`;
}

export function formatVariation(value) {
  if (value > 0) return `+${value.toFixed(2)}`;
  return value.toFixed(2);
}

// ===== AGGREGATED DATA =====

let _fullData = null;

export async function loadAllData() {
  const [market, athletes] = await Promise.all([
    fetchMarketStatus(),
    fetchAthletes(),
  ]);

  _fullData = {
    market,
    clubs: athletes.clubes || {},
    positions: athletes.posicoes || {},
    statuses: athletes.status || {},
    athletes: (athletes.atletas || []).map(a => ({
      ...a,
      position: getPosition(a.posicao_id),
      status: getStatus(a.status_id),
      clubName: (athletes.clubes || {})[a.clube_id]?.nome_fantasia || 'N/A',
      clubBadge: (athletes.clubes || {})[a.clube_id]?.escudos?.['30x30'] || '',
      clubBadge60: (athletes.clubes || {})[a.clube_id]?.escudos?.['60x60'] || '',
      costBenefit: a.preco_num > 0 ? (a.media_num / a.preco_num) : 0,
    })),
  };

  return _fullData;
}

export function getData() {
  return _fullData;
}

export function getActiveAthletes() {
  if (!_fullData) return [];
  return _fullData.athletes.filter(a => a.jogos_num > 0);
}

export function getAthletesForPosition(posId) {
  if (!_fullData) return [];
  return _fullData.athletes.filter(a => a.posicao_id === posId && a.status_id === 7 && a.jogos_num > 0);
}

export function getClubAthletes(clubId) {
  if (!_fullData) return [];
  return _fullData.athletes.filter(a => a.clube_id === clubId);
}

export function getTopByMedia(count = 10) {
  return getActiveAthletes()
    .sort((a, b) => b.media_num - a.media_num)
    .slice(0, count);
}

export function getTopByPoints(count = 10) {
  return getActiveAthletes()
    .filter(a => a.entrou_em_campo)
    .sort((a, b) => b.pontos_num - a.pontos_num)
    .slice(0, count);
}

export function getMostAppreciated(count = 10) {
  return getActiveAthletes()
    .sort((a, b) => b.variacao_num - a.variacao_num)
    .slice(0, count);
}

export function getMostDepreciated(count = 10) {
  return getActiveAthletes()
    .sort((a, b) => a.variacao_num - b.variacao_num)
    .slice(0, count);
}

export function getBestCostBenefit(count = 10) {
  return getActiveAthletes()
    .filter(a => a.status_id === 7 && a.media_num > 0)
    .sort((a, b) => b.costBenefit - a.costBenefit)
    .slice(0, count);
}
