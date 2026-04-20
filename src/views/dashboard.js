// ===== DASHBOARD VIEW =====
import { getData, getTopByMedia, getMostAppreciated, getMostDepreciated, formatPrice, formatVariation, fetchMatchesByRound, fetchScoredByRound } from '../api.js';
import { isHistoryLoaded, getRoundScored } from '../history.js';

let countdownInterval = null;

export function renderDashboard(container) {
  const data = getData();
  if (!data) return;

  const { market, athletes, clubs } = data;
  const activeAthletes = athletes.filter(a => a.jogos_num > 0);
  const probableAthletes = athletes.filter(a => a.status_id === 7);
  const clubCount = Object.keys(clubs).length;
  const currentRound = market.rodada_atual;
  
  // Previous round number for pontuação/variação context
  const prevRound = currentRound - 1;

  // Top Média: only players with ≥40% of rounds played
  const minGames = Math.max(1, Math.ceil(currentRound * 0.4));
  const topMedia = activeAthletes
    .filter(a => a.jogos_num >= minGames)
    .sort((a, b) => b.media_num - a.media_num)
    .slice(0, 5);

  const mostAppreciated = getMostAppreciated(5);
  const mostDepreciated = getMostDepreciated(5);

  container.innerHTML = `
    <!-- Stats Grid -->
    <div class="stats-grid animate-in">
      <div class="stat-card">
        <div class="stat-card-icon green">⚽</div>
        <div class="stat-card-info">
          <h3>Rodada Atual</h3>
          <div class="stat-value">${currentRound}</div>
          <div class="stat-detail">${market.nome_rodada || `Rodada ${currentRound}`}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon gold">👥</div>
        <div class="stat-card-info">
          <h3>Jogadores Ativos</h3>
          <div class="stat-value">${activeAthletes.length}</div>
          <div class="stat-detail">${probableAthletes.length} prováveis</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon blue">🏟️</div>
        <div class="stat-card-info">
          <h3>Times</h3>
          <div class="stat-value">${clubCount}</div>
          <div class="stat-detail">Brasileirão Série A</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon purple">📊</div>
        <div class="stat-card-info">
          <h3>Times Escalados</h3>
          <div class="stat-value">${(market.times_escalados || 0).toLocaleString('pt-BR')}</div>
          <div class="stat-detail">na última rodada</div>
        </div>
      </div>
    </div>

    <!-- Market Status -->
    <div class="card animate-in animate-in-delay-1" style="margin-bottom:24px">
      <div id="market-status-content">
        <div style="text-align:center;padding:16px">
          <div class="loading-spinner" style="margin:0 auto 8px;width:20px;height:20px"></div>
          <span style="color:var(--text-muted);font-size:12px">Carregando status do mercado...</span>
        </div>
      </div>
    </div>

    <!-- Top Players Grid -->
    <div class="grid-2" style="margin-bottom:24px">
      <div class="card animate-in animate-in-delay-2">
        <div class="card-header"><div>
          <div class="card-title">🔥 Top Pontuação</div>
          <div class="card-subtitle">Última Rodada — R.${prevRound}</div>
        </div></div>
        <div id="top-points-list">
          <div style="text-align:center;padding:16px">
            <div class="loading-spinner" style="margin:0 auto 8px;width:18px;height:18px"></div>
            <span style="color:var(--text-muted);font-size:11px">Carregando pontuações...</span>
          </div>
        </div>
      </div>
      <div class="card animate-in animate-in-delay-2">
        <div class="card-header"><div>
          <div class="card-title">⭐ Top Média</div>
          <div class="card-subtitle">Na temporada · Mín. ${minGames} jogos (40%)</div>
        </div></div>
        ${topMedia.map((p, i) => renderPlayerListItem(p, i, 'media_num')).join('')}
      </div>
    </div>

    <div class="grid-2">
      <div class="card animate-in animate-in-delay-3">
        <div class="card-header"><div>
          <div class="card-title">📈 Mais Valorizados</div>
          <div class="card-subtitle">Última variação — R.${prevRound}</div>
        </div></div>
        ${mostAppreciated.map((p, i) => renderPlayerListItem(p, i, 'variacao_num')).join('')}
      </div>
      <div class="card animate-in animate-in-delay-4">
        <div class="card-header"><div>
          <div class="card-title">📉 Mais Desvalorizados</div>
          <div class="card-subtitle">Última variação — R.${prevRound}</div>
        </div></div>
        ${mostDepreciated.map((p, i) => renderPlayerListItem(p, i, 'variacao_num')).join('')}
      </div>
    </div>
  `;

  // Load market timer
  initMarketTimer(market);
  // Load top points from previous round
  loadTopPoints(prevRound);
}

async function loadTopPoints(round) {
  const container = document.getElementById('top-points-list');
  if (!container) return;

  try {
    // Try historical data first, then API
    let athletes = {};
    if (isHistoryLoaded()) {
      athletes = getRoundScored(round);
    }
    if (!athletes || Object.keys(athletes).length === 0) {
      const scored = await fetchScoredByRound(round);
      athletes = scored?.atletas || {};
    }

    const data = getData();
    const sorted = Object.entries(athletes)
      .map(([id, a]) => {
        const full = data?.athletes?.find(x => x.atleta_id === parseInt(id));
        return {
          apelido: a.apelido || full?.apelido || `#${id}`,
          pontuacao: a.pontuacao || 0,
          clubBadge: full?.clubBadge || '',
          clubName: full?.clubName || '',
          position: full?.position || { abr: '???', class: '' },
        };
      })
      .filter(a => a.pontuacao !== 0)
      .sort((a, b) => b.pontuacao - a.pontuacao)
      .slice(0, 5);

    container.innerHTML = sorted.map((p, i) => {
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      const valueClass = p.pontuacao > 0 ? 'value-positive' : p.pontuacao < 0 ? 'value-negative' : 'value-neutral';
      return `
        <div class="player-list-item">
          <span class="player-list-rank ${rankClass}">${i + 1}</span>
          <img src="${p.clubBadge}" alt="${p.clubName}" class="club-badge" onerror="this.style.display='none'">
          <div class="player-list-details">
            <div class="player-name">${p.apelido}</div>
            <div class="player-full-name">${p.clubName} · ${p.position.abr}</div>
          </div>
          <span class="position-badge ${p.position.class}">${p.position.abr}</span>
          <span class="player-list-value ${valueClass}">${p.pontuacao.toFixed(1)}</span>
        </div>
      `;
    }).join('') || '<p style="color:var(--text-muted);text-align:center;padding:16px">Nenhuma pontuação disponível</p>';
  } catch (e) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:16px">Erro ao carregar pontuações</p>';
  }
}

async function initMarketTimer(market) {
  const isOpen = market.status_mercado === 1;
  const closingTs = market.fechamento?.timestamp;

  if (isOpen && closingTs) {
    startTimer(closingTs, 'open');
  } else {
    try {
      const matchData = await fetchMatchesByRound(market.rodada_atual);
      const matches = matchData.partidas || [];
      if (matches.length > 0) {
        const lastMatchTs = Math.max(...matches.map(m => m.timestamp || 0));
        // Estimate: last match + ~2h for processing
        const reopenTs = lastMatchTs + 7200;
        const now = Math.floor(Date.now() / 1000);
        if (now < reopenTs) {
          startTimer(reopenTs, 'closed-countdown');
        } else {
          startTimer(null, 'closed-waiting');
        }
      } else {
        startTimer(null, 'closed-waiting');
      }
    } catch {
      startTimer(null, 'closed-waiting');
    }
  }
}

function startTimer(targetTs, mode) {
  if (countdownInterval) clearInterval(countdownInterval);

  function update() {
    const el = document.getElementById('market-status-content');
    if (!el) { clearInterval(countdownInterval); return; }
    const now = Math.floor(Date.now() / 1000);

    if (mode === 'open' && targetTs) {
      let diff = targetTs - now;
      if (diff <= 0) { mode = 'closed-waiting'; update(); return; }
      const d = Math.floor(diff / 86400); diff %= 86400;
      const h = Math.floor(diff / 3600); diff %= 3600;
      const m = Math.floor(diff / 60); const s = diff % 60;
      const dateStr = new Date(targetTs * 1000).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      el.innerHTML = `
        <div class="card-header">
          <div class="card-title"><span class="market-pulse open"></span> ⏱️ Fechamento do Mercado</div>
          <div style="font-size:13px;color:var(--text-secondary)">${dateStr}</div>
        </div>
        <div class="countdown">${renderBlocks(d, h, m, s, '')}</div>
      `;
    } else if (mode === 'closed-countdown' && targetTs) {
      let diff = targetTs - now;
      if (diff <= 0) { mode = 'closed-waiting'; update(); return; }
      const h = Math.floor(diff / 3600); diff %= 3600;
      const m = Math.floor(diff / 60); const s = diff % 60;
      el.innerHTML = `
        <div style="text-align:center;padding:8px 0">
          <div class="market-closed-badge"><span class="market-pulse closed"></span> 🔒 MERCADO FECHADO!</div>
          <div style="margin-top:16px">
            <p style="color:var(--text-secondary);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">⏳ Estimativa para reabertura</p>
            <div class="countdown">${renderBlocks(0, h, m, s, 'closed')}</div>
          </div>
          <p style="color:var(--text-muted);font-size:11px;margin-top:12px">Baseado no último jogo da rodada + 2h</p>
        </div>
      `;
    } else {
      el.innerHTML = `
        <div style="text-align:center;padding:16px 0">
          <div class="market-closed-badge"><span class="market-pulse closed"></span> 🔒 MERCADO FECHADO!</div>
          <p style="color:var(--text-secondary);font-size:13px;margin-top:12px">⏳ Aguardando reabertura do mercado...</p>
          <p style="color:var(--text-muted);font-size:11px;margin-top:4px">O mercado reabre após a apuração dos resultados da rodada</p>
        </div>
      `;
    }
  }
  update();
  countdownInterval = setInterval(update, 1000);
}

function renderBlocks(d, h, m, s, v) {
  const bc = v === 'closed' ? 'countdown-block closed-block' : 'countdown-block';
  const vc = v === 'closed' ? 'countdown-value closed-value' : 'countdown-value';
  let html = '';
  if (d > 0) html += `<div class="${bc}"><span class="${vc}">${String(d).padStart(2,'0')}</span><span class="countdown-label">Dias</span></div><span class="countdown-sep">:</span>`;
  html += `<div class="${bc}"><span class="${vc}">${String(h).padStart(2,'0')}</span><span class="countdown-label">Horas</span></div><span class="countdown-sep">:</span>`;
  html += `<div class="${bc}"><span class="${vc}">${String(m).padStart(2,'0')}</span><span class="countdown-label">Min</span></div><span class="countdown-sep">:</span>`;
  html += `<div class="${bc}"><span class="${vc}">${String(s).padStart(2,'0')}</span><span class="countdown-label">Seg</span></div>`;
  return html;
}

function renderPlayerListItem(player, index, valueKey) {
  const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
  let value = player[valueKey];
  let displayValue = '', valueClass = '';
  if (valueKey === 'pontos_num' || valueKey === 'media_num') {
    displayValue = value.toFixed(1);
    valueClass = value > 0 ? 'value-positive' : value < 0 ? 'value-negative' : 'value-neutral';
  } else if (valueKey === 'variacao_num') {
    displayValue = formatVariation(value);
    valueClass = value > 0 ? 'value-positive' : value < 0 ? 'value-negative' : 'value-neutral';
  }
  return `
    <div class="player-list-item">
      <span class="player-list-rank ${rankClass}">${index + 1}</span>
      <img src="${player.clubBadge}" alt="${player.clubName}" class="club-badge" onerror="this.style.display='none'">
      <div class="player-list-details">
        <div class="player-name">${player.apelido}</div>
        <div class="player-full-name">${player.clubName} · ${player.position.abr}</div>
      </div>
      <span class="position-badge ${player.position.class}">${player.position.abr}</span>
      <span class="player-list-value ${valueClass}">${displayValue}</span>
    </div>
  `;
}

export function destroyDashboard() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
}
