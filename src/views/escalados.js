// ===== MAIS ESCALADOS VIEW =====
import { getData, formatPrice, formatVariation, getPosition, fetchScoredByRound, fetchScored, fetchMaisEscalados } from '../api.js';
import { isHistoryLoaded, onHistoryLoaded, getRoundScored } from '../history.js';
import { calcPlayerStats } from '../stats.js';

let _selectedRound = null;
let _escParciaisMap = {};
let _escalacoesRank = {}; // atletaId -> rank position (1 = most picked)
let _currentSort = { key: 'rank', dir: 'asc' };
let _currentPos = 0;
let _ranked = [];

export async function renderEscalados(container) {
  const data = getData();
  if (!data) return;

  const { athletes, market } = data;
  _selectedRound = market.rodada_atual;
  const totalRounds = market.rodada_final || 38;

  const probable = athletes.filter(a => a.status_id === 7 && a.jogos_num > 0);

  // Load parciais
  try {
    const scored = await fetchScored();
    const atletas = scored?.atletas || {};
    _escParciaisMap = {};
    Object.entries(atletas).forEach(([id, s]) => {
      _escParciaisMap[parseInt(id)] = s.pontuacao || 0;
    });
  } catch (e) { _escParciaisMap = {}; }

  // Load mais escalados ranking from API (ordered by number of picks)
  try {
    const maisEscData = await fetchMaisEscalados();
    const maisEsc = maisEscData?.atletas || [];
    _escalacoesRank = {};
    maisEsc.forEach((a, idx) => {
      _escalacoesRank[a.atleta_id] = idx + 1;
    });
  } catch (e) { _escalacoesRank = {}; }

  _ranked = buildRanking(probable);
  _currentPos = 0;
  _currentSort = { key: 'rank', dir: 'asc' };

  // Position summary cards
  const posCounts = {};
  [1,2,3,4,5].forEach(p => {
    const pos = getPosition(p);
    const players = probable.filter(a => a.posicao_id === p);
    const avgMedia = players.length > 0 ? players.reduce((s, a) => s + a.media_num, 0) / players.length : 0;
    posCounts[p] = { ...pos, count: players.length, avg: avgMedia };
  });

  container.innerHTML = `
    <div class="animate-in">
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">🔝 Mais Escalados</div>
          <div class="card-subtitle">Jogadores mais populares por posição</div>
        </div>

        <!-- Round Selector -->
        <div style="display:flex;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap">
          <label style="font-size:13px;font-weight:600;color:var(--text-secondary)">Rodada:</label>
          <select id="esc-round-select" class="round-select">
            ${Array.from({ length: totalRounds }, (_, i) => i + 1).map(r => 
              `<option value="${r}" ${r === _selectedRound ? 'selected' : ''}>Rodada ${r}${r === market.rodada_atual ? ' (atual)' : ''}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Position summary -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(120px, 1fr));gap:10px;margin:16px 0">
          ${[1,2,3,4,5].map(p => {
            const pc = posCounts[p];
            return `
            <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;text-align:center;cursor:pointer;transition:all var(--transition-fast);border:1px solid var(--border-color)"
              onclick="window.__filterEscPos(${p})"
              class="esc-pos-btn"
              onmouseover="this.style.borderColor='var(--accent-green)'" onmouseout="this.style.borderColor='var(--border-color)'">
              <div style="font-size:20px;margin-bottom:4px">${pc.icon || '⚽'}</div>
              <div style="font-size:12px;font-weight:700">${pc.nome}</div>
              <div style="font-size:11px;color:var(--text-muted)">${pc.count} prováveis</div>
              <div style="font-size:13px;font-weight:700;color:var(--accent-green);margin-top:4px">${pc.avg.toFixed(2)}</div>
            </div>`;
          }).join('')}
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="pos-btn active" data-escpos="0">📋 Todos</button>
          <button class="pos-btn" data-escpos="1">🧤 GOL</button>
          <button class="pos-btn" data-escpos="2">🏃 LAT</button>
          <button class="pos-btn" data-escpos="3">🛡️ ZAG</button>
          <button class="pos-btn" data-escpos="4">🎯 MEI</button>
          <button class="pos-btn" data-escpos="5">⚽ ATA</button>
        </div>
      </div>

      <div class="card" id="escalados-table"></div>
    </div>
  `;

  // Bind round selector
  document.getElementById('esc-round-select').addEventListener('change', async (e) => {
    const round = parseInt(e.target.value);
    _selectedRound = round;
    await loadRoundData(round, probable);
    renderTable();
  });

  // Bind position filters
  container.querySelectorAll('.pos-btn[data-escpos]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.pos-btn[data-escpos]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _currentPos = parseInt(btn.dataset.escpos);
      renderTable();
    });
  });

  window.__filterEscPos = (pos) => {
    container.querySelectorAll('.pos-btn[data-escpos]').forEach(b => b.classList.remove('active'));
    const btn = container.querySelector(`.pos-btn[data-escpos="${pos}"]`);
    if (btn) btn.classList.add('active');
    _currentPos = pos;
    renderTable();
  };

  window.__sortEsc = (key) => {
    if (_currentSort.key === key) {
      _currentSort.dir = _currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      _currentSort = { key, dir: key === 'rank' ? 'asc' : 'desc' };
    }
    renderTable();
  };

  renderTable();

  if (!isHistoryLoaded()) {
    onHistoryLoaded(() => {
      _ranked = buildRanking(probable);
      renderTable();
    });
  }

  async function loadRoundData(round, probablePlayers) {
    try {
      let scoredAtletas = {};
      if (isHistoryLoaded()) {
        scoredAtletas = getRoundScored(round) || {};
      }
      if (Object.keys(scoredAtletas).length === 0) {
        const scoredData = await fetchScoredByRound(round);
        scoredAtletas = scoredData?.atletas || {};
      }
      _ranked = probablePlayers.map(a => {
        const roundData = scoredAtletas[String(a.atleta_id)];
        const roundPts = roundData?.pontuacao || 0;
        const efficiency = a.preco_num > 0 ? a.media_num / a.preco_num : 0;
        const recentAvg = roundData ? roundPts : a.media_num;
        const popScore = a.media_num * 0.4 + efficiency * 2 + recentAvg * 0.4;
        return { ...a, popScore, recentAvg, efficiency, stats: null };
      });
    } catch (e) {
      _ranked = buildRanking(probablePlayers);
    }
  }
}

function sortHeader(label, key) {
  const isActive = _currentSort.key === key;
  const arrow = isActive ? (_currentSort.dir === 'desc' ? ' ▼' : ' ▲') : '';
  return `<th class="sortable-th ${isActive ? 'active' : ''}" onclick="window.__sortEsc('${key}')" style="cursor:pointer;user-select:none;white-space:nowrap">${label}${arrow}</th>`;
}

function getSortValue(a, key) {
  switch (key) {
    case 'rank': return _escalacoesRank[a.atleta_id] || 99999;
    case 'media': return a.media_num || 0;
    case 'recentAvg': return a.recentAvg || 0;
    case 'parcial': return _escParciaisMap[a.atleta_id] || 0;
    case 'preco': return a.preco_num || 0;
    case 'cb': return a.efficiency || 0;
    case 'variacao': return a.variacao_num || 0;
    default: return 0;
  }
}

function renderTable() {
  const tableEl = document.getElementById('escalados-table');
  if (!tableEl) return;

  let filtered = _currentPos > 0 ? _ranked.filter(a => a.posicao_id === _currentPos) : [..._ranked];

  // Sort
  filtered.sort((a, b) => {
    const va = getSortValue(a, _currentSort.key);
    const vb = getSortValue(b, _currentSort.key);
    return _currentSort.dir === 'asc' ? va - vb : vb - va;
  });

  filtered = filtered.slice(0, 50);

  tableEl.innerHTML = `
    <div class="card-header">
      <div class="card-title">🏅 Ranking de Popularidade</div>
      <div class="card-subtitle">${filtered.length} jogadores · Clique no cabeçalho para ordenar</div>
    </div>
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Jogador</th>
            <th>Pos</th>
            <th>Time</th>
            ${sortHeader('Rank', 'rank')}
            ${sortHeader('Média', 'media')}
            ${sortHeader('Últ. Rod.', 'recentAvg')}
            ${sortHeader('Parcial', 'parcial')}
            ${sortHeader('Preço', 'preco')}
            ${sortHeader('C/B', 'cb')}
            ${sortHeader('Var', 'variacao')}
          </tr>
        </thead>
        <tbody>
          ${filtered.map((a, i) => {
            const varClass = a.variacao_num > 0 ? 'value-positive' : a.variacao_num < 0 ? 'value-negative' : 'value-neutral';
            const rank = _escalacoesRank[a.atleta_id];
            const parcial = _escParciaisMap[a.atleta_id];
            const parcialColor = (parcial || 0) > 0 ? 'var(--accent-green)' : (parcial || 0) < 0 ? 'var(--accent-red)' : 'var(--text-muted)';
            return `
            <tr>
              <td><span class="player-list-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span></td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <img src="${a.clubBadge}" alt="" class="club-badge" onerror="this.style.display='none'">
                  <span style="font-weight:600;cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\\\'")}')"
                    onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</span>
                </div>
              </td>
              <td><span class="position-badge ${a.position.class}">${a.position.abr}</span></td>
              <td style="font-size:11px">${a.clubName}</td>
              <td style="font-weight:800;color:var(--accent-blue)">${rank ? '#' + rank : '-'}</td>
              <td style="font-weight:700;color:var(--accent-green)">${a.media_num.toFixed(2)}</td>
              <td style="color:var(--accent-gold)">${a.recentAvg.toFixed(1)}</td>
              <td style="font-weight:700;color:${parcialColor}">${parcial != null ? parcial.toFixed(1) : '-'}</td>
              <td>${formatPrice(a.preco_num)}</td>
              <td style="font-size:12px">${a.efficiency.toFixed(2)}</td>
              <td class="${varClass}">${formatVariation(a.variacao_num)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function buildRanking(probable) {
  return probable.map(a => {
    let stats = null;
    let recentAvg = a.media_num;
    if (isHistoryLoaded()) {
      stats = calcPlayerStats(a.atleta_id);
      if (stats && stats.history.length > 0) {
        recentAvg = stats.history.slice(-3).reduce((s, h) => s + h.pontuacao, 0) / Math.max(stats.history.slice(-3).length, 1);
      }
    }
    const efficiency = a.preco_num > 0 ? a.media_num / a.preco_num : 0;
    const popScore = a.media_num * 0.6 + efficiency * 3 + recentAvg * 0.2;
    return { ...a, popScore, recentAvg, stats, efficiency };
  });
}

export function destroyEscalados() {
  delete window.__filterEscPos;
  delete window.__sortEsc;
}
