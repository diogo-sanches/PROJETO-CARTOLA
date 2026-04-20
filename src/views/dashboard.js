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

  const clubCount = Object.keys(clubs).length;
  
  // Countdown - closing time
  const closingTime = market.fechamento ? new Date(market.fechamento.timestamp * 1000) : null;
  const isMarketOpen = market.status_mercado === 1;
  const now = Date.now();
  const isClosed = closingTime && now >= closingTime.getTime();
  
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

    <!-- Countdown / Market Status -->
    <div class="card animate-in animate-in-delay-1" style="margin-bottom:24px" id="market-status-card">
      <div id="market-status-content">
        <!-- Filled by JS -->
      </div>
    </div>

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

  // Start market status timer
  startMarketTimer(market);
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

function startMarketTimer(market) {
  if (countdownInterval) clearInterval(countdownInterval);

  const closingTimestamp = market.fechamento?.timestamp;
  const isMarketOpen = market.status_mercado === 1;
  
  function update() {
    const container = document.getElementById('market-status-content');
    if (!container) { clearInterval(countdownInterval); return; }

    const now = Math.floor(Date.now() / 1000);
    
    if (closingTimestamp && now < closingTimestamp && isMarketOpen) {
      // === MARKET OPEN: Show countdown to closing ===
      let diff = closingTimestamp - now;
      const days = Math.floor(diff / 86400); diff %= 86400;
      const hours = Math.floor(diff / 3600); diff %= 3600;
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      
      const closingDate = new Date(closingTimestamp * 1000);
      const dateStr = closingDate.toLocaleDateString('pt-BR', { 
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
      });

      container.innerHTML = `
        <div class="card-header">
          <div class="card-title">
            <span class="market-pulse open"></span>
            ⏱️ Fechamento do Mercado
          </div>
          <div style="font-size:13px;color:var(--text-secondary)">${dateStr}</div>
        </div>
        <div class="countdown">
          <div class="countdown-block">
            <span class="countdown-value">${String(days).padStart(2, '0')}</span>
            <span class="countdown-label">Dias</span>
          </div>
          <span class="countdown-sep">:</span>
          <div class="countdown-block">
            <span class="countdown-value">${String(hours).padStart(2, '0')}</span>
            <span class="countdown-label">Horas</span>
          </div>
          <span class="countdown-sep">:</span>
          <div class="countdown-block">
            <span class="countdown-value">${String(minutes).padStart(2, '0')}</span>
            <span class="countdown-label">Min</span>
          </div>
          <span class="countdown-sep">:</span>
          <div class="countdown-block">
            <span class="countdown-value">${String(seconds).padStart(2, '0')}</span>
            <span class="countdown-label">Seg</span>
          </div>
        </div>
      `;
    } else {
      // === MARKET CLOSED: Show "MERCADO FECHADO" + time since closed ===
      // Calculate time since market closed
      let elapsed = 0;
      if (closingTimestamp) {
        elapsed = now - closingTimestamp;
      }

      // Estimate next opening (typically the day after last game, Monday ~12h)
      // For now, show elapsed since closing
      const elapsedHours = Math.floor(elapsed / 3600);
      const elapsedMinutes = Math.floor((elapsed % 3600) / 60);
      const elapsedSeconds = elapsed % 60;

      const closingDate = closingTimestamp 
        ? new Date(closingTimestamp * 1000).toLocaleDateString('pt-BR', { 
            weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
          })
        : '';

      container.innerHTML = `
        <div style="text-align:center;padding:8px 0">
          <!-- MERCADO FECHADO Badge -->
          <div class="market-closed-badge">
            <span class="market-pulse closed"></span>
            🔒 MERCADO FECHADO!
          </div>
          
          ${closingDate ? `
          <p style="color:var(--text-muted);font-size:12px;margin-top:8px">
            Fechou em: ${closingDate}
          </p>
          ` : ''}

          <!-- Time elapsed since closing -->
          <div style="margin-top:16px">
            <p style="color:var(--text-secondary);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">
              ⏳ Tempo desde o fechamento
            </p>
            <div class="countdown">
              <div class="countdown-block closed-block">
                <span class="countdown-value closed-value">${String(elapsedHours).padStart(2, '0')}</span>
                <span class="countdown-label">Horas</span>
              </div>
              <span class="countdown-sep">:</span>
              <div class="countdown-block closed-block">
                <span class="countdown-value closed-value">${String(elapsedMinutes).padStart(2, '0')}</span>
                <span class="countdown-label">Min</span>
              </div>
              <span class="countdown-sep">:</span>
              <div class="countdown-block closed-block">
                <span class="countdown-value closed-value">${String(elapsedSeconds).padStart(2, '0')}</span>
                <span class="countdown-label">Seg</span>
              </div>
            </div>
          </div>

          <p style="color:var(--text-muted);font-size:11px;margin-top:12px">
            O mercado reabre após a última partida da rodada
          </p>
        </div>
      `;
    }
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
