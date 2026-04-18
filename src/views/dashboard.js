// ===== DASHBOARD VIEW =====
import { getData, getTopByPoints, getTopByMedia, getMostAppreciated, getMostDepreciated, formatPrice, formatVariation } from '../api.js';

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

  // Position distribution
  const positionCounts = {};
  activeAthletes.forEach(a => {
    const pos = a.position.abr;
    positionCounts[pos] = (positionCounts[pos] || 0) + 1;
  });

  // Average price by position
  const avgPrices = {};
  [1,2,3,4,5,6].forEach(pos => {
    const posAthletes = activeAthletes.filter(a => a.posicao_id === pos && a.preco_num > 0);
    avgPrices[pos] = posAthletes.length > 0 
      ? posAthletes.reduce((s, a) => s + a.preco_num, 0) / posAthletes.length
      : 0;
  });

  const clubCount = Object.keys(clubs).length;
  
  // Countdown
  const closingTime = market.fechamento ? new Date(market.fechamento.timestamp * 1000) : null;
  
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

    ${closingTime ? `
    <!-- Countdown -->
    <div class="card animate-in animate-in-delay-1" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">⏱️ Fechamento do Mercado</div>
        <div style="font-size:13px;color:var(--text-secondary)">
          ${closingTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <div class="countdown" id="countdown-timer" data-timestamp="${market.fechamento.timestamp}">
        <div class="countdown-block"><span class="countdown-value" id="cd-days">--</span><span class="countdown-label">Dias</span></div>
        <span class="countdown-sep">:</span>
        <div class="countdown-block"><span class="countdown-value" id="cd-hours">--</span><span class="countdown-label">Horas</span></div>
        <span class="countdown-sep">:</span>
        <div class="countdown-block"><span class="countdown-value" id="cd-minutes">--</span><span class="countdown-label">Min</span></div>
        <span class="countdown-sep">:</span>
        <div class="countdown-block"><span class="countdown-value" id="cd-seconds">--</span><span class="countdown-label">Seg</span></div>
      </div>
    </div>
    ` : ''}

    <!-- Top Players Grid -->
    <div class="grid-2" style="margin-bottom:24px">
      <!-- Top Points -->
      <div class="card animate-in animate-in-delay-2">
        <div class="card-header">
          <div>
            <div class="card-title">🔥 Top Pontuação</div>
            <div class="card-subtitle">Última rodada</div>
          </div>
        </div>
        ${topPoints.map((p, i) => renderPlayerListItem(p, i, 'pontos_num')).join('')}
      </div>

      <!-- Top Media -->
      <div class="card animate-in animate-in-delay-2">
        <div class="card-header">
          <div>
            <div class="card-title">⭐ Top Média</div>
            <div class="card-subtitle">Na temporada</div>
          </div>
        </div>
        ${topMedia.map((p, i) => renderPlayerListItem(p, i, 'media_num')).join('')}
      </div>
    </div>

    <div class="grid-2">
      <!-- Most Appreciated -->
      <div class="card animate-in animate-in-delay-3">
        <div class="card-header">
          <div>
            <div class="card-title">📈 Mais Valorizados</div>
            <div class="card-subtitle">Última variação</div>
          </div>
        </div>
        ${mostAppreciated.map((p, i) => renderPlayerListItem(p, i, 'variacao_num')).join('')}
      </div>

      <!-- Most Depreciated -->
      <div class="card animate-in animate-in-delay-4">
        <div class="card-header">
          <div>
            <div class="card-title">📉 Mais Desvalorizados</div>
            <div class="card-subtitle">Última variação</div>
          </div>
        </div>
        ${mostDepreciated.map((p, i) => renderPlayerListItem(p, i, 'variacao_num')).join('')}
      </div>
    </div>
  `;

  // Start countdown
  if (closingTime) startCountdown(market.fechamento.timestamp);
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

let countdownInterval = null;

function startCountdown(timestamp) {
  if (countdownInterval) clearInterval(countdownInterval);
  
  function update() {
    const now = Math.floor(Date.now() / 1000);
    let diff = timestamp - now;
    if (diff <= 0) {
      document.getElementById('cd-days').textContent = '00';
      document.getElementById('cd-hours').textContent = '00';
      document.getElementById('cd-minutes').textContent = '00';
      document.getElementById('cd-seconds').textContent = '00';
      clearInterval(countdownInterval);
      return;
    }
    const days = Math.floor(diff / 86400); diff %= 86400;
    const hours = Math.floor(diff / 3600); diff %= 3600;
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    
    const dEl = document.getElementById('cd-days');
    const hEl = document.getElementById('cd-hours');
    const mEl = document.getElementById('cd-minutes');
    const sEl = document.getElementById('cd-seconds');
    if (dEl) dEl.textContent = String(days).padStart(2, '0');
    if (hEl) hEl.textContent = String(hours).padStart(2, '0');
    if (mEl) mEl.textContent = String(minutes).padStart(2, '0');
    if (sEl) sEl.textContent = String(seconds).padStart(2, '0');
  }

  update();
  countdownInterval = setInterval(update, 1000);
}

export function destroyDashboard() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}
