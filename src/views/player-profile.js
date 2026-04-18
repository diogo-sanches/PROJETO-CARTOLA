// ===== PLAYER PROFILE VIEW =====
import { getData, getScoutLabel, formatPrice, formatVariation } from '../api.js';
import { isHistoryLoaded, onHistoryLoaded, getPlayerHistory } from '../history.js';
import { calcPlayerStats } from '../stats.js';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, BarController, BarElement, Tooltip, Legend, Filler } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, BarController, BarElement, Tooltip, Legend, Filler);

let lineChart = null;
let barChart = null;

export function renderPlayerProfile(container, atletaId) {
  const data = getData();
  if (!data) return;

  const athlete = data.athletes.find(a => a.atleta_id === atletaId);
  if (!athlete) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❓</div><div class="empty-state-text">Jogador não encontrado</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="animate-in">
      <!-- Back button -->
      <button class="btn btn-ghost" id="profile-back" style="margin-bottom:16px;font-size:14px">
        ← Voltar para Jogadores
      </button>

      <!-- Player Header -->
      <div class="card" style="margin-bottom:20px">
        <div class="profile-header">
          <div class="profile-header-left">
            <img src="${athlete.clubBadge60 || athlete.clubBadge}" alt="${athlete.clubName}" class="profile-photo" onerror="this.style.display='none'">
            <div>
              <h2 class="profile-name">${athlete.apelido}</h2>
              <p class="profile-full-name">${athlete.nome}</p>
              <div style="display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap">
                <span class="position-badge ${athlete.position.class}">${athlete.position.nome}</span>
                <span class="status-badge ${athlete.status.class}">${athlete.status.icon} ${athlete.status.nome}</span>
                <span style="display:flex;align-items:center;gap:4px">
                  <img src="${athlete.clubBadge}" class="club-badge" onerror="this.style.display='none'">
                  <span style="font-size:13px;color:var(--text-secondary)">${athlete.clubName}</span>
                </span>
              </div>
            </div>
          </div>
          <div class="profile-header-right">
            <div class="profile-stat">
              <span class="profile-stat-label">Preço</span>
              <span class="profile-stat-value">${formatPrice(athlete.preco_num)}</span>
            </div>
            <div class="profile-stat">
              <span class="profile-stat-label">Variação</span>
              <span class="profile-stat-value ${athlete.variacao_num > 0 ? 'value-positive' : athlete.variacao_num < 0 ? 'value-negative' : ''}">${formatVariation(athlete.variacao_num)}</span>
            </div>
            <div class="profile-stat">
              <span class="profile-stat-label">Média</span>
              <span class="profile-stat-value" style="color:var(--accent-gold)">${athlete.media_num.toFixed(2)}</span>
            </div>
            <div class="profile-stat">
              <span class="profile-stat-label">Últ. Pts</span>
              <span class="profile-stat-value ${athlete.pontos_num > 0 ? 'value-positive' : athlete.pontos_num < 0 ? 'value-negative' : ''}">${athlete.pontos_num.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Content depends on history loading -->
      <div id="profile-content">
        ${isHistoryLoaded() ? '' : `
          <div class="card" style="text-align:center;padding:40px">
            <div class="loading-spinner" style="margin:0 auto 16px"></div>
            <p style="color:var(--text-secondary)">Carregando histórico de rodadas...</p>
          </div>
        `}
      </div>
    </div>
  `;

  // Back button
  document.getElementById('profile-back').addEventListener('click', () => {
    window.__navigateTo?.('players');
  });

  // Render historical content when ready
  if (isHistoryLoaded()) {
    renderHistoricalContent(atletaId, athlete);
  } else {
    onHistoryLoaded(() => renderHistoricalContent(atletaId, athlete));
  }
}

function renderHistoricalContent(atletaId, athlete) {
  const profileContent = document.getElementById('profile-content');
  if (!profileContent) return;

  const stats = calcPlayerStats(atletaId);
  if (!stats || stats.jogos === 0) {
    profileContent.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-text">Sem dados históricos para este jogador</div>
        </div>
      </div>
    `;
    return;
  }

  // MPV (Minimum to Appreciate) 
  const mpv = athlete.preco_num * 0.25;

  // Consistency stars
  const stars = '★'.repeat(stats.consistencia) + '☆'.repeat(5 - stats.consistencia);
  const consistLabel = stats.consistencia >= 4 ? 'Regular' : stats.consistencia >= 3 ? 'Moderado' : 'Dente de Serra';
  const trendLabel = stats.trend > 0.5 ? '📈 Em alta' : stats.trend < -0.5 ? '📉 Em baixa' : '➡️ Estável';

  profileContent.innerHTML = `
    <!-- Advanced Stats Cards -->
    <div class="stats-grid animate-in" style="margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-card-icon gold">⭐</div>
        <div class="stat-card-info">
          <h3>Média Histórica</h3>
          <div class="stat-value">${stats.media.toFixed(2)}</div>
          <div class="stat-detail">Mediana: ${stats.mediana.toFixed(1)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon ${stats.consistencia >= 4 ? 'green' : stats.consistencia >= 3 ? 'orange' : 'red'}">📊</div>
        <div class="stat-card-info">
          <h3>Consistência</h3>
          <div class="stat-value" style="font-size:20px">${stars}</div>
          <div class="stat-detail">${consistLabel} (σ = ${stats.desvioPadrao.toFixed(1)})</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon blue">🎯</div>
        <div class="stat-card-info">
          <h3>MPV</h3>
          <div class="stat-value">${mpv.toFixed(1)}</div>
          <div class="stat-detail">Mínimo para valorizar</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon purple">${stats.trend > 0.5 ? '📈' : stats.trend < -0.5 ? '📉' : '➡️'}</div>
        <div class="stat-card-info">
          <h3>Tendência</h3>
          <div class="stat-value" style="font-size:18px">${trendLabel}</div>
          <div class="stat-detail">Slope: ${stats.trend.toFixed(2)}</div>
        </div>
      </div>
    </div>

    <!-- Home vs Away -->
    <div class="stats-grid animate-in animate-in-delay-1" style="margin-bottom:20px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      <div class="stat-card">
        <div class="stat-card-icon green">🏠</div>
        <div class="stat-card-info">
          <h3>Média Casa</h3>
          <div class="stat-value">${stats.mediaCasa.toFixed(2)}</div>
          <div class="stat-detail">${stats.jogosCasa} jogos</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon orange">✈️</div>
        <div class="stat-card-info">
          <h3>Média Fora</h3>
          <div class="stat-value">${stats.mediaFora.toFixed(2)}</div>
          <div class="stat-detail">${stats.jogosFora} jogos</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon green">🔝</div>
        <div class="stat-card-info">
          <h3>Máxima</h3>
          <div class="stat-value value-positive">${stats.maxPts.toFixed(1)}</div>
          <div class="stat-detail">Rodada ${stats.maxRound || '-'}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon red">🔻</div>
        <div class="stat-card-info">
          <h3>Mínima</h3>
          <div class="stat-value value-negative">${stats.minPts.toFixed(1)}</div>
          <div class="stat-detail">Rodada ${stats.minRound || '-'}</div>
        </div>
      </div>
    </div>

    <!-- Evolution Chart -->
    <div class="card animate-in animate-in-delay-2" style="margin-bottom:20px">
      <div class="card-header">
        <div class="card-title">📈 Evolução de Pontuação</div>
        <div style="font-size:12px;color:var(--text-muted)">
          <span style="color:var(--accent-green)">●</span> Pontuação &nbsp;
          <span style="color:var(--accent-gold)">●</span> Média Móvel (3R) &nbsp;
          <span style="color:var(--accent-red);opacity:0.4">---</span> MPV (${mpv.toFixed(1)})
        </div>
      </div>
      <div class="chart-container" style="max-height:300px">
        <canvas id="evolution-chart"></canvas>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:20px">
      <!-- Round-by-round table -->
      <div class="card animate-in animate-in-delay-3">
        <div class="card-header">
          <div class="card-title">📋 Desempenho por Rodada</div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Rod.</th>
                <th>Pts</th>
                <th>Scouts Destaque</th>
              </tr>
            </thead>
            <tbody>
              ${stats.history.map(h => {
                const ptsClass = h.pontuacao > mpv ? 'value-positive' : h.pontuacao < 0 ? 'value-negative' : 'value-neutral';
                const topScouts = Object.entries(h.scout || {})
                  .filter(([k, v]) => v > 0)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([k, v]) => `<span style="background:var(--bg-secondary);padding:2px 6px;border-radius:4px;font-size:10px;margin-right:3px">${k}:${v}</span>`)
                  .join('');
                return `
                <tr>
                  <td style="font-weight:600;text-align:center">R${h.round}</td>
                  <td><span class="score-pill ${h.pontuacao > 0 ? 'positive' : h.pontuacao < 0 ? 'negative' : 'neutral'}">${h.pontuacao.toFixed(1)}</span></td>
                  <td>${topScouts || '<span style="color:var(--text-muted);font-size:11px">—</span>'}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Scouts Total -->
      <div class="card animate-in animate-in-delay-4">
        <div class="card-header">
          <div class="card-title">🔍 Scouts Acumulados</div>
          <div class="card-subtitle">${stats.jogos} jogos disputados</div>
        </div>
        ${renderScoutBars(stats.scoutsTotal)}
      </div>
    </div>
  `;

  // Render evolution chart
  renderEvolutionChart(stats, mpv);
}

function renderScoutBars(scouts) {
  const entries = Object.entries(scouts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return '<p style="color:var(--text-muted);font-size:13px">Sem scouts registrados</p>';

  const maxVal = Math.max(...entries.map(([, v]) => v));
  
  // Color scouts by type
  const positiveScouts = ['G', 'A', 'DS', 'FS', 'SG', 'DE', 'FD', 'FT', 'V', 'PS', 'PE'];
  const negativeScouts = ['CA', 'CV', 'FC', 'GC', 'GS', 'PP', 'I'];

  return entries.map(([key, val]) => {
    const pct = (val / maxVal) * 100;
    const isPositive = positiveScouts.includes(key);
    const isNegative = negativeScouts.includes(key);
    const color = isPositive ? 'var(--accent-green)' : isNegative ? 'var(--accent-red)' : 'var(--accent-blue)';
    const bgColor = isPositive ? 'var(--accent-green-dim)' : isNegative ? 'var(--accent-red-dim)' : 'var(--accent-blue-dim)';

    return `
      <div style="display:flex;align-items:center;gap:10px;padding:6px 0">
        <div style="width:100px;font-size:11px;color:var(--text-secondary);font-weight:500;text-align:right;flex-shrink:0">${getScoutLabel(key)}</div>
        <div style="flex:1;height:22px;background:${bgColor};border-radius:4px;overflow:hidden;position:relative">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.6s ease;min-width:20px;display:flex;align-items:center;justify-content:flex-end;padding-right:6px">
            <span style="font-size:11px;font-weight:700;color:var(--bg-primary)">${val}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderEvolutionChart(stats, mpv) {
  if (lineChart) lineChart.destroy();

  const ctx = document.getElementById('evolution-chart');
  if (!ctx) return;

  const labels = stats.history.map(h => `R${h.round}`);
  const pontos = stats.history.map(h => h.pontuacao);
  const movAvg = stats.movingAvg;

  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Pontuação',
          data: pontos,
          borderColor: '#00e676',
          backgroundColor: 'rgba(0, 230, 118, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          pointRadius: 5,
          pointBackgroundColor: pontos.map(p => p >= mpv ? '#00e676' : p < 0 ? '#ef5350' : '#8b95a5'),
          pointBorderColor: pontos.map(p => p >= mpv ? '#00e676' : p < 0 ? '#ef5350' : '#8b95a5'),
          pointHoverRadius: 7,
        },
        {
          label: 'Média Móvel (3R)',
          data: movAvg,
          borderColor: '#ffd700',
          borderWidth: 2,
          borderDash: [5, 3],
          pointRadius: 0,
          tension: 0.4,
          fill: false,
        },
        {
          label: `MPV (${mpv.toFixed(1)})`,
          data: Array(labels.length).fill(mpv),
          borderColor: 'rgba(239, 83, 80, 0.4)',
          borderWidth: 1.5,
          borderDash: [8, 4],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#5a6577', font: { family: 'Inter', size: 11 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#5a6577', font: { family: 'Inter', size: 11 } },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2234',
          titleColor: '#f0f4f8',
          bodyColor: '#8b95a5',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { family: 'Inter', weight: '700' },
          bodyFont: { family: 'Inter' },
          callbacks: {
            afterBody: (items) => {
              const idx = items[0]?.dataIndex;
              if (idx === undefined) return '';
              const h = stats.history[idx];
              if (!h) return '';
              const scouts = Object.entries(h.scout || {})
                .filter(([, v]) => v > 0)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');
              return scouts ? `\nScouts: ${scouts}` : '';
            },
          },
        },
      },
    },
  });
}

export function destroyPlayerProfile() {
  if (lineChart) { lineChart.destroy(); lineChart = null; }
  if (barChart) { barChart.destroy(); barChart = null; }
}
