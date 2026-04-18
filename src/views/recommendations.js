// ===== RECOMMENDATIONS VIEW =====
// Multiple strategy tabs: Mitar, Valorização, Custo-Benefício, Pérolas, Evitar
import { getData, getClubAthletes, formatPrice, formatVariation } from '../api.js';
import { isHistoryLoaded, onHistoryLoaded } from '../history.js';
import { calcPlayerStats, calcClubStats, analyzeConfronto } from '../stats.js';

let currentTab = 'mitar';

const TABS = [
  { id: 'mitar', label: '🔥 Mitar', desc: 'Jogadores com maior chance de pontuar alto na rodada' },
  { id: 'valorizar', label: '📈 Valorizar', desc: 'Jogadores baratos com potencial de valorização' },
  { id: 'custo', label: '💰 Custo-Benefício', desc: 'Melhor rendimento por preço por posição' },
  { id: 'perolas', label: '💎 Pérolas', desc: 'Descobertas baratas com boa média' },
  { id: 'consistentes', label: '🎯 Consistentes', desc: 'Jogadores regulares, sem dente de serra' },
  { id: 'evitar', label: '⛔ Evitar', desc: 'Lesionados, suspensos e em queda' },
];

export function renderRecommendations(container) {
  const data = getData();
  if (!data) return;

  container.innerHTML = `
    <div class="animate-in">
      <!-- Strategy Tabs -->
      <div class="card" style="margin-bottom:20px;padding:16px">
        <div class="rec-tabs" id="rec-tabs">
          ${TABS.map(t => `
            <button class="rec-tab ${t.id === currentTab ? 'active' : ''}" data-tab="${t.id}">
              ${t.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Tab Content -->
      <div id="rec-content"></div>
    </div>
  `;

  // Tab click handlers
  document.querySelectorAll('.rec-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('.rec-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTabContent();
    });
  });

  renderTabContent();
}

function renderTabContent() {
  const content = document.getElementById('rec-content');
  if (!content) return;

  const data = getData();
  if (!data) return;

  const tab = TABS.find(t => t.id === currentTab);

  content.innerHTML = `
    <div class="animate-in">
      <div style="margin-bottom:20px">
        <h3 style="font-size:18px;font-weight:700;margin-bottom:4px">${tab.label}</h3>
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

// ============================
// TAB: 🔥 MITAR
// ============================
function renderMitar(body, data) {
  const { athletes } = data;

  // Best strategy: high average, good recent form, favorable matchup
  const probable = athletes.filter(a => a.status_id === 7 && a.jogos_num > 0);

  // If history is loaded, use advanced metrics
  if (isHistoryLoaded()) {
    const scored = probable.map(a => {
      const stats = calcPlayerStats(a.atleta_id);
      if (!stats) return { ...a, mitarScore: a.media_num };

      // Mitar score: weighted combo of mean, trend, recent form, consistency
      const recentAvg = stats.history.slice(-3).reduce((s, h) => s + h.pontuacao, 0) / Math.max(stats.history.slice(-3).length, 1);
      const trendBonus = stats.trend > 0 ? stats.trend * 2 : 0;
      const consistBonus = stats.consistencia >= 4 ? 1 : stats.consistencia >= 3 ? 0.5 : 0;
      const mitarScore = recentAvg * 0.5 + stats.media * 0.3 + trendBonus + consistBonus;
      
      return { ...a, mitarScore, recentAvg, stats };
    }).sort((a, b) => b.mitarScore - a.mitarScore);

    // Group by position
    const positions = [
      { id: 1, nome: 'Goleiros', icon: '🧤' },
      { id: 2, nome: 'Laterais', icon: '🏃' },
      { id: 3, nome: 'Zagueiros', icon: '🛡️' },
      { id: 4, nome: 'Meias', icon: '🎯' },
      { id: 5, nome: 'Atacantes', icon: '⚽' },
      { id: 6, nome: 'Técnicos', icon: '📋' },
    ];

    body.innerHTML = positions.map(pos => {
      const posPlayers = scored.filter(a => a.posicao_id === pos.id).slice(0, 5);
      if (posPlayers.length === 0) return '';
      return `
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div class="card-title">${pos.icon} ${pos.nome}</div>
          </div>
          ${posPlayers.map((a, i) => renderMitarCard(a, i)).join('')}
        </div>
      `;
    }).join('');
  } else {
    // Simplified without history
    const byMedia = probable.sort((a, b) => b.media_num - a.media_num).slice(0, 15);
    body.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">⭐ Top 15 por Média (Prováveis)</div>
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
        <div class="rec-metric">
          <div class="rec-metric-label">Média</div>
          <div class="rec-metric-value" style="color:var(--accent-green)">${a.media_num.toFixed(2)}</div>
        </div>
        <div class="rec-metric">
          <div class="rec-metric-label">Recente</div>
          <div class="rec-metric-value" style="color:var(--accent-gold)">${a.recentAvg?.toFixed(1) || '-'}</div>
        </div>
        <div class="rec-metric">
          <div class="rec-metric-label">Preço</div>
          <div class="rec-metric-value">${formatPrice(a.preco_num)}</div>
        </div>
        <div class="rec-metric">
          <div class="rec-metric-label">Trend</div>
          <div class="rec-metric-value">${trend}</div>
        </div>
        <div class="rec-metric">
          <div class="rec-metric-label">Consist.</div>
          <div class="rec-metric-value" style="font-size:12px">${stars}</div>
        </div>
      </div>
    </div>
  `;
}

// ============================
// TAB: 📈 VALORIZAR
// ============================
function renderValorizar(body, data) {
  const { athletes } = data;

  // Valorization strategy: cheap players who can score above MPV
  const probable = athletes.filter(a => a.status_id === 7 && a.jogos_num > 0);
  
  const valorizaveis = probable
    .map(a => {
      const mpv = a.preco_num * 0.25;
      const margem = a.media_num - mpv; // How much above MPV on average
      const potValor = margem > 0 ? margem : 0;
      return { ...a, mpv, margem, potValor };
    })
    .filter(a => a.margem > 0 && a.preco_num <= 15) // Only players likely to valorize AND cheap enough
    .sort((a, b) => b.margem - a.margem);

  // Also find recently rising stars (positive variation)
  const rising = probable
    .filter(a => a.variacao_num > 0)
    .sort((a, b) => b.variacao_num - a.variacao_num)
    .slice(0, 10);

  body.innerHTML = `
    <div class="grid-2">
      <!-- Best Valorization Margin -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🎯 Maior Margem de Valorização</div>
          <div class="card-subtitle">Jogadores que pontuam muito acima do MPV</div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Pos</th>
                <th>Preço</th>
                <th>Média</th>
                <th>MPV</th>
                <th>Margem</th>
              </tr>
            </thead>
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
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Rising Stars -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🚀 Mais Valorizados Recentemente</div>
          <div class="card-subtitle">Jogadores em alta no mercado</div>
        </div>
        ${rising.map((a, i) => `
          <div class="rec-card">
            <span class="player-list-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
            <div class="player-list-details" style="cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\'")}')">
              <div class="player-name" onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</div>
              <div class="player-full-name">${a.clubName} · ${a.position.abr}</div>
            </div>
            <div class="rec-metrics">
              <div class="rec-metric">
                <div class="rec-metric-label">Preço</div>
                <div class="rec-metric-value">${formatPrice(a.preco_num)}</div>
              </div>
              <div class="rec-metric">
                <div class="rec-metric-label">Variação</div>
                <div class="rec-metric-value value-positive">+${a.variacao_num.toFixed(2)}</div>
              </div>
              <div class="rec-metric">
                <div class="rec-metric-label">Média</div>
                <div class="rec-metric-value">${a.media_num.toFixed(2)}</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Tio Patinhas: Best cheap team -->
    <div class="card" style="margin-top:20px">
      <div class="card-header">
        <div class="card-title">🦆 Tio Patinhas - Time Barato que Valoriza</div>
        <div class="card-subtitle">Formação 4-3-3 com jogadores baratos e média acima do MPV</div>
      </div>
      ${renderCheapTeam(valorizaveis)}
    </div>
  `;
}

function renderCheapTeam(players) {
  // Build a 4-3-3 lineup from cheap valorizers
  const lineup = {
    1: players.filter(a => a.posicao_id === 1).slice(0, 1),  // 1 GK
    3: players.filter(a => a.posicao_id === 3).slice(0, 2),  // 2 CB
    2: players.filter(a => a.posicao_id === 2).slice(0, 2),  // 2 LB
    4: players.filter(a => a.posicao_id === 4).slice(0, 3),  // 3 MF
    5: players.filter(a => a.posicao_id === 5).slice(0, 3),  // 3 FW
    6: players.filter(a => a.posicao_id === 6).slice(0, 1),  // 1 Coach
  };

  const allPicked = [...lineup[1], ...lineup[2], ...lineup[3], ...lineup[4], ...lineup[5], ...lineup[6]];
  const totalCost = allPicked.reduce((s, a) => s + a.preco_num, 0);
  const avgMargin = allPicked.length > 0 ? allPicked.reduce((s, a) => s + a.margem, 0) / allPicked.length : 0;

  const posNames = { 1: '🧤 GOL', 2: '🏃 LAT', 3: '🛡️ ZAG', 4: '🎯 MEI', 5: '⚽ ATA', 6: '📋 TEC' };

  return `
    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <span style="background:var(--accent-green-dim);color:var(--accent-green);padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600">
        Custo Total: ${formatPrice(totalCost)}
      </span>
      <span style="background:var(--accent-gold-dim);color:var(--accent-gold);padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600">
        Margem Média: +${avgMargin.toFixed(1)}
      </span>
    </div>
    ${[1, 3, 2, 4, 5, 6].map(pos => {
      const posPlayers = lineup[pos];
      if (posPlayers.length === 0) return '';
      return `
        <div style="margin-bottom:8px">
          <span style="font-size:11px;color:var(--text-muted);font-weight:600">${posNames[pos]}</span>
          ${posPlayers.map(a => `
            <div class="rec-card" style="margin-top:4px">
              <div class="player-list-details">
                <div class="player-name">${a.apelido}</div>
                <div class="player-full-name">${a.clubName}</div>
              </div>
              <span style="font-size:12px;font-weight:600">${formatPrice(a.preco_num)}</span>
              <span style="font-size:12px;font-weight:700;color:var(--accent-green)">Média: ${a.media_num.toFixed(2)}</span>
              <span style="font-size:12px;color:var(--accent-gold)">+${a.margem.toFixed(1)}</span>
            </div>
          `).join('')}
        </div>
      `;
    }).join('')}
  `;
}

// ============================
// TAB: 💰 CUSTO-BENEFÍCIO
// ============================
function renderCustoBeneficio(body, data) {
  const { athletes } = data;
  const active = athletes.filter(a => a.status_id === 7 && a.jogos_num > 0 && a.preco_num > 0);

  const positions = [
    { id: 1, nome: 'Goleiros', icon: '🧤' },
    { id: 2, nome: 'Laterais', icon: '🏃' },
    { id: 3, nome: 'Zagueiros', icon: '🛡️' },
    { id: 4, nome: 'Meias', icon: '🎯' },
    { id: 5, nome: 'Atacantes', icon: '⚽' },
    { id: 6, nome: 'Técnicos', icon: '📋' },
  ];

  // Position tabs
  body.innerHTML = `
    <div class="card" style="margin-bottom:16px;padding:12px">
      <div class="rec-tabs" id="pos-tabs">
        ${positions.map(p => `
          <button class="rec-tab ${p.id === 1 ? 'active' : ''}" data-pos="${p.id}">${p.icon} ${p.nome}</button>
        `).join('')}
      </div>
    </div>
    <div id="custo-content"></div>
  `;

  const renderPosContent = (posId) => {
    const pos = positions.find(p => p.id === posId);
    const posPlayers = active
      .filter(a => a.posicao_id === posId)
      .map(a => ({ ...a, ratio: a.media_num / a.preco_num }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 15);

    const custoContent = document.getElementById('custo-content');
    custoContent.innerHTML = `
      <div class="card animate-in">
        <div class="card-header">
          <div class="card-title">${pos.icon} ${pos.nome} - Custo-Benefício</div>
          <div class="card-subtitle">Ordenados por Média ÷ Preço (pts/C$)</div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Jogador</th>
                <th>Time</th>
                <th>Preço</th>
                <th>Média</th>
                <th>Pts/C$</th>
                <th>Var.</th>
                <th>Jogos</th>
              </tr>
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
              `}).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  // Bind position tabs
  document.querySelectorAll('#pos-tabs .rec-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#pos-tabs .rec-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPosContent(parseInt(btn.dataset.pos));
    });
  });

  renderPosContent(1);
}

// ============================
// TAB: 💎 PÉROLAS
// ============================
function renderPerolas(body, data) {
  const { athletes } = data;

  // Pérolas: cheap (≤ C$8), good average (≥ 3), probable
  const perolas = athletes
    .filter(a => a.preco_num <= 8 && a.media_num >= 3 && a.status_id === 7 && a.jogos_num >= 3)
    .sort((a, b) => b.media_num - a.media_num);

  // Hidden gems: extremely cheap but with notable scout numbers
  const hiddenGems = athletes
    .filter(a => a.preco_num <= 5 && a.status_id === 7 && a.jogos_num >= 2 && a.media_num >= 2)
    .sort((a, b) => (b.media_num / Math.max(b.preco_num, 0.5)) - (a.media_num / Math.max(a.preco_num, 0.5)));

  body.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">💎 Pérolas do Cartola</div>
          <div class="card-subtitle">Preço ≤ C$8.00 · Média ≥ 3.00 · 3+ jogos</div>
        </div>
        ${perolas.length > 0 ? perolas.slice(0, 15).map((a, i) => `
          <div class="rec-card">
            <span class="player-list-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
            <div class="player-list-details" style="cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\'")}')">
              <div class="player-name" onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</div>
              <div class="player-full-name">${a.clubName} · ${a.position.abr}</div>
            </div>
            <div class="rec-metrics">
              <div class="rec-metric">
                <div class="rec-metric-label">Preço</div>
                <div class="rec-metric-value">${formatPrice(a.preco_num)}</div>
              </div>
              <div class="rec-metric">
                <div class="rec-metric-label">Média</div>
                <div class="rec-metric-value" style="color:var(--accent-green)">${a.media_num.toFixed(2)}</div>
              </div>
            </div>
          </div>
        `).join('') : '<p style="color:var(--text-muted);text-align:center;padding:20px">Nenhuma pérola encontrada com os critérios atuais</p>'}
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🔮 Apostas de Valor</div>
          <div class="card-subtitle">Preço ≤ C$5.00 · 2+ jogos · Média ≥ 2.00</div>
        </div>
        ${hiddenGems.length > 0 ? hiddenGems.slice(0, 15).map((a, i) => `
          <div class="rec-card">
            <span class="player-list-rank">${i + 1}</span>
            <div class="player-list-details" style="cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\'")}')">
              <div class="player-name" onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</div>
              <div class="player-full-name">${a.clubName} · ${a.position.abr}</div>
            </div>
            <div class="rec-metrics">
              <div class="rec-metric">
                <div class="rec-metric-label">Preço</div>
                <div class="rec-metric-value" style="color:var(--accent-gold)">${formatPrice(a.preco_num)}</div>
              </div>
              <div class="rec-metric">
                <div class="rec-metric-label">Média</div>
                <div class="rec-metric-value" style="color:var(--accent-green)">${a.media_num.toFixed(2)}</div>
              </div>
              <div class="rec-metric">
                <div class="rec-metric-label">Ratio</div>
                <div class="rec-metric-value">${(a.media_num / Math.max(a.preco_num, 0.5)).toFixed(2)}</div>
              </div>
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
  const active = athletes.filter(a => a.status_id === 7 && a.jogos_num >= 5);

  const withStats = active.map(a => {
    const stats = calcPlayerStats(a.atleta_id);
    return { ...a, stats };
  }).filter(a => a.stats && a.stats.jogos >= 5);

  // Most consistent (lowest std dev, highest consistency rating)
  const consistent = [...withStats]
    .sort((a, b) => {
      if (b.stats.consistencia !== a.stats.consistencia) return b.stats.consistencia - a.stats.consistencia;
      return a.stats.desvioPadrao - b.stats.desvioPadrao;
    })
    .slice(0, 20);

  // "Dente de Serra" - most inconsistent  
  const denteSerra = [...withStats]
    .sort((a, b) => b.stats.desvioPadrao - a.stats.desvioPadrao)
    .slice(0, 10);

  body.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🎯 Mais Consistentes</div>
          <div class="card-subtitle">Jogadores regulares — sem surpresas</div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Jogador</th>
                <th>Pos</th>
                <th>Consist.</th>
                <th>σ</th>
                <th>Média</th>
                <th>Mediana</th>
                <th>Preço</th>
              </tr>
            </thead>
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
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🦷 Dente de Serra</div>
          <div class="card-subtitle">Cuidado com estes — oscilam muito</div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Pos</th>
                <th>σ</th>
                <th>Max</th>
                <th>Min</th>
                <th>Média</th>
              </tr>
            </thead>
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
              `).join('')}
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

  // Injured / suspended
  const lesionados = athletes.filter(a => a.status_id === 5).sort((a, b) => b.media_num - a.media_num).slice(0, 10);
  const suspensos = athletes.filter(a => a.status_id === 3).sort((a, b) => b.media_num - a.media_num).slice(0, 10);
  const duvida = athletes.filter(a => a.status_id === 2).sort((a, b) => b.media_num - a.media_num).slice(0, 10);

  // Desvalorizando heavily
  const caindo = athletes
    .filter(a => a.variacao_num < -0.5 && a.jogos_num > 0)
    .sort((a, b) => a.variacao_num - b.variacao_num)
    .slice(0, 15);

  body.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🤕 Contundidos</div>
          <div class="card-subtitle">${lesionados.length} jogadores</div>
        </div>
        ${lesionados.map(a => `
          <div class="rec-card" style="opacity:0.8">
            <span class="status-badge contundido" style="font-size:16px">🤕</span>
            <div class="player-list-details">
              <div class="player-name">${a.apelido}</div>
              <div class="player-full-name">${a.clubName} · ${a.position.abr}</div>
            </div>
            <span style="font-size:12px;color:var(--text-muted)">${formatPrice(a.preco_num)}</span>
          </div>
        `).join('') || '<p style="color:var(--text-muted);text-align:center;padding:16px">Nenhum contundido</p>'}
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🟥 Suspensos</div>
          <div class="card-subtitle">${suspensos.length} jogadores</div>
        </div>
        ${suspensos.map(a => `
          <div class="rec-card" style="opacity:0.8">
            <span style="font-size:16px">🟥</span>
            <div class="player-list-details">
              <div class="player-name">${a.apelido}</div>
              <div class="player-full-name">${a.clubName} · ${a.position.abr}</div>
            </div>
            <span style="font-size:12px;color:var(--text-muted)">${formatPrice(a.preco_num)}</span>
          </div>
        `).join('') || '<p style="color:var(--text-muted);text-align:center;padding:16px">Nenhum suspenso</p>'}
      </div>
    </div>

    ${duvida.length > 0 ? `
    <div class="card" style="margin-top:20px">
      <div class="card-header">
        <div class="card-title">🤔 Dúvida</div>
        <div class="card-subtitle">${duvida.length} jogadores com status duvidoso</div>
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
        <div class="card-title">📉 Mais Desvalorizados</div>
        <div class="card-subtitle">Jogadores em queda de preço</div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Jogador</th>
              <th>Pos</th>
              <th>Time</th>
              <th>Preço</th>
              <th>Variação</th>
              <th>Média</th>
            </tr>
          </thead>
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
            `).join('')}
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
        <div class="rec-metric">
          <div class="rec-metric-label">Média</div>
          <div class="rec-metric-value" style="color:var(--accent-green)">${a.media_num.toFixed(2)}</div>
        </div>
        <div class="rec-metric">
          <div class="rec-metric-label">Preço</div>
          <div class="rec-metric-value">${formatPrice(a.preco_num)}</div>
        </div>
        <div class="rec-metric">
          <div class="rec-metric-label">Var.</div>
          <div class="rec-metric-value ${a.variacao_num > 0 ? 'value-positive' : a.variacao_num < 0 ? 'value-negative' : ''}">${formatVariation(a.variacao_num)}</div>
        </div>
      </div>
    </div>
  `;
}

export function destroyRecommendations() {
  // nothing to clean up
}
