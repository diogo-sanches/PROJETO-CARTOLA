// ===== RECOMMENDATIONS VIEW =====
// Strategy tabs + Position submenu on ALL tabs
import { getData, getClubAthletes, formatPrice, formatVariation, fetchMatchesByRound, fetchScored } from '../api.js';
import { isHistoryLoaded, onHistoryLoaded, getClubMatches } from '../history.js';
import { calcPlayerStats, calcClubStats, analyzeConfronto } from '../stats.js';

let _matchContext = {}; // clubId -> { isHome, opponentId, opponentName, opponentStrength }
let _matchContextLoaded = false;
let _recParciaisMap = {}; // atletaId -> pontuacao

async function loadMatchContext() {
  if (_matchContextLoaded) return;
  try {
    const data = getData();
    if (!data) return;
    const round = data.market.rodada_atual;
    const matchData = await fetchMatchesByRound(round);
    const matches = matchData.partidas || [];
    const clubsMap = matchData.clubes || {};

    // Build strength map from league standings
    const strengthMap = {};
    if (isHistoryLoaded()) {
      const clubIds = Object.keys(data.clubs).map(Number);
      const standings = clubIds.map(id => {
        const stats = calcClubStats(id);
        return { id, aprov: stats?.aproveitamento || 0 };
      }).sort((a, b) => b.aprov - a.aprov);
      const maxAprov = standings[0]?.aprov || 100;
      standings.forEach(s => { strengthMap[s.id] = maxAprov > 0 ? s.aprov / maxAprov : 0; });
    }

    _matchContext = {};
    matches.forEach(m => {
      const homeId = m.clube_casa_id;
      const awayId = m.clube_visitante_id;
      const homeName = clubsMap[homeId]?.nome_fantasia || '?';
      const awayName = clubsMap[awayId]?.nome_fantasia || '?';

      _matchContext[homeId] = {
        isHome: true,
        opponentId: awayId,
        opponentName: awayName,
        opponentStrength: strengthMap[awayId] || 0.5,
      };
      _matchContext[awayId] = {
        isHome: false,
        opponentId: homeId,
        opponentName: homeName,
        opponentStrength: strengthMap[homeId] || 0.5,
      };
    });
    _matchContextLoaded = true;
  } catch (e) {
    console.warn('Could not load match context for recommendations:', e);
  }

  // Load parciais
  try {
    const scored = await fetchScored();
    const atletas = scored?.atletas || {};
    _recParciaisMap = {};
    Object.entries(atletas).forEach(([id, s]) => {
      _recParciaisMap[parseInt(id)] = s.pontuacao || 0;
    });
  } catch { _recParciaisMap = {}; }
}

let currentTab = 'mitar';
let currentPos = 0; // 0 = todos, 1-6 = posição específica
let currentSort = { key: 'mitarScore', dir: 'desc' }; // sortable columns

const TABS = [
  { id: 'mitar', label: '🔥 Mitar', desc: 'Alta média + consistência + contexto favorável (Liga Clássica)' },
  { id: 'tirocurto', label: '🎯 Tiro Curto', desc: 'Potencial explosivo + baixa escalação (Liga de Rodada Única)' },
  { id: 'ferrolho', label: '🔒 Ferrolho', desc: 'Defesa completa de 1 time com alta chance de SG' },
  { id: 'artilharia', label: '⚔️ Artilharia', desc: 'Times com maior potencial ofensivo — MEI e ATA recomendados' },
  { id: 'valorizar', label: '📈 Valorizar', desc: 'Jogadores baratos com potencial de valorização' },
  { id: 'custo', label: '💰 Custo-Benefício', desc: 'Melhor rendimento por preço por posição' },
  { id: 'consistentes', label: '🎯 Consistentes', desc: 'Jogadores regulares, sem dente de serra' },
  { id: 'evitar', label: '⛔ Evitar', desc: 'Lesionados, suspensos e em queda' },
];

const POSITIONS = [
  { id: 0, label: 'Todos', icon: '📋' },
  { id: 1, label: 'Goleiros', icon: '🧤' },
  { id: 2, label: 'Laterais', icon: '🏃' },
  { id: 3, label: 'Zagueiros', icon: '🛡️' },
  { id: 4, label: 'Meias', icon: '🎯' },
  { id: 5, label: 'Atacantes', icon: '⚽' },
];

export function renderRecommendations(container) {
  const data = getData();
  if (!data) return;

  container.innerHTML = `
    <div class="animate-in">
      <!-- Strategy Tabs -->
      <div class="card" style="margin-bottom:12px;padding:16px">
        <div class="rec-tabs" id="rec-tabs">
          ${TABS.map(t => `
            <button class="rec-tab ${t.id === currentTab ? 'active' : ''}" data-tab="${t.id}">
              ${t.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Position SubMenu -->
      <div class="card" style="margin-bottom:20px;padding:12px" id="pos-submenu-card">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:12px;font-weight:600;color:var(--text-muted);white-space:nowrap">Posição:</span>
          <div class="pos-submenu" id="pos-submenu">
            ${POSITIONS.map(p => `
              <button class="pos-btn ${p.id === currentPos ? 'active' : ''}" data-pos="${p.id}">
                ${p.icon} ${p.label}
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Tab Content -->
      <div id="rec-content"></div>
    </div>
  `;

  // Tab click handlers
  document.querySelectorAll('#rec-tabs .rec-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('#rec-tabs .rec-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTabContent();
    });
  });

  // Position submenu click handlers
  document.querySelectorAll('#pos-submenu .pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPos = parseInt(btn.dataset.pos);
      document.querySelectorAll('#pos-submenu .pos-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTabContent();
    });
  });

  loadMatchContext().then(() => renderTabContent());
}

// Filter athletes by selected position
function filterByPos(athletes) {
  if (currentPos === 0) return athletes;
  return athletes.filter(a => a.posicao_id === currentPos);
}

function getPosLabel() {
  const pos = POSITIONS.find(p => p.id === currentPos);
  return pos ? `${pos.icon} ${pos.label}` : '';
}

function renderTabContent() {
  const content = document.getElementById('rec-content');
  if (!content) return;

  const data = getData();
  if (!data) return;

  const tab = TABS.find(t => t.id === currentTab);
  const posLabel = currentPos > 0 ? ` — ${getPosLabel()}` : '';

  content.innerHTML = `
    <div class="animate-in">
      <div style="margin-bottom:20px">
        <h3 style="font-size:18px;font-weight:700;margin-bottom:4px">${tab.label}${posLabel}</h3>
        <p style="color:var(--text-secondary);font-size:13px">${tab.desc}</p>
      </div>
      <div id="rec-tab-body">
        ${!isHistoryLoaded() && ['mitar', 'tirocurto', 'ferrolho', 'artilharia', 'consistentes'].includes(currentTab) ? `
          <div class="card" style="text-align:center;padding:30px">
            <div class="loading-spinner" style="margin:0 auto 12px"></div>
            <p style="color:var(--text-secondary);font-size:13px">Carregando dados históricos para análise avançada...</p>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  const body = document.getElementById('rec-tab-body');

  switch (currentTab) {
    case 'mitar': renderMitar(body, data); break;
    case 'tirocurto': renderTiroCurto(body, data); break;
    case 'ferrolho': renderFerrolho(body, data); break;
    case 'artilharia': renderArtilharia(body, data); break;
    case 'valorizar': renderValorizar(body, data); break;
    case 'custo': renderCustoBeneficio(body, data); break;
    case 'consistentes': renderConsistentes(body, data); break;
    case 'evitar': renderEvitar(body, data); break;
  }
}

// Sort helper
function sortBy(arr, key, dir) {
  return [...arr].sort((a, b) => {
    let va = 0, vb = 0;
    switch(key) {
      case 'mitarScore': va = a.mitarScore || 0; vb = b.mitarScore || 0; break;
      case 'media': va = a.media_num || 0; vb = b.media_num || 0; break;
      case 'recentAvg': va = a.recentAvg || 0; vb = b.recentAvg || 0; break;
      case 'preco': va = a.preco_num || 0; vb = b.preco_num || 0; break;
      case 'consistencia': va = a.stats?.consistencia || 0; vb = b.stats?.consistencia || 0; break;
      case 'trend': va = a.stats?.trend || 0; vb = b.stats?.trend || 0; break;
      case 'jogos': va = a.jogos_num || 0; vb = b.jogos_num || 0; break;
      case 'variacao': va = a.variacao_num || 0; vb = b.variacao_num || 0; break;
      case 'ratio': va = a.ratio || 0; vb = b.ratio || 0; break;
      case 'desvio': va = a.stats?.desvioPadrao || 0; vb = b.stats?.desvioPadrao || 0; break;
      case 'tiroScore': va = a.tiroScore || 0; vb = b.tiroScore || 0; break;
      default: va = a.media_num || 0; vb = b.media_num || 0;
    }
    return dir === 'desc' ? vb - va : va - vb;
  });
}

function sortHeader(label, key) {
  const isActive = currentSort.key === key;
  const arrow = isActive ? (currentSort.dir === 'desc' ? ' ▼' : ' ▲') : '';
  return `<th class="sortable-th ${isActive ? 'active' : ''}" data-sort="${key}" style="cursor:pointer;user-select:none;white-space:nowrap">${label}${arrow}</th>`;
}

function bindSortHeaders(tableId) {
  document.querySelectorAll(`#${tableId} .sortable-th`).forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (currentSort.key === key) {
        currentSort.dir = currentSort.dir === 'desc' ? 'asc' : 'desc';
      } else {
        currentSort = { key, dir: 'desc' };
      }
      renderTabContent();
    });
  });
}

// ============================
// TAB: 🔥 MITAR (Liga Clássica — Consistência)
// ============================
function renderMitar(body, data) {
  const { athletes } = data;
  const probable = filterByPos(athletes.filter(a => a.status_id === 7 && a.jogos_num > 0));

  if (isHistoryLoaded()) {
    let scored = probable.map(a => {
      const stats = calcPlayerStats(a.atleta_id);
      if (!stats) return { ...a, mitarScore: a.media_num, recentAvg: a.media_num, stats: null, matchBonus: 0 };

      const recentAvg = stats.history.slice(-3).reduce((s, h) => s + h.pontuacao, 0) / Math.max(stats.history.slice(-3).length, 1);
      
      // CONSISTENCY-FOCUSED SCORING (Liga Clássica)
      // 1. Overall média (35%) — the backbone
      const mediaScore = stats.media * 0.35;
      
      // 2. Consistency (25%) — low variance = reliable
      const consistScore = (stats.consistencia >= 4 ? 3 : stats.consistencia >= 3 ? 2 : stats.consistencia >= 2 ? 1 : 0) * 0.25;
      
      // 3. Match context (20%) — favorable game
      let matchBonus = 0;
      const ctx = _matchContext[a.clube_id];
      if (ctx) {
        matchBonus += ctx.isHome ? 1.0 : -0.3;
        matchBonus += (0.5 - ctx.opponentStrength) * 2;
        if ([1, 2, 3].includes(a.posicao_id) && !ctx.isHome && ctx.opponentStrength > 0.6) {
          matchBonus -= 1.0;
        }
      }
      const contextScore = matchBonus * 0.20;
      
      // 4. Trend (10%) — rising form
      const trendScore = (stats.trend > 0 ? stats.trend * 1.5 : stats.trend * 0.5) * 0.10;
      
      // 5. Price protection (10%) — penalize very expensive players that might devalue
      const priceRisk = a.preco_num > 15 ? -0.5 : a.preco_num > 10 ? 0 : 0.5;
      const priceScore = priceRisk * 0.10;

      const mitarScore = mediaScore + consistScore + contextScore + trendScore + priceScore;
      
      return { ...a, mitarScore, recentAvg, stats, matchBonus };
    });

    scored = sortBy(scored, currentSort.key, currentSort.dir).slice(0, 20);

    body.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔥 Top para Mitar ${currentPos > 0 ? `— ${getPosLabel()}` : ''}</div>
          <div class="card-subtitle">${scored.length} jogadores · Clique no cabeçalho para ordenar</div>
        </div>
        <div class="table-container">
          <table class="data-table" id="mitar-table">
            <thead><tr>
              <th>#</th>
              <th>Jogador</th>
              <th>Pos</th>
              ${sortHeader('Score', 'mitarScore')}
              ${sortHeader('Média', 'media')}
              ${sortHeader('Últ. Rod.', 'recentAvg')}
              <th>Parcial</th>
              ${sortHeader('Preço', 'preco')}
              ${sortHeader('Consist.', 'consistencia')}
              ${sortHeader('Trend', 'trend')}
            </tr></thead>
            <tbody>
              ${scored.map((a, i) => {
                const trend = a.stats?.trend > 0.5 ? '📈' : a.stats?.trend < -0.5 ? '📉' : '➡️';
                const stars = a.stats ? '★'.repeat(a.stats.consistencia) + '☆'.repeat(5 - a.stats.consistencia) : '-';
                return `
                <tr>
                  <td><span class="player-list-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span></td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px">
                      <img src="${a.clubBadge}" alt="" class="club-badge" onerror="this.style.display='none'">
                      <div>
                        <span style="font-weight:600;cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\'")}')"
                          onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</span>
                        <span style="font-size:10px;color:var(--text-muted);display:block">${a.clubName}</span>
                      </div>
                    </div>
                  </td>
                  <td><span class="position-badge ${a.position.class}">${a.position.abr}</span></td>
                  <td style="font-weight:800;color:var(--accent-gold)">${a.mitarScore.toFixed(1)}</td>
                  <td style="font-weight:700;color:var(--accent-green)">${a.media_num.toFixed(2)}</td>
                  <td style="color:var(--accent-gold)">${a.recentAvg?.toFixed(1) || '-'}</td>
                  <td style="font-weight:700;color:${(_recParciaisMap[a.atleta_id] || 0) > 0 ? 'var(--accent-green)' : (_recParciaisMap[a.atleta_id] || 0) < 0 ? 'var(--accent-red)' : 'var(--text-muted)'}">${_recParciaisMap[a.atleta_id] != null ? _recParciaisMap[a.atleta_id].toFixed(1) : '-'}</td>
                  <td>${formatPrice(a.preco_num)}</td>
                  <td style="font-size:12px">${stars}</td>
                  <td>${trend}</td>
                </tr>`;
              }).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:20px">Nenhum jogador encontrado</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    bindSortHeaders('mitar-table');
  } else {
    const byMedia = probable.sort((a, b) => b.media_num - a.media_num).slice(0, 15);
    body.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">⭐ Top por Média (Prováveis) ${currentPos > 0 ? `— ${getPosLabel()}` : ''}</div>
          <div class="card-subtitle">Dados avançados disponíveis após carregamento do histórico</div>
        </div>
        ${byMedia.map((a, i) => renderSimpleCard(a, i)).join('')}
      </div>
    `;
    onHistoryLoaded(() => { if (currentTab === 'mitar') renderTabContent(); });
  }
}

function renderMitarCard(a, idx) {
  const trend = a.stats?.trend > 0.5 ? '📈' : a.stats?.trend < -0.5 ? '📉' : '➡️';
  const stars = a.stats ? '★'.repeat(a.stats.consistencia) + '☆'.repeat(5 - a.stats.consistencia) : '';
  return `
    <div class="rec-card">
      <span class="player-list-rank ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}">${idx + 1}</span>
      <img src="${a.clubBadge60 || a.clubBadge}" alt="" style="width:32px;height:32px;border-radius:50%;border:2px solid var(--border-color)" onerror="this.style.display='none'">
      <div class="player-list-details" style="cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\'")}')">
        <div class="player-name" style="transition:color 0.15s" onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</div>
        <div class="player-full-name">${a.clubName} · ${a.position.abr}</div>
      </div>
      <div class="rec-metrics">
        <div class="rec-metric"><div class="rec-metric-label">Média</div><div class="rec-metric-value" style="color:var(--accent-green)">${a.media_num.toFixed(2)}</div></div>
        <div class="rec-metric"><div class="rec-metric-label">Recente</div><div class="rec-metric-value" style="color:var(--accent-gold)">${a.recentAvg?.toFixed(1) || '-'}</div></div>
        <div class="rec-metric"><div class="rec-metric-label">Preço</div><div class="rec-metric-value">${formatPrice(a.preco_num)}</div></div>
        <div class="rec-metric"><div class="rec-metric-label">Trend</div><div class="rec-metric-value">${trend}</div></div>
        <div class="rec-metric"><div class="rec-metric-label">Consist.</div><div class="rec-metric-value" style="font-size:12px">${stars}</div></div>
      </div>
    </div>
  `;
}

// ============================
// TAB: 🎯 TIRO CURTO (Liga de Rodada Única)
// ============================
function renderTiroCurto(body, data) {
  const { athletes, market } = data;
  const probable = filterByPos(athletes.filter(a => a.status_id === 7 && a.jogos_num > 0));

  if (isHistoryLoaded()) {
    let scored = probable.map(a => {
      const stats = calcPlayerStats(a.atleta_id);
      if (!stats) return { ...a, tiroScore: 0, stats: null, bestScore: 0, escalacao: 0 };

      // 1. Ceiling (30%) — best performance ever (explosive potential)
      const bestScore = stats.history.length > 0 ? Math.max(...stats.history.map(h => h.pontuacao)) : 0;
      const ceilingScore = (bestScore / 20) * 0.30; // normalize: 20pts = max realistic

      // 2. Recent high (25%) — recent explosive rounds
      const recent = stats.history.slice(-5);
      const recentBest = recent.length > 0 ? Math.max(...recent.map(h => h.pontuacao)) : 0;
      const recentScore = (recentBest / 20) * 0.25;

      // 3. Low ownership = differential (20%)
      // Use escalacao percentage (lower = better for tiro curto)
      const escalacao = a.escalacao_num || 0; // percentage of users who picked
      const diffScore = Math.max(0, (20 - escalacao) / 20) * 0.20; // max at 0%, zero at 20%+

      // 4. Favorable matchup (15%)
      let matchupScore = 0;
      const ctx = _matchContext[a.clube_id];
      if (ctx) {
        matchupScore = ((1 - ctx.opponentStrength) + (ctx.isHome ? 0.3 : 0)) * 0.15;
      }

      // 5. Offensive scouts (10%) — players who get goals/assists
      const offensiveRounds = stats.history.filter(h => h.pontuacao > 8).length;
      const offScore = (offensiveRounds / Math.max(stats.history.length, 1)) * 0.10;

      const tiroScore = ceilingScore + recentScore + diffScore + matchupScore + offScore;

      return { ...a, tiroScore, stats, bestScore, escalacao, recentBest };
    });

    scored = sortBy(scored, currentSort.key === 'mitarScore' ? 'tiroScore' : currentSort.key, currentSort.dir).slice(0, 20);

    body.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🎯 Top Tiro Curto ${currentPos > 0 ? `— ${getPosLabel()}` : ''}</div>
          <div class="card-subtitle">${scored.length} jogadores · Potencial explosivo + baixa escalação</div>
        </div>
        <div class="table-container">
          <table class="data-table" id="tiro-table">
            <thead><tr>
              <th>#</th>
              <th>Jogador</th>
              <th>Pos</th>
              ${sortHeader('Score', 'tiroScore')}
              ${sortHeader('Melhor', 'bestScore')}
              ${sortHeader('Média', 'media')}
              ${sortHeader('Preço', 'preco')}
              <th>Escal.%</th>
              <th>Contexto</th>
            </tr></thead>
            <tbody>
              ${scored.map((a, i) => {
                const ctx = _matchContext[a.clube_id];
                const mandoTag = ctx ? (ctx.isHome ? '🏠' : '✈️') : '';
                const escalPct = (a.escalacao || 0).toFixed(1);
                const escalColor = a.escalacao < 5 ? 'var(--accent-green)' : a.escalacao < 15 ? 'var(--accent-orange)' : 'var(--accent-red)';
                return `
                <tr>
                  <td><span class="player-list-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span></td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px">
                      <img src="${a.clubBadge}" alt="" class="club-badge" onerror="this.style.display='none'">
                      <div>
                        <span style="font-weight:600">${a.apelido}</span>
                        <span style="font-size:10px;color:var(--text-muted);display:block">${a.clubName}</span>
                      </div>
                    </div>
                  </td>
                  <td><span class="position-badge ${a.position.class}">${a.position.abr}</span></td>
                  <td style="font-weight:800;color:var(--accent-gold)">${a.tiroScore.toFixed(2)}</td>
                  <td style="color:var(--accent-green);font-weight:700">${a.bestScore.toFixed(1)}</td>
                  <td>${a.media_num.toFixed(2)}</td>
                  <td>${formatPrice(a.preco_num)}</td>
                  <td style="color:${escalColor};font-weight:600">${escalPct}%</td>
                  <td>${mandoTag} ${ctx ? 'vs ' + ctx.opponentName : ''}</td>
                </tr>`;
              }).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:20px">Nenhum jogador encontrado</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    bindSortHeaders('tiro-table');
  } else {
    body.innerHTML = `<div class="card" style="text-align:center;padding:30px"><p style="color:var(--text-muted)">Aguardando dados históricos...</p></div>`;
    onHistoryLoaded(() => { if (currentTab === 'tirocurto') renderTabContent(); });
  }
}

// ============================
// TAB: 🔒 FERROLHO (Defesa completa de 1 time)
// ============================
function renderFerrolho(body, data) {
  const { athletes, clubs, market } = data;

  if (!isHistoryLoaded()) {
    body.innerHTML = `<div class="card" style="text-align:center;padding:30px"><p style="color:var(--text-muted)">Aguardando dados históricos...</p></div>`;
    onHistoryLoaded(() => { if (currentTab === 'ferrolho') renderTabContent(); });
    return;
  }

  // Compute league home/away averages for Dixon-Coles
  const clubIds = Object.keys(clubs).map(Number);
  let lHGM=0,lHGS=0,lAGM=0,lAGS=0,lHG=0,lAG=0;
  clubIds.forEach(id => {
    const m = getClubMatches(id); if (!m?.length) return;
    const h=m.filter(x=>x.isHome), a=m.filter(x=>!x.isHome);
    lHGM+=h.reduce((s,x)=>s+x.goalsFor,0); lHGS+=h.reduce((s,x)=>s+x.goalsAgainst,0);
    lAGM+=a.reduce((s,x)=>s+x.goalsFor,0); lAGS+=a.reduce((s,x)=>s+x.goalsAgainst,0);
    lHG+=h.length; lAG+=a.length;
  });
  const aHGM=lHG>0?lHGM/lHG:1, aHGS=lHG>0?lHGS/lHG:1;
  const aAGM=lAG>0?lAGM/lAG:1, aAGS=lAG>0?lAGS/lAG:1;

  // Calculate SG probability for each team this round
  const teamSG = [];
  Object.entries(_matchContext).forEach(([clubIdStr, ctx]) => {
    const clubId = parseInt(clubIdStr);
    const oppId = ctx.opponentId;
    const myMatches = getClubMatches(clubId);
    const oppMatches = getClubMatches(oppId);
    if (!myMatches?.length || !oppMatches?.length) return;

    const myHome = myMatches.filter(m => m.isHome);
    const myAway = myMatches.filter(m => !m.isHome);
    const oppHome = oppMatches.filter(m => m.isHome);
    const oppAway = oppMatches.filter(m => !m.isHome);

    let expGoalsAgainst;
    if (ctx.isHome) {
      const oppAGM = oppAway.length>0 ? oppAway.reduce((s,m)=>s+m.goalsFor,0)/oppAway.length : 0;
      const myHGS = myHome.length>0 ? myHome.reduce((s,m)=>s+m.goalsAgainst,0)/myHome.length : 0;
      expGoalsAgainst = (oppAGM/Math.max(aAGM,0.3)) * (myHGS/Math.max(aHGS,0.3)) * aAGM;
    } else {
      const oppHGM = oppHome.length>0 ? oppHome.reduce((s,m)=>s+m.goalsFor,0)/oppHome.length : 0;
      const myAGS = myAway.length>0 ? myAway.reduce((s,m)=>s+m.goalsAgainst,0)/myAway.length : 0;
      expGoalsAgainst = (oppHGM/Math.max(aHGM,0.3)) * (myAGS/Math.max(aAGS,0.3)) * aHGM;
    }

    // SG probability estimate (Poisson P(0) = e^(-lambda))
    const pSG = Math.exp(-expGoalsAgainst);

    // Recent SG form (last 5 matches in the relevant context)
    const relevantMatches = ctx.isHome ? myHome.slice(-5) : myAway.slice(-5);
    const recentSGs = relevantMatches.filter(m => m.goalsAgainst === 0).length;

    // Count available defenders (status = Provável)
    const defenders = athletes.filter(a => a.clube_id === clubId && a.status_id === 7 && [1, 2, 3].includes(a.posicao_id));
    const clubName = clubs[clubId]?.nome_fantasia || '?';
    const clubBadge = clubs[clubId]?.escudos?.['30x30'] || '';

    teamSG.push({
      clubId, clubName, clubBadge, ctx,
      expGoalsAgainst, pSG, recentSGs,
      relevantGames: relevantMatches.length,
      defenders,
      defenderCount: defenders.length,
    });
  });

  teamSG.sort((a, b) => b.pSG - a.pSG);

  body.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div class="card-title">🔒 Ranking de Ferrolho</div>
        <div class="card-subtitle">Times ordenados por probabilidade de SG · Baseado no modelo Dixon-Coles</div>
      </div>
      <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:8px">
        Estratégia: Escalar GOL + LAT + ZAG do mesmo time para multiplicar SG (5pts cada)
      </div>
    </div>
    ${teamSG.slice(0, 10).map((t, i) => {
      const pctSG = (t.pSG * 100).toFixed(0);
      const barColor = t.pSG > 0.5 ? 'var(--accent-green)' : t.pSG > 0.3 ? 'var(--accent-orange)' : 'var(--accent-red)';
      const mandoIcon = t.ctx.isHome ? '🏠 Casa' : '✈️ Fora';
      return `
        <div class="card" style="margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;flex-wrap:wrap">
            <span style="font-size:20px;font-weight:800;color:var(--text-muted);min-width:30px">#${i + 1}</span>
            <img src="${t.clubBadge}" alt="" style="width:32px;height:32px" onerror="this.style.display='none'">
            <div>
              <div style="font-weight:700;font-size:16px">${t.clubName}</div>
              <div style="font-size:11px;color:var(--text-muted)">${mandoIcon} vs ${t.ctx.opponentName}</div>
            </div>
            <div style="margin-left:auto;text-align:right">
              <div style="font-size:24px;font-weight:800;color:${barColor}">${pctSG}%</div>
              <div style="font-size:10px;color:var(--text-muted)">Prob. SG</div>
            </div>
          </div>
          <div style="background:var(--bg-tertiary);border-radius:6px;height:8px;overflow:hidden;margin-bottom:12px">
            <div style="width:${pctSG}%;height:100%;background:${barColor};border-radius:6px;transition:width 0.3s"></div>
          </div>
          <div style="display:flex;gap:16px;font-size:12px;color:var(--text-secondary);margin-bottom:12px;flex-wrap:wrap">
            <span>📊 Gols esperados contra: <b style="color:var(--accent-gold)">${t.expGoalsAgainst.toFixed(2)}</b></span>
            <span>🛡️ SG recentes: <b>${t.recentSGs}/${t.relevantGames}</b></span>
            <span>👥 Defensores disponíveis: <b style="color:${t.defenderCount >= 4 ? 'var(--accent-green)' : 'var(--accent-orange)'}">${t.defenderCount}</b></span>
          </div>
          ${t.defenderCount > 0 ? `
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${t.defenders.map(d => {
              const pos = { 1: { abr: 'GOL', cls: 'gol' }, 2: { abr: 'LAT', cls: 'lat' }, 3: { abr: 'ZAG', cls: 'zag' } }[d.posicao_id] || { abr: '?', cls: '' };
              return `<div style="background:var(--bg-tertiary);border-radius:8px;padding:6px 10px;font-size:11px;display:flex;align-items:center;gap:6px">
                <span class="position-badge ${pos.cls}" style="font-size:9px;padding:1px 4px">${pos.abr}</span>
                <span style="font-weight:600">${d.apelido}</span>
                <span style="color:var(--text-muted)">Média ${d.media_num.toFixed(1)}</span>
                <span style="color:var(--accent-green)">${formatPrice(d.preco_num)}</span>
              </div>`;
            }).join('')}
          </div>
          ` : '<p style="color:var(--text-muted);font-size:12px">Sem defensores disponíveis (Provável)</p>'}
        </div>
      `;
    }).join('')}
  `;
}

// ============================
// TAB: ⚔️ ARTILHARIA (Times com maior potencial ofensivo)
// ============================
function renderArtilharia(body, data) {
  const { athletes, clubs, market } = data;

  if (!isHistoryLoaded()) {
    body.innerHTML = `<div class="card" style="text-align:center;padding:30px"><p style="color:var(--text-muted)">Aguardando dados históricos...</p></div>`;
    onHistoryLoaded(() => { if (currentTab === 'artilharia') renderTabContent(); });
    return;
  }

  // Compute league home/away averages (Dixon-Coles)
  const clubIds = Object.keys(clubs).map(Number);
  let lHGM=0,lHGS=0,lAGM=0,lAGS=0,lHG=0,lAG=0;
  clubIds.forEach(id => {
    const m = getClubMatches(id); if (!m?.length) return;
    const h=m.filter(x=>x.isHome), a=m.filter(x=>!x.isHome);
    lHGM+=h.reduce((s,x)=>s+x.goalsFor,0); lHGS+=h.reduce((s,x)=>s+x.goalsAgainst,0);
    lAGM+=a.reduce((s,x)=>s+x.goalsFor,0); lAGS+=a.reduce((s,x)=>s+x.goalsAgainst,0);
    lHG+=h.length; lAG+=a.length;
  });
  const aHGM=lHG>0?lHGM/lHG:1, aHGS=lHG>0?lHGS/lHG:1;
  const aAGM=lAG>0?lAGM/lAG:1, aAGS=lAG>0?lAGS/lAG:1;

  // Calculate expected goals FOR each team this round
  const teamAtk = [];
  Object.entries(_matchContext).forEach(([clubIdStr, ctx]) => {
    const clubId = parseInt(clubIdStr);
    const oppId = ctx.opponentId;
    const myMatches = getClubMatches(clubId);
    const oppMatches = getClubMatches(oppId);
    if (!myMatches?.length || !oppMatches?.length) return;

    const myHome = myMatches.filter(m => m.isHome);
    const myAway = myMatches.filter(m => !m.isHome);
    const oppHome = oppMatches.filter(m => m.isHome);
    const oppAway = oppMatches.filter(m => !m.isHome);

    let expGoalsFor;
    if (ctx.isHome) {
      // I'm home → my home attack vs opponent's away defense
      const myHGM = myHome.length>0 ? myHome.reduce((s,m)=>s+m.goalsFor,0)/myHome.length : 0;
      const oppAGS = oppAway.length>0 ? oppAway.reduce((s,m)=>s+m.goalsAgainst,0)/oppAway.length : 0;
      expGoalsFor = (myHGM/Math.max(aHGM,0.3)) * (oppAGS/Math.max(aAGS,0.3)) * aHGM;
    } else {
      // I'm away → my away attack vs opponent's home defense
      const myAGM = myAway.length>0 ? myAway.reduce((s,m)=>s+m.goalsFor,0)/myAway.length : 0;
      const oppHGS = oppHome.length>0 ? oppHome.reduce((s,m)=>s+m.goalsAgainst,0)/oppHome.length : 0;
      expGoalsFor = (myAGM/Math.max(aAGM,0.3)) * (oppHGS/Math.max(aHGS,0.3)) * aAGM;
    }

    // Prob of scoring at least 1 goal: P(X>=1) = 1 - P(0) = 1 - e^(-lambda)
    const pGol = 1 - Math.exp(-expGoalsFor);

    // Recent goal-scoring form (last 5 matches in relevant context)
    const relevantMatches = ctx.isHome ? myHome.slice(-5) : myAway.slice(-5);
    const recentGoals = relevantMatches.reduce((s, m) => s + m.goalsFor, 0);
    const gamesWithGoals = relevantMatches.filter(m => m.goalsFor > 0).length;

    // Available attackers (MEI + ATA with status = Provável)
    const attackers = athletes.filter(a => a.clube_id === clubId && a.status_id === 7 && [4, 5].includes(a.posicao_id));
    const clubName = clubs[clubId]?.nome_fantasia || '?';
    const clubBadge = clubs[clubId]?.escudos?.['30x30'] || '';

    teamAtk.push({
      clubId, clubName, clubBadge, ctx,
      expGoalsFor, pGol, recentGoals,
      gamesWithGoals, relevantGames: relevantMatches.length,
      attackers,
      attackerCount: attackers.length,
    });
  });

  teamAtk.sort((a, b) => b.expGoalsFor - a.expGoalsFor);

  body.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div class="card-title">⚔️ Ranking de Artilharia</div>
        <div class="card-subtitle">Times ordenados por gols esperados · Baseado no modelo Dixon-Coles</div>
      </div>
      <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:8px">
        Estratégia: Escalar MEI e ATA de times com alto potencial ofensivo para maximizar G (8pts) e A (5pts)
      </div>
    </div>
    ${teamAtk.slice(0, 10).map((t, i) => {
      const pctGol = (t.pGol * 100).toFixed(0);
      const barColor = t.expGoalsFor > 1.8 ? 'var(--accent-green)' : t.expGoalsFor > 1.2 ? 'var(--accent-orange)' : 'var(--accent-red)';
      const mandoIcon = t.ctx.isHome ? '🏠 Casa' : '✈️ Fora';
      const avgGoals = t.relevantGames > 0 ? (t.recentGoals / t.relevantGames).toFixed(1) : '0.0';
      return `
        <div class="card" style="margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;flex-wrap:wrap">
            <span style="font-size:20px;font-weight:800;color:var(--text-muted);min-width:30px">#${i + 1}</span>
            <img src="${t.clubBadge}" alt="" style="width:32px;height:32px" onerror="this.style.display='none'">
            <div>
              <div style="font-weight:700;font-size:16px">${t.clubName}</div>
              <div style="font-size:11px;color:var(--text-muted)">${mandoIcon} vs ${t.ctx.opponentName}</div>
            </div>
            <div style="margin-left:auto;text-align:right">
              <div style="font-size:24px;font-weight:800;color:${barColor}">${t.expGoalsFor.toFixed(2)}</div>
              <div style="font-size:10px;color:var(--text-muted)">Gols esperados</div>
            </div>
          </div>
          <div style="background:var(--bg-tertiary);border-radius:6px;height:8px;overflow:hidden;margin-bottom:12px">
            <div style="width:${Math.min(pctGol, 100)}%;height:100%;background:${barColor};border-radius:6px;transition:width 0.3s"></div>
          </div>
          <div style="display:flex;gap:16px;font-size:12px;color:var(--text-secondary);margin-bottom:12px;flex-wrap:wrap">
            <span>🎯 Prob. marcar: <b style="color:var(--accent-gold)">${pctGol}%</b></span>
            <span>⚽ Gols recentes: <b>${t.recentGoals} em ${t.relevantGames} jogos</b> (${avgGoals}/jogo)</span>
            <span>🔥 Jogos com gol: <b style="color:${t.gamesWithGoals >= 4 ? 'var(--accent-green)' : 'var(--accent-orange)'}">${t.gamesWithGoals}/${t.relevantGames}</b></span>
            <span>👥 Atacantes disponíveis: <b style="color:${t.attackerCount >= 4 ? 'var(--accent-green)' : 'var(--accent-orange)'}">${t.attackerCount}</b></span>
          </div>
          ${t.attackerCount > 0 ? `
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${t.attackers.sort((a, b) => b.media_num - a.media_num).map(d => {
              const pos = d.posicao_id === 4 ? { abr: 'MEI', cls: 'mei' } : { abr: 'ATA', cls: 'ata' };
              const parcial = _recParciaisMap[d.atleta_id];
              const parcialStr = parcial != null ? ` | Parc: ${parcial.toFixed(1)}` : '';
              return `<div style="background:var(--bg-tertiary);border-radius:8px;padding:6px 10px;font-size:11px;display:flex;align-items:center;gap:6px;cursor:pointer"
                onclick="window.__openPlayerProfile && window.__openPlayerProfile(${d.atleta_id}, '${d.apelido.replace(/'/g, "\\\\'")}')">
                <span class="position-badge ${pos.cls}" style="font-size:9px;padding:1px 4px">${pos.abr}</span>
                <span style="font-weight:600">${d.apelido}</span>
                <span style="color:var(--text-muted)">Média ${d.media_num.toFixed(1)}</span>
                <span style="color:var(--accent-green)">${formatPrice(d.preco_num)}</span>
                ${parcialStr ? `<span style="color:var(--accent-gold);font-weight:600">${parcialStr}</span>` : ''}
              </div>`;
            }).join('')}
          </div>
          ` : '<p style="color:var(--text-muted);font-size:12px">Sem atacantes disponíveis (Provável)</p>'}
        </div>
      `;
    }).join('')}
  `;
}

// ============================
// TAB: 📈 VALORIZAR
// ============================
function renderValorizar(body, data) {
  const { athletes } = data;
  const probable = filterByPos(athletes.filter(a => a.status_id === 7 && a.jogos_num > 0));

  const valorizaveis = probable
    .map(a => {
      const mpv = a.preco_num * 0.25;
      const margem = a.media_num - mpv;
      // Factor in last-round devaluation: recently devalued players are buying opportunities
      const devalBonus = a.variacao_num < -0.5 ? Math.abs(a.variacao_num) * 0.5 : 0;
      // Match context: home players are more likely to score well and valorize
      const ctx = _matchContext[a.clube_id];
      const homeBonus = ctx?.isHome ? 0.5 : 0;
      const adjustedMargem = margem + devalBonus + homeBonus;
      return { ...a, mpv, margem: adjustedMargem, rawMargem: margem, devalBonus };
    })
    .filter(a => a.margem > 0 && a.preco_num <= 15)
    .sort((a, b) => b.margem - a.margem);

  const rising = probable
    .filter(a => a.variacao_num > 0)
    .sort((a, b) => b.variacao_num - a.variacao_num)
    .slice(0, 10);

  body.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🎯 Maior Margem de Valorização</div>
          <div class="card-subtitle">Pontuam muito acima do MPV ${currentPos > 0 ? `· ${getPosLabel()}` : ''}</div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>Jogador</th><th>Pos</th><th>Preço</th><th>Média</th><th>MPV</th><th>Margem</th></tr></thead>
            <tbody>
              ${valorizaveis.slice(0, 15).map(a => `
                <tr>
                  <td>
                    <span style="font-weight:600;cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\'")}')"
                      onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</span>
                    <span style="font-size:10px;color:var(--text-muted);display:block">${a.clubName}</span>
                  </td>
                  <td><span class="position-badge ${a.position.class}">${a.position.abr}</span></td>
                  <td style="font-weight:600">${formatPrice(a.preco_num)}</td>
                  <td style="font-weight:700;color:var(--accent-green)">${a.media_num.toFixed(2)}</td>
                  <td style="color:var(--text-muted)">${a.mpv.toFixed(1)}</td>
                  <td style="font-weight:700;color:var(--accent-gold)">+${a.margem.toFixed(1)}</td>
                </tr>
              `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">Nenhum jogador encontrado</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🚀 Mais Valorizados Recentemente</div>
          <div class="card-subtitle">Jogadores em alta no mercado</div>
        </div>
        ${rising.length > 0 ? rising.map((a, i) => `
          <div class="rec-card">
            <span class="player-list-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
            <div class="player-list-details" style="cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\'")}')">
              <div class="player-name" onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</div>
              <div class="player-full-name">${a.clubName} · ${a.position.abr}</div>
            </div>
            <div class="rec-metrics">
              <div class="rec-metric"><div class="rec-metric-label">Preço</div><div class="rec-metric-value">${formatPrice(a.preco_num)}</div></div>
              <div class="rec-metric"><div class="rec-metric-label">Variação</div><div class="rec-metric-value value-positive">+${a.variacao_num.toFixed(2)}</div></div>
              <div class="rec-metric"><div class="rec-metric-label">Média</div><div class="rec-metric-value">${a.media_num.toFixed(2)}</div></div>
            </div>
          </div>
        `).join('') : '<p style="color:var(--text-muted);text-align:center;padding:20px">Nenhum valorizado nesta posição</p>'}
      </div>
    </div>
  `;
}

// ============================
// TAB: 💰 CUSTO-BENEFÍCIO
// ============================
function renderCustoBeneficio(body, data) {
  const { athletes } = data;
  const active = filterByPos(athletes.filter(a => a.status_id === 7 && a.jogos_num > 0 && a.preco_num > 0));

  const posPlayers = active
    .map(a => ({ ...a, ratio: a.media_num / a.preco_num }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 20);

  body.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">💰 Custo-Benefício ${currentPos > 0 ? `— ${getPosLabel()}` : ''}</div>
        <div class="card-subtitle">Ordenados por Média ÷ Preço (pts/C$)</div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr><th>#</th><th>Jogador</th><th>Pos</th><th>Time</th><th>Preço</th><th>Média</th><th>Pts/C$</th><th>Var.</th><th>Jogos</th></tr>
          </thead>
          <tbody>
            ${posPlayers.map((a, i) => {
              const varClass = a.variacao_num > 0 ? 'value-positive' : a.variacao_num < 0 ? 'value-negative' : 'value-neutral';
              return `
              <tr>
                <td><span class="player-list-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span></td>
                <td>
                  <span style="font-weight:600;cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\'")}')"
                    onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</span>
                </td>
                <td><span class="position-badge ${a.position.class}">${a.position.abr}</span></td>
                <td>
                  <div style="display:flex;align-items:center;gap:6px">
                    <img src="${a.clubBadge}" alt="" class="club-badge" onerror="this.style.display='none'">
                    <span style="font-size:12px">${a.clubName}</span>
                  </div>
                </td>
                <td style="font-weight:600">${formatPrice(a.preco_num)}</td>
                <td style="font-weight:700;color:var(--accent-green)">${a.media_num.toFixed(2)}</td>
                <td style="font-weight:800;color:var(--accent-gold)">${a.ratio.toFixed(2)}</td>
                <td class="${varClass}">${formatVariation(a.variacao_num)}</td>
                <td>${a.jogos_num}</td>
              </tr>
            `}).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:20px">Nenhum jogador encontrado</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ============================
// TAB: 💎 PÉROLAS
// ============================
function renderPerolas(body, data) {
  const { athletes } = data;

  const perolas = filterByPos(athletes)
    .filter(a => a.preco_num <= 8 && a.media_num >= 3 && a.status_id === 7 && a.jogos_num >= 3)
    .sort((a, b) => b.media_num - a.media_num);

  const hiddenGems = filterByPos(athletes)
    .filter(a => a.preco_num <= 5 && a.status_id === 7 && a.jogos_num >= 2 && a.media_num >= 2)
    .sort((a, b) => (b.media_num / Math.max(b.preco_num, 0.5)) - (a.media_num / Math.max(a.preco_num, 0.5)));

  body.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">💎 Pérolas do Cartola</div>
          <div class="card-subtitle">Preço ≤ C$8 · Média ≥ 3 · 3+ jogos ${currentPos > 0 ? `· ${getPosLabel()}` : ''}</div>
        </div>
        ${perolas.length > 0 ? perolas.slice(0, 15).map((a, i) => `
          <div class="rec-card">
            <span class="player-list-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
            <div class="player-list-details" style="cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\'")}')">
              <div class="player-name" onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</div>
              <div class="player-full-name">${a.clubName} · ${a.position.abr}</div>
            </div>
            <div class="rec-metrics">
              <div class="rec-metric"><div class="rec-metric-label">Preço</div><div class="rec-metric-value">${formatPrice(a.preco_num)}</div></div>
              <div class="rec-metric"><div class="rec-metric-label">Média</div><div class="rec-metric-value" style="color:var(--accent-green)">${a.media_num.toFixed(2)}</div></div>
            </div>
          </div>
        `).join('') : '<p style="color:var(--text-muted);text-align:center;padding:20px">Nenhuma pérola encontrada</p>'}
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🔮 Apostas de Valor</div>
          <div class="card-subtitle">Preço ≤ C$5 · 2+ jogos · Média ≥ 2 ${currentPos > 0 ? `· ${getPosLabel()}` : ''}</div>
        </div>
        ${hiddenGems.length > 0 ? hiddenGems.slice(0, 15).map((a, i) => `
          <div class="rec-card">
            <span class="player-list-rank">${i + 1}</span>
            <div class="player-list-details" style="cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\'")}')">
              <div class="player-name" onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</div>
              <div class="player-full-name">${a.clubName} · ${a.position.abr}</div>
            </div>
            <div class="rec-metrics">
              <div class="rec-metric"><div class="rec-metric-label">Preço</div><div class="rec-metric-value" style="color:var(--accent-gold)">${formatPrice(a.preco_num)}</div></div>
              <div class="rec-metric"><div class="rec-metric-label">Média</div><div class="rec-metric-value" style="color:var(--accent-green)">${a.media_num.toFixed(2)}</div></div>
              <div class="rec-metric"><div class="rec-metric-label">Ratio</div><div class="rec-metric-value">${(a.media_num / Math.max(a.preco_num, 0.5)).toFixed(2)}</div></div>
            </div>
          </div>
        `).join('') : '<p style="color:var(--text-muted);text-align:center;padding:20px">Nenhuma aposta encontrada</p>'}
      </div>
    </div>
  `;
}

// ============================
// TAB: 🎯 CONSISTENTES
// ============================
function renderConsistentes(body, data) {
  if (!isHistoryLoaded()) {
    onHistoryLoaded(() => { if (currentTab === 'consistentes') renderTabContent(); });
    return;
  }

  const { athletes } = data;
  const active = filterByPos(athletes.filter(a => a.status_id === 7 && a.jogos_num >= 5));

  const withStats = active.map(a => {
    const stats = calcPlayerStats(a.atleta_id);
    return { ...a, stats };
  }).filter(a => a.stats && a.stats.jogos >= 5);

  const consistent = [...withStats]
    .sort((a, b) => {
      if (b.stats.consistencia !== a.stats.consistencia) return b.stats.consistencia - a.stats.consistencia;
      return a.stats.desvioPadrao - b.stats.desvioPadrao;
    })
    .slice(0, 20);

  const denteSerra = [...withStats]
    .sort((a, b) => b.stats.desvioPadrao - a.stats.desvioPadrao)
    .slice(0, 10);

  body.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🎯 Mais Consistentes ${currentPos > 0 ? `— ${getPosLabel()}` : ''}</div>
          <div class="card-subtitle">Jogadores regulares — sem surpresas</div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>#</th><th>Jogador</th><th>Pos</th><th>Consist.</th><th>σ</th><th>Média</th><th>Mediana</th><th>Preço</th></tr></thead>
            <tbody>
              ${consistent.map((a, i) => `
                <tr>
                  <td class="player-list-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</td>
                  <td>
                    <span style="font-weight:600;cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\'")}')"
                      onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</span>
                    <span style="font-size:10px;color:var(--text-muted);display:block">${a.clubName}</span>
                  </td>
                  <td><span class="position-badge ${a.position.class}">${a.position.abr}</span></td>
                  <td style="font-size:13px">${'★'.repeat(a.stats.consistencia)}${'☆'.repeat(5 - a.stats.consistencia)}</td>
                  <td style="color:var(--accent-green);font-weight:600">${a.stats.desvioPadrao.toFixed(1)}</td>
                  <td style="font-weight:700">${a.stats.media.toFixed(2)}</td>
                  <td>${a.stats.mediana.toFixed(1)}</td>
                  <td>${formatPrice(a.preco_num)}</td>
                </tr>
              `).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px">Nenhum jogador encontrado</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🦷 Dente de Serra ${currentPos > 0 ? `— ${getPosLabel()}` : ''}</div>
          <div class="card-subtitle">Cuidado — oscilam muito</div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>Jogador</th><th>Pos</th><th>σ</th><th>Max</th><th>Min</th><th>Média</th></tr></thead>
            <tbody>
              ${denteSerra.map(a => `
                <tr>
                  <td>
                    <span style="font-weight:600;cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\'")}')"
                      onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</span>
                    <span style="font-size:10px;color:var(--text-muted);display:block">${a.clubName}</span>
                  </td>
                  <td><span class="position-badge ${a.position.class}">${a.position.abr}</span></td>
                  <td style="color:var(--accent-red);font-weight:700">${a.stats.desvioPadrao.toFixed(1)}</td>
                  <td style="color:var(--accent-green)">${a.stats.maxPts.toFixed(1)}</td>
                  <td style="color:var(--accent-red)">${a.stats.minPts.toFixed(1)}</td>
                  <td style="font-weight:600">${a.stats.media.toFixed(2)}</td>
                </tr>
              `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">Nenhum jogador encontrado</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ============================
// TAB: ⛔ EVITAR
// ============================
function renderEvitar(body, data) {
  const { athletes } = data;

  const lesionados = filterByPos(athletes.filter(a => a.status_id === 5)).sort((a, b) => b.media_num - a.media_num).slice(0, 15);
  const suspensos = filterByPos(athletes.filter(a => a.status_id === 3)).sort((a, b) => b.media_num - a.media_num).slice(0, 15);
  const duvida = filterByPos(athletes.filter(a => a.status_id === 2)).sort((a, b) => b.media_num - a.media_num).slice(0, 15);
  const caindo = filterByPos(athletes.filter(a => a.variacao_num < -0.5 && a.jogos_num > 0)).sort((a, b) => a.variacao_num - b.variacao_num).slice(0, 15);

  body.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🤕 Contundidos ${currentPos > 0 ? `— ${getPosLabel()}` : ''}</div>
          <div class="card-subtitle">${lesionados.length} jogadores</div>
        </div>
        ${lesionados.length > 0 ? lesionados.map(a => `
          <div class="rec-card" style="opacity:0.8">
            <span style="font-size:16px">🤕</span>
            <div class="player-list-details">
              <div class="player-name">${a.apelido}</div>
              <div class="player-full-name">${a.clubName} · ${a.position.abr}</div>
            </div>
            <span style="font-size:12px;color:var(--text-muted)">${formatPrice(a.preco_num)}</span>
          </div>
        `).join('') : '<p style="color:var(--text-muted);text-align:center;padding:16px">Nenhum contundido</p>'}
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🟥 Suspensos ${currentPos > 0 ? `— ${getPosLabel()}` : ''}</div>
          <div class="card-subtitle">${suspensos.length} jogadores</div>
        </div>
        ${suspensos.length > 0 ? suspensos.map(a => `
          <div class="rec-card" style="opacity:0.8">
            <span style="font-size:16px">🟥</span>
            <div class="player-list-details">
              <div class="player-name">${a.apelido}</div>
              <div class="player-full-name">${a.clubName} · ${a.position.abr}</div>
            </div>
            <span style="font-size:12px;color:var(--text-muted)">${formatPrice(a.preco_num)}</span>
          </div>
        `).join('') : '<p style="color:var(--text-muted);text-align:center;padding:16px">Nenhum suspenso</p>'}
      </div>
    </div>

    ${duvida.length > 0 ? `
    <div class="card" style="margin-top:20px">
      <div class="card-header">
        <div class="card-title">🤔 Dúvida ${currentPos > 0 ? `— ${getPosLabel()}` : ''}</div>
        <div class="card-subtitle">${duvida.length} jogadores</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${duvida.map(a => `
          <span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--accent-orange-dim);border-radius:20px;font-size:12px;font-weight:500">
            <img src="${a.clubBadge}" alt="" class="club-badge" style="width:16px;height:16px" onerror="this.style.display='none'">
            ${a.apelido}
          </span>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="card" style="margin-top:20px">
      <div class="card-header">
        <div class="card-title">📉 Mais Desvalorizados ${currentPos > 0 ? `— ${getPosLabel()}` : ''}</div>
        <div class="card-subtitle">Jogadores em queda de preço</div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Jogador</th><th>Pos</th><th>Time</th><th>Preço</th><th>Variação</th><th>Média</th></tr></thead>
          <tbody>
            ${caindo.map(a => `
              <tr style="opacity:0.85">
                <td style="font-weight:600">${a.apelido}</td>
                <td><span class="position-badge ${a.position.class}">${a.position.abr}</span></td>
                <td style="font-size:12px">${a.clubName}</td>
                <td>${formatPrice(a.preco_num)}</td>
                <td class="value-negative" style="font-weight:700">${formatVariation(a.variacao_num)}</td>
                <td>${a.media_num.toFixed(2)}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">Nenhum desvalorizado</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSimpleCard(a, i) {
  return `
    <div class="rec-card">
      <span class="player-list-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
      <img src="${a.clubBadge60 || a.clubBadge}" alt="" style="width:32px;height:32px;border-radius:50%;border:2px solid var(--border-color)" onerror="this.style.display='none'">
      <div class="player-list-details" style="cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\'")}')">
        <div class="player-name" onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</div>
        <div class="player-full-name">${a.clubName} · ${a.position.abr}</div>
      </div>
      <div class="rec-metrics">
        <div class="rec-metric"><div class="rec-metric-label">Média</div><div class="rec-metric-value" style="color:var(--accent-green)">${a.media_num.toFixed(2)}</div></div>
        <div class="rec-metric"><div class="rec-metric-label">Preço</div><div class="rec-metric-value">${formatPrice(a.preco_num)}</div></div>
        <div class="rec-metric"><div class="rec-metric-label">Var.</div><div class="rec-metric-value ${a.variacao_num > 0 ? 'value-positive' : a.variacao_num < 0 ? 'value-negative' : ''}">${formatVariation(a.variacao_num)}</div></div>
      </div>
    </div>
  `;
}

export function destroyRecommendations() {
  currentPos = 0;
}
