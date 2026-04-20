// ===== DASHBOARD VIEW =====
import { getData, getTopByPoints, getTopByMedia, getMostAppreciated, getMostDepreciated, formatPrice, formatVariation, fetchMatchesByRound } from '../api.js';

let countdownInterval = null;
let reopenTimestamp = null;

export function renderDashboard(container) {
  const data = getData();
  if (!data) return;

  const { market, athletes, clubs } = data;
  const activeAthletes = athletes.filter(a => a.jogos_num > 0);
  const probableAthletes = athletes.filter(a => a.status_id === 7);
  const topPoints = getTopByPoints(5);
  const topMedia = getTopByMedia(5);
  const mostAppreciated = getMostAppreciated(5);
  const mostDepreciated = getMostDepreciated(5);
  const clubCount = Object.keys(clubs).length;
  
  container.innerHTML = `
    <!-- Stats Grid -->
    <div class="stats-grid animate-in">
      <div class="stat-card">
        <div class="stat-card-icon green">⚽</div>
        <div class="stat-card-info">
          <h3>Rodada Atual</h3>
          <div class="stat-value">${market.rodada_atual}</div>
          <div class="stat-detail">${market.nome_rodada || `Rodada ${market.rodada_atual}`}</div>
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
        <div class="card-header"><div><div class="card-title">🔥 Top Pontuação</div><div class="card-subtitle">Última rodada</div></div></div>
        ${topPoints.map((p, i) => renderPlayerListItem(p, i, 'pontos_num')).join('')}
      </div>
      <div class="card animate-in animate-in-delay-2">
        <div class="card-header"><div><div class="card-title">⭐ Top Média</div><div class="card-subtitle">Na temporada</div></div></div>
        ${topMedia.map((p, i) => renderPlayerListItem(p, i, 'media_num')).join('')}
      </div>
    </div>

    <div class="grid-2">
      <div class="card animate-in animate-in-delay-3">
        <div class="card-header"><div><div class="card-title">📈 Mais Valorizados</div><div class="card-subtitle">Última variação</div></div></div>
        ${mostAppreciated.map((p, i) => renderPlayerListItem(p, i, 'variacao_num')).join('')}
      </div>
      <div class="card animate-in animate-in-delay-4">
        <div class="card-header"><div><div class="card-title">📉 Mais Desvalorizados</div><div class="card-subtitle">Última variação</div></div></div>
        ${mostDepreciated.map((p, i) => renderPlayerListItem(p, i, 'variacao_num')).join('')}
      </div>
    </div>
  `;

  // Load market status and start timer
  initMarketTimer(market);
}

async function initMarketTimer(market) {
  const isOpen = market.status_mercado === 1;
  const closingTs = market.fechamento?.timestamp;

  if (isOpen && closingTs) {
    // Market OPEN — countdown to closing
    startTimer(closingTs, 'open');
  } else {
    // Market CLOSED — figure out when it reopens by looking at match schedule
    try {
      const matchData = await fetchMatchesByRound(market.rodada_atual);
      const matches = matchData.partidas || [];
      
      if (matches.length > 0) {
        // Find last match timestamp
        const lastMatchTs = Math.max(...matches.map(m => m.timestamp || 0));
        // Estimate reopening: last match + ~2 hours (7200s)
        reopenTimestamp = lastMatchTs + 7200;
        
        const now = Math.floor(Date.now() / 1000);
        if (now < reopenTimestamp) {
          // Still before estimated reopening
          startTimer(reopenTimestamp, 'closed-countdown');
        } else {
          // Past estimated reopening — show "aguardando reabertura"
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

function startTimer(targetTimestamp, mode) {
  if (countdownInterval) clearInterval(countdownInterval);

  function update() {
    const container = document.getElementById('market-status-content');
    if (!container) { clearInterval(countdownInterval); return; }

    const now = Math.floor(Date.now() / 1000);

    if (mode === 'open' && targetTimestamp) {
      // Countdown to market closing
      let diff = targetTimestamp - now;
      if (diff <= 0) {
        mode = 'closed-waiting'; // Market just closed
        update();
        return;
      }
      const days = Math.floor(diff / 86400); diff %= 86400;
      const hours = Math.floor(diff / 3600); diff %= 3600;
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      
      const closingDate = new Date(targetTimestamp * 1000);
      const dateStr = closingDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

      container.innerHTML = `
        <div class="card-header">
          <div class="card-title"><span class="market-pulse open"></span> ⏱️ Fechamento do Mercado</div>
          <div style="font-size:13px;color:var(--text-secondary)">${dateStr}</div>
        </div>
        <div class="countdown">
          ${renderCountdownBlocks(days, hours, minutes, seconds, '')}
        </div>
      `;

    } else if (mode === 'closed-countdown' && targetTimestamp) {
      // Market closed — countdown to estimated reopening
      let diff = targetTimestamp - now;
      if (diff <= 0) {
        mode = 'closed-waiting';
        update();
        return;
      }
      const hours = Math.floor(diff / 3600); diff %= 3600;
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;

      container.innerHTML = `
        <div style="text-align:center;padding:8px 0">
          <div class="market-closed-badge">
            <span class="market-pulse closed"></span>
            🔒 MERCADO FECHADO!
          </div>
          <div style="margin-top:16px">
            <p style="color:var(--text-secondary);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">
              ⏳ Estimativa para reabertura
            </p>
            <div class="countdown">
              ${renderCountdownBlocks(0, hours, minutes, seconds, 'closed')}
            </div>
          </div>
          <p style="color:var(--text-muted);font-size:11px;margin-top:12px">
            Baseado no horário do último jogo da rodada + 2h
          </p>
        </div>
      `;

    } else {
      // Market closed, no countdown available
      container.innerHTML = `
        <div style="text-align:center;padding:16px 0">
          <div class="market-closed-badge">
            <span class="market-pulse closed"></span>
            🔒 MERCADO FECHADO!
          </div>
          <p style="color:var(--text-secondary);font-size:13px;margin-top:12px">
            ⏳ Aguardando reabertura do mercado...
          </p>
          <p style="color:var(--text-muted);font-size:11px;margin-top:4px">
            O mercado reabre após a apuração dos resultados da rodada
          </p>
        </div>
      `;
    }
  }

  update();
  countdownInterval = setInterval(update, 1000);
}

function renderCountdownBlocks(days, hours, minutes, seconds, variant) {
  const blockClass = variant === 'closed' ? 'countdown-block closed-block' : 'countdown-block';
  const valueClass = variant === 'closed' ? 'countdown-value closed-value' : 'countdown-value';

  let html = '';
  if (days > 0) {
    html += `<div class="${blockClass}"><span class="${valueClass}">${String(days).padStart(2, '0')}</span><span class="countdown-label">Dias</span></div><span class="countdown-sep">:</span>`;
  }
  html += `
    <div class="${blockClass}"><span class="${valueClass}">${String(hours).padStart(2, '0')}</span><span class="countdown-label">Horas</span></div>
    <span class="countdown-sep">:</span>
    <div class="${blockClass}"><span class="${valueClass}">${String(minutes).padStart(2, '0')}</span><span class="countdown-label">Min</span></div>
    <span class="countdown-sep">:</span>
    <div class="${blockClass}"><span class="${valueClass}">${String(seconds).padStart(2, '0')}</span><span class="countdown-label">Seg</span></div>
  `;
  return html;
}

function renderPlayerListItem(player, index, valueKey) {
  const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
  let value = player[valueKey];
  let displayValue = '';
  let valueClass = '';
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
