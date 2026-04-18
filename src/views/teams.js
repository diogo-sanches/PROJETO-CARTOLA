// ===== TEAMS VIEW =====
import { getData, getClubAthletes, formatPrice } from '../api.js';
import { isHistoryLoaded, onHistoryLoaded } from '../history.js';
import { calcClubStats } from '../stats.js';
import { Chart, DoughnutController, ArcElement, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

Chart.register(DoughnutController, ArcElement, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

let selectedClub = null;
let chartInstance = null;
let goalsChart = null;

export function renderTeams(container) {
  const data = getData();
  if (!data) return;

  const { clubs } = data;
  const clubList = Object.values(clubs).sort((a, b) => a.nome_fantasia.localeCompare(b.nome_fantasia));

  container.innerHTML = `
    <div class="animate-in">
      <!-- Team Grid -->
      <div class="card" style="margin-bottom:24px">
        <div class="card-header">
          <div class="card-title">🏟️ Selecione um Time</div>
        </div>
        <div class="team-grid" id="team-grid">
          ${clubList.map(c => `
            <div class="team-card" data-club-id="${c.id}" onclick="window.__selectClub(${c.id})" id="team-card-${c.id}">
              <img src="${c.escudos?.['60x60'] || ''}" alt="${c.nome_fantasia}" class="team-card-badge" onerror="this.style.display='none'">
              <div class="team-card-name">${c.nome_fantasia}</div>
              <div class="team-card-abbr">${c.abreviacao}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Team Details -->
      <div id="team-details"></div>
    </div>
  `;

  window.__selectClub = (clubId) => {
    if (selectedClub === clubId) {
      selectedClub = null;
      document.querySelectorAll('.team-card').forEach(c => c.classList.remove('active'));
      document.getElementById('team-details').innerHTML = '';
      return;
    }

    selectedClub = clubId;
    document.querySelectorAll('.team-card').forEach(c => c.classList.remove('active'));
    document.getElementById(`team-card-${clubId}`)?.classList.add('active');
    renderTeamDetails(clubId);
  };
}

function renderTeamDetails(clubId) {
  const data = getData();
  const club = data.clubs[clubId];
  const athletes = getClubAthletes(clubId);

  if (!club) return;

  const activeAthletes = athletes.filter(a => a.jogos_num > 0);
  const probableAthletes = athletes.filter(a => a.status_id === 7);
  const avgMedia = activeAthletes.length > 0 
    ? activeAthletes.reduce((s, a) => s + a.media_num, 0) / activeAthletes.length
    : 0;
  const totalValue = athletes.reduce((s, a) => s + a.preco_num, 0);

  // Group by position
  const byPosition = {};
  [1,2,3,4,5,6].forEach(pos => {
    byPosition[pos] = athletes.filter(a => a.posicao_id === pos);
  });

  const posLabels = ['Goleiro', 'Lateral', 'Zagueiro', 'Meia', 'Atacante', 'Técnico'];
  const posColors = ['#ffd700', '#42a5f5', '#ab47bc', '#00e676', '#ef5350', '#ffa726'];

  // Historical stats
  const clubStats = isHistoryLoaded() ? calcClubStats(clubId) : null;

  const container = document.getElementById('team-details');
  container.innerHTML = `
    <div class="animate-in">
      <!-- Team Header -->
      <div class="card" style="margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:20px;margin-bottom:20px">
          <img src="${club.escudos?.['60x60']}" alt="${club.nome_fantasia}" style="width:60px;height:60px" onerror="this.style.display='none'">
          <div style="flex:1">
            <h3 style="font-size:24px;font-weight:800">${club.nome_fantasia}</h3>
            <p style="color:var(--text-secondary);font-size:14px">${club.apelido} · ${club.abreviacao}</p>
          </div>
          ${clubStats ? `
          <div style="display:flex;gap:4px">
            ${clubStats.forma.map(r => `
              <span style="width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;
                background:${r === 'V' ? 'var(--accent-green-dim)' : r === 'D' ? 'var(--accent-red-dim)' : 'var(--accent-orange-dim)'};
                color:${r === 'V' ? 'var(--accent-green)' : r === 'D' ? 'var(--accent-red)' : 'var(--accent-orange)'}">${r}</span>
            `).join('')}
          </div>
          ` : ''}
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card-icon green">👥</div>
            <div class="stat-card-info">
              <h3>Elenco</h3>
              <div class="stat-value">${athletes.length}</div>
              <div class="stat-detail">${probableAthletes.length} prováveis</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card-icon gold">⭐</div>
            <div class="stat-card-info">
              <h3>Média Geral</h3>
              <div class="stat-value">${avgMedia.toFixed(2)}</div>
              <div class="stat-detail">${activeAthletes.length} atletas ativos</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card-icon blue">💰</div>
            <div class="stat-card-info">
              <h3>Valor Total</h3>
              <div class="stat-value">${formatPrice(totalValue)}</div>
              <div class="stat-detail">do elenco</div>
            </div>
          </div>
          ${clubStats ? `
          <div class="stat-card">
            <div class="stat-card-icon purple">📊</div>
            <div class="stat-card-info">
              <h3>Aproveitamento</h3>
              <div class="stat-value">${clubStats.aproveitamento.toFixed(0)}%</div>
              <div class="stat-detail">${clubStats.vitorias}V ${clubStats.empates}E ${clubStats.derrotas}D</div>
            </div>
          </div>
          ` : ''}
        </div>
      </div>

      ${clubStats ? renderStatsSection(clubStats, club) : `
      <div class="card" style="margin-bottom:20px;text-align:center;padding:30px">
        <div class="loading-spinner" style="margin:0 auto 12px"></div>
        <p style="color:var(--text-secondary);font-size:13px">Carregando estatísticas históricas...</p>
      </div>
      `}

      <div class="grid-2">
        <!-- Position Chart -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">📊 Distribuição por Posição</div>
          </div>
          <div class="chart-container" style="max-height:280px;display:flex;justify-content:center">
            <canvas id="team-position-chart" width="280" height="280"></canvas>
          </div>
        </div>

        <!-- Top Players -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">⭐ Melhores do Time</div>
          </div>
          ${activeAthletes
            .sort((a, b) => b.media_num - a.media_num)
            .slice(0, 6)
            .map((a, i) => `
            <div class="player-list-item">
              <span class="player-list-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i+1}</span>
              <div class="player-list-details">
                <div class="player-name" style="cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\\\'")}')"
                  onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</div>
                <div class="player-full-name">${a.position.nome} · ${a.status.icon} ${a.status.nome}</div>
              </div>
              <span class="position-badge ${a.position.class}">${a.position.abr}</span>
              <span class="player-list-value" style="color:var(--accent-green)">${a.media_num.toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Full Squad Table -->
      <div class="card" style="margin-top:20px">
        <div class="card-header">
          <div class="card-title">📋 Elenco Completo</div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Pos</th>
                <th>Status</th>
                <th>Média</th>
                <th>Pontos</th>
                <th>Preço</th>
                <th>Var.</th>
                <th>Jogos</th>
              </tr>
            </thead>
            <tbody>
              ${athletes
                .sort((a, b) => a.posicao_id - b.posicao_id || b.media_num - a.media_num)
                .map(a => {
                  const varClass = a.variacao_num > 0 ? 'value-positive' : a.variacao_num < 0 ? 'value-negative' : 'value-neutral';
                  return `
                  <tr>
                    <td><span style="font-weight:600;cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\\\'")}')"
                      onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</span></td>
                    <td><span class="position-badge ${a.position.class}">${a.position.abr}</span></td>
                    <td><span class="status-badge ${a.status.class}">${a.status.icon} ${a.status.nome}</span></td>
                    <td style="font-weight:700">${a.media_num.toFixed(2)}</td>
                    <td>${a.pontos_num.toFixed(1)}</td>
                    <td>${formatPrice(a.preco_num)}</td>
                    <td class="${varClass}">${a.variacao_num > 0 ? '+' : ''}${a.variacao_num.toFixed(2)}</td>
                    <td>${a.jogos_num}</td>
                  </tr>
                `}).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Render donut chart
  if (chartInstance) chartInstance.destroy();
  const ctx = document.getElementById('team-position-chart');
  if (ctx) {
    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: posLabels,
        datasets: [{
          data: [1,2,3,4,5,6].map(pos => byPosition[pos]?.length || 0),
          backgroundColor: posColors,
          borderWidth: 0,
          hoverBorderWidth: 2,
          hoverBorderColor: '#fff',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#8b95a5',
              font: { family: 'Inter', size: 11, weight: '500' },
              padding: 12,
              usePointStyle: true,
              pointStyleWidth: 8,
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
            titleFont: { family: 'Inter', weight: '700' },
            bodyFont: { family: 'Inter' },
          },
        },
      },
    });
  }

  // If history not loaded yet, re-render when it's ready
  if (!isHistoryLoaded()) {
    onHistoryLoaded(() => {
      if (selectedClub === clubId) renderTeamDetails(clubId);
    });
  }

  // Render goals bar chart
  if (clubStats) renderGoalsChart(clubStats);
}

function renderStatsSection(stats, club) {
  const pct = (v) => `${(v * 100).toFixed(0)}%`;

  return `
    <!-- GM/GS by Venue -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div class="card-title">⚽ Gols por Mando</div>
        <div class="card-subtitle">Desempenho em Casa vs Fora</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <!-- Home -->
        <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <span style="font-size:18px">🏠</span>
            <span style="font-weight:700;font-size:15px">Em Casa</span>
            <span style="color:var(--text-muted);font-size:12px;margin-left:auto">${stats.jogosCasa} jogos</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">GM</div>
              <div style="font-size:24px;font-weight:800;color:var(--accent-green)">${stats.gmCasa}</div>
              <div style="font-size:12px;color:var(--text-secondary)">${stats.mediaGMCasa.toFixed(2)}/jogo</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">GS</div>
              <div style="font-size:24px;font-weight:800;color:var(--accent-red)">${stats.gsCasa}</div>
              <div style="font-size:12px;color:var(--text-secondary)">${stats.mediaGSCasa.toFixed(2)}/jogo</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">%JCGM</div>
              <div style="font-size:18px;font-weight:700;color:var(--accent-green)">${pct(stats.jcgmCasa)}</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">%JCGS</div>
              <div style="font-size:18px;font-weight:700;color:var(--accent-red)">${pct(stats.jcgsCasa)}</div>
            </div>
          </div>
        </div>
        <!-- Away -->
        <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <span style="font-size:18px">✈️</span>
            <span style="font-weight:700;font-size:15px">Fora</span>
            <span style="color:var(--text-muted);font-size:12px;margin-left:auto">${stats.jogosFora} jogos</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">GM</div>
              <div style="font-size:24px;font-weight:800;color:var(--accent-green)">${stats.gmFora}</div>
              <div style="font-size:12px;color:var(--text-secondary)">${stats.mediaGMFora.toFixed(2)}/jogo</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">GS</div>
              <div style="font-size:24px;font-weight:800;color:var(--accent-red)">${stats.gsFora}</div>
              <div style="font-size:12px;color:var(--text-secondary)">${stats.mediaGSFora.toFixed(2)}/jogo</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">%JCGM</div>
              <div style="font-size:18px;font-weight:700;color:var(--accent-green)">${pct(stats.jcgmFora)}</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">%JCGS</div>
              <div style="font-size:18px;font-weight:700;color:var(--accent-red)">${pct(stats.jcgsFora)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Goals Chart + Results -->
    <div class="grid-2" style="margin-bottom:20px">
      <div class="card">
        <div class="card-header">
          <div class="card-title">📊 Gols por Rodada</div>
        </div>
        <div class="chart-container" style="max-height:260px">
          <canvas id="goals-per-round-chart"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">📅 Resultados</div>
        </div>
        <div style="max-height:260px;overflow-y:auto">
          ${stats.matches.map(m => {
            const resultColor = m.result === 'V' ? 'var(--accent-green)' : m.result === 'D' ? 'var(--accent-red)' : 'var(--accent-orange)';
            const resultBg = m.result === 'V' ? 'var(--accent-green-dim)' : m.result === 'D' ? 'var(--accent-red-dim)' : 'var(--accent-orange-dim)';
            return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-color)">
              <span style="font-size:12px;color:var(--text-muted);width:28px">R${m.round}</span>
              <span style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:${resultBg};color:${resultColor}">${m.result}</span>
              <span style="font-size:13px;font-weight:600;flex:1">${m.goalsFor} × ${m.goalsAgainst}</span>
              <span style="font-size:11px;color:var(--text-muted)">${m.isHome ? '🏠 Casa' : '✈️ Fora'}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderGoalsChart(stats) {
  if (goalsChart) goalsChart.destroy();
  const ctx = document.getElementById('goals-per-round-chart');
  if (!ctx) return;

  goalsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stats.matches.map(m => `R${m.round}`),
      datasets: [
        {
          label: 'Gols Marcados',
          data: stats.matches.map(m => m.goalsFor),
          backgroundColor: 'rgba(0, 230, 118, 0.7)',
          borderRadius: 4,
        },
        {
          label: 'Gols Sofridos',
          data: stats.matches.map(m => m.goalsAgainst),
          backgroundColor: 'rgba(239, 83, 80, 0.7)',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#5a6577', font: { family: 'Inter', size: 10 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#5a6577', font: { family: 'Inter', size: 10 }, stepSize: 1 },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#8b95a5',
            font: { family: 'Inter', size: 11 },
            usePointStyle: true,
            padding: 12,
          },
        },
        tooltip: {
          backgroundColor: '#1a2234',
          titleColor: '#f0f4f8',
          bodyColor: '#8b95a5',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
        },
      },
    },
  });
}

export function destroyTeams() {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  if (goalsChart) { goalsChart.destroy(); goalsChart = null; }
  selectedClub = null;
  delete window.__selectClub;
}
