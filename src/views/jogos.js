// ===== JOGOS DA RODADA VIEW =====
import { fetchMatchesByRound, getData } from '../api.js';

let _currentRound = null;

export async function renderJogos(container) {
  const data = getData();
  if (!data) return;

  const { market } = data;
  _currentRound = market.rodada_atual;
  const totalRounds = market.rodada_final || 38;

  container.innerHTML = `
    <div class="animate-in">
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">🏟️ Jogos da Rodada</div>
          <div class="card-subtitle">Selecione a rodada para ver os jogos</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap">
          <label style="font-size:13px;font-weight:600;color:var(--text-secondary)">Rodada:</label>
          <select id="jogos-round-select" class="round-select">
            ${Array.from({ length: totalRounds }, (_, i) => i + 1).map(r => 
              `<option value="${r}" ${r === _currentRound ? 'selected' : ''}>Rodada ${r}${r === _currentRound ? ' (atual)' : r > _currentRound ? ' (futura)' : ''}</option>`
            ).join('')}
          </select>
          <button class="pos-btn active" id="jogos-go-current" style="font-size:12px;padding:6px 14px">🔄 Atual (R.${_currentRound})</button>
        </div>
      </div>

      <div id="jogos-content">
        <div style="text-align:center;padding:30px">
          <div class="loading-spinner" style="margin:0 auto 8px"></div>
          <span style="color:var(--text-muted);font-size:12px">Carregando jogos...</span>
        </div>
      </div>
    </div>
  `;

  // Bind events
  document.getElementById('jogos-round-select').addEventListener('change', (e) => {
    loadRound(parseInt(e.target.value));
  });

  document.getElementById('jogos-go-current').addEventListener('click', () => {
    document.getElementById('jogos-round-select').value = _currentRound;
    loadRound(_currentRound);
  });

  await loadRound(_currentRound);
}

async function loadRound(round) {
  const content = document.getElementById('jogos-content');
  if (!content) return;

  content.innerHTML = `
    <div style="text-align:center;padding:30px">
      <div class="loading-spinner" style="margin:0 auto 8px"></div>
      <span style="color:var(--text-muted);font-size:12px">Carregando Rodada ${round}...</span>
    </div>
  `;

  try {
    const matchData = await fetchMatchesByRound(round);
    const matches = matchData.partidas || [];
    const clubsMap = matchData.clubes || {};

    if (matches.length === 0) {
      content.innerHTML = `
        <div class="card" style="text-align:center;padding:40px">
          <div style="font-size:48px;margin-bottom:12px">📅</div>
          <h3 style="font-size:16px;margin-bottom:8px">Rodada ${round}</h3>
          <p style="color:var(--text-muted)">Jogos ainda não definidos para esta rodada</p>
        </div>
      `;
      return;
    }

    // Group by date
    const byDate = {};
    matches.forEach(m => {
      const dateKey = m.partida_data ? m.partida_data.split(' ')[0] : 'Sem data';
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(m);
    });

    // Stats summary
    const finished = matches.filter(m => m.periodo_tr === 'POS_JOGO').length;
    const live = matches.filter(m => m.periodo_tr === 'JOGO' || m.status_transmissao_tr === 'EM_ANDAMENTO').length;
    const pending = matches.length - finished - live;
    const totalGoals = matches.reduce((s, m) => s + (m.placar_oficial_mandante || 0) + (m.placar_oficial_visitante || 0), 0);

    content.innerHTML = `
      <!-- Round Summary -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">📊 Resumo da Rodada ${round}</div>
        </div>
        <div class="stats-grid" style="margin-top:12px">
          <div class="stat-card">
            <div class="stat-card-icon green">⚽</div>
            <div class="stat-card-info">
              <h3>Total de Jogos</h3>
              <div class="stat-value">${matches.length}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card-icon blue">✅</div>
            <div class="stat-card-info">
              <h3>Encerrados</h3>
              <div class="stat-value">${finished}</div>
            </div>
          </div>
          ${live > 0 ? `
          <div class="stat-card">
            <div class="stat-card-icon" style="background:var(--accent-red-dim);color:var(--accent-red)">🔴</div>
            <div class="stat-card-info">
              <h3>Ao Vivo</h3>
              <div class="stat-value">${live}</div>
            </div>
          </div>` : `
          <div class="stat-card">
            <div class="stat-card-icon purple">⏳</div>
            <div class="stat-card-info">
              <h3>A Jogar</h3>
              <div class="stat-value">${pending}</div>
            </div>
          </div>`}
          <div class="stat-card">
            <div class="stat-card-icon gold">🥅</div>
            <div class="stat-card-info">
              <h3>Gols</h3>
              <div class="stat-value">${totalGoals}</div>
              <div class="stat-detail">${finished > 0 ? (totalGoals / finished).toFixed(1) + '/jogo' : '-'}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Matches by Date -->
      ${Object.entries(byDate).map(([dateKey, dateMatches]) => {
        const dateObj = new Date(dateKey + 'T12:00:00');
        const dateLabel = !isNaN(dateObj) ? dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : dateKey;
        
        return `
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div class="card-title">📅 ${dateLabel}</div>
            <div class="card-subtitle">${dateMatches.length} jogo${dateMatches.length > 1 ? 's' : ''}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">
            ${dateMatches.map(m => {
              const home = clubsMap[m.clube_casa_id];
              const away = clubsMap[m.clube_visitante_id];
              const homeName = home?.nome_fantasia || home?.nome || '???';
              const awayName = away?.nome_fantasia || away?.nome || '???';
              const homeBadge = home?.escudos?.['45x45'] || home?.escudos?.['30x30'] || '';
              const awayBadge = away?.escudos?.['45x45'] || away?.escudos?.['30x30'] || '';
              
              const isLive = m.periodo_tr === 'JOGO' || m.status_transmissao_tr === 'EM_ANDAMENTO';
              const isFinished = m.periodo_tr === 'POS_JOGO';
              const isPending = !isLive && !isFinished;
              
              const statusLabel = isLive ? '🔴 AO VIVO' : isFinished ? '✅ Encerrado' : '⏳ Aguardando';
              const statusColor = isLive ? 'var(--accent-red)' : isFinished ? 'var(--accent-green)' : 'var(--text-muted)';
              
              const time = m.partida_data ? m.partida_data.split(' ')[1]?.substring(0, 5) : '';

              // Form
              const homeForm = (m.aproveitamento_mandante || []).slice(-5);
              const awayForm = (m.aproveitamento_visitante || []).slice(-5);

              const formBadge = (f) => {
                const bg = f === 'v' ? 'var(--accent-green-dim)' : f === 'd' ? 'var(--accent-red-dim)' : 'var(--accent-orange-dim)';
                const color = f === 'v' ? 'var(--accent-green)' : f === 'd' ? 'var(--accent-red)' : 'var(--accent-orange)';
                return `<span style="width:16px;height:16px;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;background:${bg};color:${color}">${f.toUpperCase()}</span>`;
              };

              return `
              <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:16px;border:1px solid var(--border-color);${isLive ? 'border-color:var(--accent-red);box-shadow:0 0 12px rgba(239,83,80,0.15)' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                  <span style="font-size:11px;color:${statusColor};font-weight:700">${statusLabel}</span>
                  <span style="font-size:11px;color:var(--text-muted)">${time} · ${m.local || ''}</span>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <div style="flex:1;text-align:center">
                    <img src="${homeBadge}" alt="" style="width:40px;height:40px;display:block;margin:0 auto 6px" onerror="this.style.display='none'">
                    <div style="font-weight:700;font-size:14px">${homeName}</div>
                    <div style="display:flex;gap:2px;justify-content:center;margin-top:4px">${homeForm.map(formBadge).join('')}</div>
                  </div>
                  <div style="padding:0 20px;text-align:center">
                    <div style="font-size:32px;font-weight:900;letter-spacing:2px;color:${isLive ? 'var(--accent-red)' : 'var(--text-primary)'}">
                      ${isPending ? 'vs' : `${m.placar_oficial_mandante ?? '-'} x ${m.placar_oficial_visitante ?? '-'}`}
                    </div>
                  </div>
                  <div style="flex:1;text-align:center">
                    <img src="${awayBadge}" alt="" style="width:40px;height:40px;display:block;margin:0 auto 6px" onerror="this.style.display='none'">
                    <div style="font-weight:700;font-size:14px">${awayName}</div>
                    <div style="display:flex;gap:2px;justify-content:center;margin-top:4px">${awayForm.map(formBadge).join('')}</div>
                  </div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }).join('')}
    `;
  } catch (e) {
    content.innerHTML = `
      <div class="card" style="text-align:center;padding:30px">
        <p style="color:var(--accent-red);font-weight:600">Erro ao carregar rodada ${round}</p>
        <p style="color:var(--text-muted);font-size:12px;margin-top:4px">${e.message}</p>
      </div>
    `;
  }
}

export function destroyJogos() {}
