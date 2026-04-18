// ===== COMPARE VIEW =====
// With Casa / Fora / Total filter (inspired by Escala10)
import { getData, getScoutLabel, formatPrice, formatVariation } from '../api.js';
import { isHistoryLoaded, onHistoryLoaded, getClubMatchInRound } from '../history.js';
import { calcPlayerStats } from '../stats.js';
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

let player1 = null;
let player2 = null;
let radarChart = null;
let currentVenueFilter = 'total'; // 'total' | 'casa' | 'fora'

export function renderCompare(container) {
  const data = getData();
  if (!data) return;

  container.innerHTML = `
    <div class="animate-in">
      <div class="card" style="margin-bottom:24px">
        <div class="card-header">
          <div class="card-title">⚖️ Comparar Jogadores</div>
        </div>
        <p style="color:var(--text-secondary);font-size:14px;margin-bottom:20px">
          Selecione dois jogadores para comparação detalhada de scouts e métricas.
        </p>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:20px;align-items:start">
          <!-- Player 1 Select -->
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:block">Jogador 1</label>
            <div class="player-select-dropdown" id="select-1-container">
              <input type="text" class="player-select-input" id="select-1-input" placeholder="Digite o nome do jogador..." autocomplete="off">
              <div class="player-select-results" id="select-1-results"></div>
            </div>
            <div id="selected-1-card" style="margin-top:12px"></div>
          </div>
          <div class="compare-vs" style="margin-top:28px">VS</div>
          <!-- Player 2 Select -->
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:block">Jogador 2</label>
            <div class="player-select-dropdown" id="select-2-container">
              <input type="text" class="player-select-input" id="select-2-input" placeholder="Digite o nome do jogador..." autocomplete="off">
              <div class="player-select-results" id="select-2-results"></div>
            </div>
            <div id="selected-2-card" style="margin-top:12px"></div>
          </div>
        </div>
      </div>

      <!-- Venue Filter (Casa / Fora / Total) -->
      <div class="card" style="margin-bottom:20px" id="venue-filter-card">
        <div style="display:flex;align-items:center;gap:12px;justify-content:center">
          <span style="font-size:13px;font-weight:600;color:var(--text-muted);margin-right:8px">📍 Filtro de Mando:</span>
          <div class="venue-toggle" id="venue-toggle">
            <button class="venue-btn active" data-venue="total">🔄 Total</button>
            <button class="venue-btn" data-venue="casa">🏠 Casa</button>
            <button class="venue-btn" data-venue="fora">✈️ Fora</button>
          </div>
        </div>
        ${!isHistoryLoaded() ? '<p style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:8px">⏳ Dados históricos carregando... Filtro casa/fora estará disponível em breve.</p>' : ''}
      </div>

      <!-- Comparison Area -->
      <div id="comparison-area"></div>
    </div>
  `;

  // Setup search inputs
  setupPlayerSearch(1);
  setupPlayerSearch(2);

  // Venue filter buttons
  document.querySelectorAll('.venue-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.venue-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentVenueFilter = btn.dataset.venue;
      if (player1 && player2) renderComparison();
    });
  });

  // When history loads, enable venue filter
  if (!isHistoryLoaded()) {
    onHistoryLoaded(() => {
      const hint = document.querySelector('#venue-filter-card p');
      if (hint) hint.remove();
      if (player1 && player2) renderComparison();
    });
  }
}

function setupPlayerSearch(num) {
  const input = document.getElementById(`select-${num}-input`);
  const results = document.getElementById(`select-${num}-results`);

  input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();
    if (query.length < 2) {
      results.classList.remove('visible');
      return;
    }

    const data = getData();
    const matches = data.athletes
      .filter(a => a.apelido.toLowerCase().includes(query) || a.nome.toLowerCase().includes(query))
      .filter(a => a.jogos_num > 0)
      .slice(0, 8);

    if (matches.length === 0) {
      results.classList.remove('visible');
      return;
    }

    results.innerHTML = matches.map(a => `
      <div class="player-select-option" data-id="${a.atleta_id}">
        <img src="${a.clubBadge}" alt="" class="club-badge" onerror="this.style.display='none'">
        <div>
          <div style="font-weight:600;font-size:13px">${a.apelido}</div>
          <div style="font-size:11px;color:var(--text-muted)">${a.clubName} · ${a.position.abr}</div>
        </div>
        <span class="position-badge ${a.position.class}" style="margin-left:auto">${a.position.abr}</span>
      </div>
    `).join('');
    results.classList.add('visible');

    results.querySelectorAll('.player-select-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const id = parseInt(opt.dataset.id);
        const athlete = data.athletes.find(a => a.atleta_id === id);
        if (!athlete) return;

        if (num === 1) player1 = athlete;
        else player2 = athlete;

        input.value = athlete.apelido;
        results.classList.remove('visible');
        renderSelectedCard(num, athlete);

        if (player1 && player2) renderComparison();
      });
    });
  });

  input.addEventListener('focus', () => {
    if (input.value.length >= 2) {
      input.dispatchEvent(new Event('input'));
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest(`#select-${num}-container`)) {
      results.classList.remove('visible');
    }
  });
}

function renderSelectedCard(num, athlete) {
  const card = document.getElementById(`selected-${num}-card`);
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md)">
      <img src="${athlete.clubBadge60 || athlete.clubBadge}" alt="" style="width:40px;height:40px;border-radius:50%;border:2px solid var(--border-color)" onerror="this.style.display='none'">
      <div>
        <div style="font-weight:700;font-size:15px">${athlete.apelido}</div>
        <div style="font-size:12px;color:var(--text-secondary)">${athlete.clubName} · ${athlete.position.nome}</div>
      </div>
      <span class="position-badge ${athlete.position.class}" style="margin-left:auto">${athlete.position.abr}</span>
    </div>
  `;
}

function getPlayerMetricsByVenue(athlete) {
  // If total or no history, use API data
  if (currentVenueFilter === 'total' || !isHistoryLoaded()) {
    return {
      media: athlete.media_num,
      pontos: athlete.pontos_num,
      preco: athlete.preco_num,
      variacao: athlete.variacao_num,
      jogos: athlete.jogos_num,
      scout: athlete.scout || {},
      label: 'Total',
    };
  }

  const stats = calcPlayerStats(athlete.atleta_id);
  if (!stats || stats.jogos === 0) {
    return {
      media: athlete.media_num,
      pontos: athlete.pontos_num,
      preco: athlete.preco_num,
      variacao: athlete.variacao_num,
      jogos: athlete.jogos_num,
      scout: athlete.scout || {},
      label: 'Total',
    };
  }

  const isCasa = currentVenueFilter === 'casa';

  // Get rounds that match the venue filter
  const filteredRounds = stats.history.filter(h => {
    const match = getClubMatchInRound(h.clube_id, h.round);
    if (!match) return false;
    return isCasa ? match.isHome : !match.isHome;
  });

  // Calculate scouts for filtered rounds
  const filteredScout = {};
  let totalPts = 0;
  for (const h of filteredRounds) {
    totalPts += h.pontuacao;
    for (const [k, v] of Object.entries(h.scout || {})) {
      filteredScout[k] = (filteredScout[k] || 0) + v;
    }
  }

  return {
    media: isCasa ? stats.mediaCasa : stats.mediaFora,
    pontos: filteredRounds.length > 0 ? filteredRounds[filteredRounds.length - 1].pontuacao : 0,
    preco: athlete.preco_num,
    variacao: athlete.variacao_num,
    jogos: isCasa ? stats.jogosCasa : stats.jogosFora,
    scout: filteredScout,
    label: isCasa ? 'Casa' : 'Fora',
  };
}

function renderComparison() {
  if (!player1 || !player2) return;

  const area = document.getElementById('comparison-area');

  // Get metrics according to venue filter
  let m1, m2;
  try {
    m1 = getPlayerMetricsByVenue(player1);
    m2 = getPlayerMetricsByVenue(player2);
  } catch {
    // Fallback to total if module loading has issues
    m1 = { media: player1.media_num, pontos: player1.pontos_num, preco: player1.preco_num, variacao: player1.variacao_num, jogos: player1.jogos_num, scout: player1.scout || {}, label: 'Total' };
    m2 = { media: player2.media_num, pontos: player2.pontos_num, preco: player2.preco_num, variacao: player2.variacao_num, jogos: player2.jogos_num, scout: player2.scout || {}, label: 'Total' };
  }

  // Common scout keys from the filtered data
  const allKeys = new Set([...Object.keys(m1.scout), ...Object.keys(m2.scout)]);
  const scoutKeys = Array.from(allKeys).sort();

  const venueLabel = currentVenueFilter === 'total' ? '🔄 Total' : currentVenueFilter === 'casa' ? '🏠 Casa' : '✈️ Fora';

  // Build metrics rows
  const metrics = [
    { label: 'Média', v1: m1.media, v2: m2.media, format: v => v.toFixed(2), higherBetter: true },
    { label: 'Última Pts', v1: m1.pontos, v2: m2.pontos, format: v => v.toFixed(1), higherBetter: true },
    { label: 'Preço', v1: m1.preco, v2: m2.preco, format: v => formatPrice(v), higherBetter: false },
    { label: 'Variação', v1: m1.variacao, v2: m2.variacao, format: v => formatVariation(v), higherBetter: true },
    { label: 'Jogos', v1: m1.jogos, v2: m2.jogos, format: v => v.toString(), higherBetter: true },
  ];

  // Historical metrics if available
  if (isHistoryLoaded()) {
    const stats1 = calcPlayerStats(player1.atleta_id);
    const stats2 = calcPlayerStats(player2.atleta_id);
    if (stats1 && stats2) {
      metrics.push(
        { label: 'Consistência', v1: stats1.consistencia, v2: stats2.consistencia, format: v => '★'.repeat(v) + '☆'.repeat(5 - v), higherBetter: true },
        { label: 'Desvio Padrão', v1: stats1.desvioPadrao, v2: stats2.desvioPadrao, format: v => v.toFixed(1), higherBetter: false },
        { label: 'Média Casa', v1: stats1.mediaCasa, v2: stats2.mediaCasa, format: v => v.toFixed(2), higherBetter: true },
        { label: 'Média Fora', v1: stats1.mediaFora, v2: stats2.mediaFora, format: v => v.toFixed(2), higherBetter: true },
        { label: 'Melhor Pts', v1: stats1.maxPts, v2: stats2.maxPts, format: v => v.toFixed(1), higherBetter: true },
        { label: 'Pior Pts', v1: stats1.minPts, v2: stats2.minPts, format: v => v.toFixed(1), higherBetter: false },
      );
    }
  }

  area.innerHTML = `
    <div class="animate-in">
      <div style="text-align:center;margin-bottom:12px">
        <span style="background:var(--bg-secondary);padding:6px 16px;border-radius:20px;font-size:12px;font-weight:600;color:var(--text-secondary)">
          ${venueLabel} · Scouts e Métricas
        </span>
      </div>

      <!-- Metrics Comparison -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">📊 Métricas Gerais</div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th style="text-align:center;color:var(--accent-blue)">${player1.apelido}</th>
                <th style="text-align:center">Métrica</th>
                <th style="text-align:center;color:var(--accent-green)">${player2.apelido}</th>
              </tr>
            </thead>
            <tbody>
              ${metrics.map(m => {
                const better1 = m.higherBetter ? m.v1 > m.v2 : m.v1 < m.v2;
                const better2 = m.higherBetter ? m.v2 > m.v1 : m.v2 < m.v1;
                return `
                <tr>
                  <td style="text-align:center;font-weight:700;${better1 ? 'color:var(--accent-blue)' : ''}">${m.format(m.v1)}</td>
                  <td style="text-align:center;color:var(--text-muted);font-weight:600;font-size:12px">${m.label}</td>
                  <td style="text-align:center;font-weight:700;${better2 ? 'color:var(--accent-green)' : ''}">${m.format(m.v2)}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid-2">
        <!-- Scout Bars -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🔍 Comparação de Scout ${currentVenueFilter !== 'total' ? `(${currentVenueFilter === 'casa' ? 'Casa' : 'Fora'})` : ''}</div>
          </div>
          ${scoutKeys.length > 0 ? scoutKeys.map(key => {
            const v1 = m1.scout[key] || 0;
            const v2 = m2.scout[key] || 0;
            const max = Math.max(v1, v2, 1);
            const p1 = (v1 / max) * 100;
            const p2 = (v2 / max) * 100;
            return `
            <div class="compare-bar-row">
              <div class="compare-bar-left">
                <div class="compare-bar-fill" style="width:${p1}%"><span>${v1}</span></div>
              </div>
              <div class="compare-bar-label">${getScoutLabel(key)}</div>
              <div class="compare-bar-right">
                <div class="compare-bar-fill" style="width:${p2}%"><span>${v2}</span></div>
              </div>
            </div>
          `}).join('') : '<p style="text-align:center;color:var(--text-muted);padding:20px">Sem scouts para este filtro</p>'}
          <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12px;color:var(--text-muted)">
            <span style="color:var(--accent-blue);font-weight:600">${player1.apelido}</span>
            <span style="color:var(--accent-green);font-weight:600">${player2.apelido}</span>
          </div>
        </div>

        <!-- Radar Chart -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">📈 Gráfico Radar</div>
          </div>
          <div class="chart-container" style="display:flex;justify-content:center">
            <canvas id="compare-radar" width="320" height="320"></canvas>
          </div>
        </div>
      </div>
    </div>
  `;

  renderRadarChart(scoutKeys, m1, m2);
}

function renderRadarChart(keys, m1, m2) {
  if (radarChart) radarChart.destroy();

  const radarKeys = keys.filter(k => {
    const v1 = m1.scout[k] || 0;
    const v2 = m2.scout[k] || 0;
    return v1 > 0 || v2 > 0;
  }).slice(0, 8);

  if (radarKeys.length < 3) return;

  const ctx = document.getElementById('compare-radar');
  if (!ctx) return;

  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: radarKeys.map(k => getScoutLabel(k)),
      datasets: [
        {
          label: player1.apelido,
          data: radarKeys.map(k => m1.scout[k] || 0),
          backgroundColor: 'rgba(66, 165, 245, 0.2)',
          borderColor: 'rgba(66, 165, 245, 0.8)',
          borderWidth: 2,
          pointBackgroundColor: '#42a5f5',
          pointRadius: 3,
        },
        {
          label: player2.apelido,
          data: radarKeys.map(k => m2.scout[k] || 0),
          backgroundColor: 'rgba(0, 230, 118, 0.2)',
          borderColor: 'rgba(0, 230, 118, 0.8)',
          borderWidth: 2,
          pointBackgroundColor: '#00e676',
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          angleLines: { color: 'rgba(255,255,255,0.06)' },
          grid: { color: 'rgba(255,255,255,0.06)' },
          pointLabels: {
            color: '#8b95a5',
            font: { family: 'Inter', size: 10, weight: '500' },
          },
          ticks: { display: false, beginAtZero: true },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#8b95a5',
            font: { family: 'Inter', size: 11, weight: '500' },
            padding: 16,
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: '#1a2234',
          titleColor: '#f0f4f8',
          bodyColor: '#8b95a5',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
        },
      },
    },
  });
}

export function destroyCompare() {
  if (radarChart) { radarChart.destroy(); radarChart = null; }
  player1 = null;
  player2 = null;
  currentVenueFilter = 'total';
}
