// ===== COMPARE VIEW =====
// Independent Casa / Fora / Total filter per player
import { getData, getScoutLabel, formatPrice, formatVariation } from '../api.js';
import { isHistoryLoaded, onHistoryLoaded, getClubMatchInRound } from '../history.js';
import { calcPlayerStats } from '../stats.js';
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

let player1 = null;
let player2 = null;
let radarChart = null;
let venueFilter1 = 'total'; // independent filter for player 1
let venueFilter2 = 'total'; // independent filter for player 2

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
          Selecione dois jogadores e filtre as métricas por mando de campo individualmente.
        </p>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:20px;align-items:start">
          <!-- Player 1 -->
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:block">Jogador 1</label>
            <div class="player-select-dropdown" id="select-1-container">
              <input type="text" class="player-select-input" id="select-1-input" placeholder="Digite o nome..." autocomplete="off">
              <div class="player-select-results" id="select-1-results"></div>
            </div>
            <div id="selected-1-card" style="margin-top:12px"></div>
            <!-- Venue filter P1 -->
            <div style="margin-top:8px" id="venue-p1-wrap" class="hidden">
              <div class="venue-toggle venue-toggle-sm">
                <button class="venue-btn venue-btn-sm active" data-player="1" data-venue="total">Total</button>
                <button class="venue-btn venue-btn-sm" data-player="1" data-venue="casa">🏠 Casa</button>
                <button class="venue-btn venue-btn-sm" data-player="1" data-venue="fora">✈️ Fora</button>
              </div>
            </div>
          </div>
          <div class="compare-vs" style="margin-top:28px">VS</div>
          <!-- Player 2 -->
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:block">Jogador 2</label>
            <div class="player-select-dropdown" id="select-2-container">
              <input type="text" class="player-select-input" id="select-2-input" placeholder="Digite o nome..." autocomplete="off">
              <div class="player-select-results" id="select-2-results"></div>
            </div>
            <div id="selected-2-card" style="margin-top:12px"></div>
            <!-- Venue filter P2 -->
            <div style="margin-top:8px" id="venue-p2-wrap" class="hidden">
              <div class="venue-toggle venue-toggle-sm">
                <button class="venue-btn venue-btn-sm active" data-player="2" data-venue="total">Total</button>
                <button class="venue-btn venue-btn-sm" data-player="2" data-venue="casa">🏠 Casa</button>
                <button class="venue-btn venue-btn-sm" data-player="2" data-venue="fora">✈️ Fora</button>
              </div>
            </div>
          </div>
        </div>
        ${!isHistoryLoaded() ? '<p style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:12px">⏳ Filtros casa/fora disponíveis após carregamento do histórico</p>' : ''}
      </div>

      <div id="comparison-area"></div>
    </div>
  `;

  setupPlayerSearch(1);
  setupPlayerSearch(2);
  setupVenueButtons();

  if (!isHistoryLoaded()) {
    onHistoryLoaded(() => {
      const hint = document.querySelector('#select-1-container')?.closest('.card')?.querySelector('p:last-child');
      if (hint && hint.textContent.includes('casa/fora')) hint.remove();
      if (player1 && player2) renderComparison();
    });
  }
}

function setupVenueButtons() {
  document.querySelectorAll('.venue-btn-sm').forEach(btn => {
    btn.addEventListener('click', () => {
      const playerNum = btn.dataset.player;
      const venue = btn.dataset.venue;
      // Update active state
      btn.closest('.venue-toggle').querySelectorAll('.venue-btn-sm').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      if (playerNum === '1') venueFilter1 = venue;
      else venueFilter2 = venue;

      if (player1 && player2) renderComparison();
    });
  });
}

function setupPlayerSearch(num) {
  const input = document.getElementById(`select-${num}-input`);
  const results = document.getElementById(`select-${num}-results`);

  input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();
    if (query.length < 2) { results.classList.remove('visible'); return; }

    const data = getData();
    const matches = data.athletes
      .filter(a => a.apelido.toLowerCase().includes(query) || a.nome.toLowerCase().includes(query))
      .filter(a => a.jogos_num > 0)
      .slice(0, 8);

    if (!matches.length) { results.classList.remove('visible'); return; }

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
        // Show venue filter
        const wrap = document.getElementById(`venue-p${num}-wrap`);
        if (wrap) wrap.classList.remove('hidden');
        if (player1 && player2) renderComparison();
      });
    });
  });

  input.addEventListener('focus', () => { if (input.value.length >= 2) input.dispatchEvent(new Event('input')); });
  document.addEventListener('click', (e) => { if (!e.target.closest(`#select-${num}-container`)) results.classList.remove('visible'); });
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

function getVenueAvg(stats, venue) {
  if (!stats) return null;
  if (venue === 'casa') return stats.mediaCasa;
  if (venue === 'fora') return stats.mediaFora;
  return stats.media;
}

function getVenueScout(stats, athlete, venue) {
  if (!stats || venue === 'total' || !isHistoryLoaded()) return athlete.scout || {};
  
  const isCasa = venue === 'casa';
  const filtered = {};
  
  for (const h of stats.history) {
    const match = getClubMatchInRound(h.clube_id, h.round);
    if (!match) continue;
    const isHome = match.isHome;
    if ((isCasa && !isHome) || (!isCasa && isHome)) continue;
    for (const [k, v] of Object.entries(h.scout || {})) {
      filtered[k] = (filtered[k] || 0) + v;
    }
  }
  return filtered;
}

function renderComparison() {
  if (!player1 || !player2) return;
  const area = document.getElementById('comparison-area');

  const stats1 = isHistoryLoaded() ? calcPlayerStats(player1.atleta_id) : null;
  const stats2 = isHistoryLoaded() ? calcPlayerStats(player2.atleta_id) : null;

  const scout1 = getVenueScout(stats1, player1, venueFilter1);
  const scout2 = getVenueScout(stats2, player2, venueFilter2);

  const allKeys = new Set([...Object.keys(scout1), ...Object.keys(scout2)]);
  const scoutKeys = Array.from(allKeys).sort();

  const venueLabel = (v) => v === 'total' ? '🔄 Total' : v === 'casa' ? '🏠 Casa' : '✈️ Fora';
  
  // Build player header cards with averages
  const avg1Total = player1.media_num;
  const avg1Casa = stats1 ? stats1.mediaCasa : null;
  const avg1Fora = stats1 ? stats1.mediaFora : null;
  const avg1Selected = stats1 ? getVenueAvg(stats1, venueFilter1) : avg1Total;

  const avg2Total = player2.media_num;
  const avg2Casa = stats2 ? stats2.mediaCasa : null;
  const avg2Fora = stats2 ? stats2.mediaFora : null;
  const avg2Selected = stats2 ? getVenueAvg(stats2, venueFilter2) : avg2Total;

  // Metrics
  const metrics = [
    { label: `Média (${venueLabel(venueFilter1)} / ${venueLabel(venueFilter2)})`, v1: avg1Selected, v2: avg2Selected, format: v => v?.toFixed(2) || '-', higherBetter: true },
    { label: 'Última Pts', v1: player1.pontos_num, v2: player2.pontos_num, format: v => v.toFixed(1), higherBetter: true },
    { label: 'Preço', v1: player1.preco_num, v2: player2.preco_num, format: v => formatPrice(v), higherBetter: false },
    { label: 'Variação', v1: player1.variacao_num, v2: player2.variacao_num, format: v => formatVariation(v), higherBetter: true },
    { label: 'Jogos', v1: player1.jogos_num, v2: player2.jogos_num, format: v => v.toString(), higherBetter: true },
  ];

  if (stats1 && stats2) {
    metrics.push(
      { label: 'Consistência', v1: stats1.consistencia, v2: stats2.consistencia, format: v => '★'.repeat(v) + '☆'.repeat(5 - v), higherBetter: true },
      { label: 'Desvio Padrão', v1: stats1.desvioPadrao, v2: stats2.desvioPadrao, format: v => v.toFixed(1), higherBetter: false },
      { label: 'Melhor Pts', v1: stats1.maxPts, v2: stats2.maxPts, format: v => v.toFixed(1), higherBetter: true },
      { label: 'Pior Pts', v1: stats1.minPts, v2: stats2.minPts, format: v => v.toFixed(1), higherBetter: false },
    );
  }

  area.innerHTML = `
    <div class="animate-in">
      <!-- Player Average Headers -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        ${renderPlayerAvgCard(player1, avg1Total, avg1Casa, avg1Fora, venueFilter1, 'var(--accent-blue)')}
        ${renderPlayerAvgCard(player2, avg2Total, avg2Casa, avg2Fora, venueFilter2, 'var(--accent-green)')}
      </div>

      <!-- Metrics Table -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><div class="card-title">📊 Métricas Gerais</div></div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th style="text-align:center;color:var(--accent-blue)">${player1.apelido} <span style="font-size:10px;font-weight:400;opacity:0.7">(${venueLabel(venueFilter1)})</span></th>
                <th style="text-align:center">Métrica</th>
                <th style="text-align:center;color:var(--accent-green)">${player2.apelido} <span style="font-size:10px;font-weight:400;opacity:0.7">(${venueLabel(venueFilter2)})</span></th>
              </tr>
            </thead>
            <tbody>
              ${metrics.map(m => {
                const better1 = m.higherBetter ? m.v1 > m.v2 : m.v1 < m.v2;
                const better2 = m.higherBetter ? m.v2 > m.v1 : m.v2 < m.v1;
                return `<tr>
                  <td style="text-align:center;font-weight:700;${better1 ? 'color:var(--accent-blue)' : ''}">${m.format(m.v1)}</td>
                  <td style="text-align:center;color:var(--text-muted);font-weight:600;font-size:12px">${m.label}</td>
                  <td style="text-align:center;font-weight:700;${better2 ? 'color:var(--accent-green)' : ''}">${m.format(m.v2)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header"><div class="card-title">🔍 Scouts</div></div>
          ${scoutKeys.length > 0 ? scoutKeys.map(key => {
            const v1 = scout1[key] || 0;
            const v2 = scout2[key] || 0;
            const max = Math.max(v1, v2, 1);
            return `<div class="compare-bar-row">
              <div class="compare-bar-left"><div class="compare-bar-fill" style="width:${(v1/max)*100}%"><span>${v1}</span></div></div>
              <div class="compare-bar-label">${getScoutLabel(key)}</div>
              <div class="compare-bar-right"><div class="compare-bar-fill" style="width:${(v2/max)*100}%"><span>${v2}</span></div></div>
            </div>`;
          }).join('') : '<p style="text-align:center;color:var(--text-muted);padding:20px">Sem scouts</p>'}
          <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12px">
            <span style="color:var(--accent-blue);font-weight:600">${player1.apelido}</span>
            <span style="color:var(--accent-green);font-weight:600">${player2.apelido}</span>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">📈 Radar</div></div>
          <div class="chart-container" style="display:flex;justify-content:center">
            <canvas id="compare-radar" width="320" height="320"></canvas>
          </div>
        </div>
      </div>
    </div>
  `;

  renderRadarChart(scoutKeys, scout1, scout2);
}

function renderPlayerAvgCard(player, avgTotal, avgCasa, avgFora, selectedVenue, color) {
  const selectedAvg = selectedVenue === 'casa' ? avgCasa : selectedVenue === 'fora' ? avgFora : avgTotal;
  return `
    <div class="card" style="border-left:3px solid ${color}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <img src="${player.clubBadge60 || player.clubBadge}" alt="" style="width:36px;height:36px;border-radius:50%" onerror="this.style.display='none'">
        <div>
          <div style="font-weight:700;font-size:15px">${player.apelido}</div>
          <div style="font-size:11px;color:var(--text-muted)">${player.clubName}</div>
        </div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="text-align:center;flex:1;min-width:60px">
          <div style="font-size:10px;color:var(--text-muted);font-weight:600">TOTAL</div>
          <div style="font-size:18px;font-weight:800;color:${selectedVenue === 'total' ? color : 'var(--text-secondary)'}">${avgTotal.toFixed(2)}</div>
        </div>
        ${avgCasa !== null ? `
        <div style="text-align:center;flex:1;min-width:60px">
          <div style="font-size:10px;color:var(--text-muted);font-weight:600">🏠 CASA</div>
          <div style="font-size:18px;font-weight:800;color:${selectedVenue === 'casa' ? color : 'var(--text-secondary)'}">${avgCasa.toFixed(2)}</div>
        </div>
        ` : ''}
        ${avgFora !== null ? `
        <div style="text-align:center;flex:1;min-width:60px">
          <div style="font-size:10px;color:var(--text-muted);font-weight:600">✈️ FORA</div>
          <div style="font-size:18px;font-weight:800;color:${selectedVenue === 'fora' ? color : 'var(--text-secondary)'}">${avgFora.toFixed(2)}</div>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderRadarChart(keys, s1, s2) {
  if (radarChart) radarChart.destroy();
  const radarKeys = keys.filter(k => (s1[k] || 0) > 0 || (s2[k] || 0) > 0).slice(0, 8);
  if (radarKeys.length < 3) return;
  const ctx = document.getElementById('compare-radar');
  if (!ctx) return;

  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: radarKeys.map(k => getScoutLabel(k)),
      datasets: [
        { label: player1.apelido, data: radarKeys.map(k => s1[k] || 0), backgroundColor: 'rgba(66,165,245,0.2)', borderColor: 'rgba(66,165,245,0.8)', borderWidth: 2, pointBackgroundColor: '#42a5f5', pointRadius: 3 },
        { label: player2.apelido, data: radarKeys.map(k => s2[k] || 0), backgroundColor: 'rgba(0,230,118,0.2)', borderColor: 'rgba(0,230,118,0.8)', borderWidth: 2, pointBackgroundColor: '#00e676', pointRadius: 3 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      scales: { r: { angleLines: { color: 'rgba(255,255,255,0.06)' }, grid: { color: 'rgba(255,255,255,0.06)' }, pointLabels: { color: '#8b95a5', font: { family: 'Inter', size: 10, weight: '500' } }, ticks: { display: false, beginAtZero: true } } },
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8b95a5', font: { family: 'Inter', size: 11, weight: '500' }, padding: 16, usePointStyle: true } },
        tooltip: { backgroundColor: '#1a2234', titleColor: '#f0f4f8', bodyColor: '#8b95a5', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, cornerRadius: 8, padding: 10 },
      },
    },
  });
}

export function destroyCompare() {
  if (radarChart) { radarChart.destroy(); radarChart = null; }
  player1 = null; player2 = null;
  venueFilter1 = 'total'; venueFilter2 = 'total';
}
