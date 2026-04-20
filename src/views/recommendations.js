// ===== RECOMMENDATIONS VIEW =====
// Strategy tabs + Position submenu on ALL tabs
import { getData, getClubAthletes, formatPrice, formatVariation } from '../api.js';
import { isHistoryLoaded, onHistoryLoaded } from '../history.js';
import { calcPlayerStats, calcClubStats, analyzeConfronto } from '../stats.js';

let currentTab = 'mitar';
let currentPos = 0; // 0 = todos, 1-6 = posição específica
let currentSort = { key: 'mitarScore', dir: 'desc' }; // sortable columns

const TABS = [
  { id: 'mitar', label: '🔥 Mitar', desc: 'Jogadores com maior chance de pontuar alto na rodada' },
  { id: 'valorizar', label: '📈 Valorizar', desc: 'Jogadores baratos com potencial de valorização' },
  { id: 'custo', label: '💰 Custo-Benefício', desc: 'Melhor rendimento por preço por posição' },
  { id: 'perolas', label: '💎 Pérolas', desc: 'Descobertas baratas com boa média' },
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

  renderTabContent();
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
        ${!isHistoryLoaded() && ['mitar', 'consistentes'].includes(currentTab) ? `
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
    case 'valorizar': renderValorizar(body, data); break;
    case 'custo': renderCustoBeneficio(body, data); break;
    case 'perolas': renderPerolas(body, data); break;
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
// TAB: 🔥 MITAR
// ============================
function renderMitar(body, data) {
  const { athletes } = data;
  const probable = filterByPos(athletes.filter(a => a.status_id === 7 && a.jogos_num > 0));

  if (isHistoryLoaded()) {
    let scored = probable.map(a => {
      const stats = calcPlayerStats(a.atleta_id);
      if (!stats) return { ...a, mitarScore: a.media_num, recentAvg: a.media_num, stats: null };

      const recentAvg = stats.history.slice(-3).reduce((s, h) => s + h.pontuacao, 0) / Math.max(stats.history.slice(-3).length, 1);
      const trendBonus = stats.trend > 0 ? stats.trend * 2 : 0;
      const consistBonus = stats.consistencia >= 4 ? 1 : stats.consistencia >= 3 ? 0.5 : 0;
      const mitarScore = recentAvg * 0.5 + stats.media * 0.3 + trendBonus + consistBonus;
      
      return { ...a, mitarScore, recentAvg, stats };
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
              ${sortHeader('Recente', 'recentAvg')}
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
// TAB: 📈 VALORIZAR
// ============================
function renderValorizar(body, data) {
  const { athletes } = data;
  const probable = filterByPos(athletes.filter(a => a.status_id === 7 && a.jogos_num > 0));

  const valorizaveis = probable
    .map(a => {
      const mpv = a.preco_num * 0.25;
      const margem = a.media_num - mpv;
      return { ...a, mpv, margem };
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
