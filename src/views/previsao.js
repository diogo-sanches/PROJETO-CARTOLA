// ===== PREVISÃO DE GOLS VIEW =====
// Predicts goal outcomes for next round using weighted historical stats
import { getData, fetchMatchesByRound } from '../api.js';
import { isHistoryLoaded, onHistoryLoaded, getClubMatches } from '../history.js';
import { calcClubStats } from '../stats.js';

let _leaguePositions = {}; // clubId -> position number

export async function renderPrevisao(container) {
  const data = getData();
  if (!data) return;

  const { market, clubs } = data;
  const currentRound = market.rodada_atual;

  container.innerHTML = `
    <div class="animate-in">
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">🎯 Previsão de Gols</div>
          <div class="card-subtitle">Análise estatística dos confrontos com peso para jogos recentes</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap">
          <label style="font-size:13px;font-weight:600;color:var(--text-secondary)">Rodada:</label>
          <select id="prev-round-select" class="round-select">
            ${Array.from({ length: market.rodada_final || 38 }, (_, i) => i + 1).map(r =>
              `<option value="${r}" ${r === currentRound ? 'selected' : ''}>Rodada ${r}${r === currentRound ? ' (atual)' : ''}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <div id="prev-content">
        ${isHistoryLoaded() ? '' : `
          <div class="card" style="text-align:center;padding:40px">
            <div class="loading-spinner" style="margin:0 auto 12px"></div>
            <p style="color:var(--text-secondary)">Carregando dados históricos para análise...</p>
          </div>
        `}
      </div>
    </div>
  `;

  document.getElementById('prev-round-select').addEventListener('change', (e) => {
    loadPredictions(parseInt(e.target.value), clubs);
  });

  if (isHistoryLoaded()) {
    await loadPredictions(currentRound, clubs);
  } else {
    onHistoryLoaded(() => loadPredictions(currentRound, clubs));
  }
}

// Build league positions from club stats
function buildLeaguePositions(clubs) {
  const clubIds = Object.keys(clubs).map(Number);
  const standings = clubIds.map(id => {
    const stats = calcClubStats(id);
    return {
      id,
      pts: stats?.pontos || 0,
      sg: (stats?.gmTotal || 0) - (stats?.gsTotal || 0),
      gm: stats?.gmTotal || 0,
    };
  }).sort((a, b) => b.pts - a.pts || b.sg - a.sg || b.gm - a.gm);

  _leaguePositions = {};
  standings.forEach((s, i) => { _leaguePositions[s.id] = i + 1; });
}

// Simple stats: uses straightforward averages (matches what's displayed)
function calcSimpleStats(clubId) {
  const matches = getClubMatches(clubId);
  if (!matches || matches.length === 0) return null;

  const jogos = matches.length;
  const homeMatches = matches.filter(m => m.isHome);
  const awayMatches = matches.filter(m => !m.isHome);
  const jogosCasa = homeMatches.length;
  const jogosFora = awayMatches.length;

  const sum = (arr, fn) => arr.reduce((s, m) => s + fn(m), 0);

  const basicStats = calcClubStats(clubId);
  const forma = basicStats?.forma || [];

  return {
    jogos, jogosCasa, jogosFora,
    // Simple averages (used for both prediction and display)
    avgGM: jogos > 0 ? sum(matches, m => m.goalsFor) / jogos : 0,
    avgGS: jogos > 0 ? sum(matches, m => m.goalsAgainst) / jogos : 0,
    avgGMCasa: jogosCasa > 0 ? sum(homeMatches, m => m.goalsFor) / jogosCasa : 0,
    avgGSCasa: jogosCasa > 0 ? sum(homeMatches, m => m.goalsAgainst) / jogosCasa : 0,
    avgGMFora: jogosFora > 0 ? sum(awayMatches, m => m.goalsFor) / jogosFora : 0,
    avgGSFora: jogosFora > 0 ? sum(awayMatches, m => m.goalsAgainst) / jogosFora : 0,
    // Percentages (jogos com gol)
    pctGM: jogos > 0 ? matches.filter(m => m.goalsFor > 0).length / jogos : 0,
    pctGS: jogos > 0 ? matches.filter(m => m.goalsAgainst > 0).length / jogos : 0,
    pctGMCasa: jogosCasa > 0 ? homeMatches.filter(m => m.goalsFor > 0).length / jogosCasa : 0,
    pctGSCasa: jogosCasa > 0 ? homeMatches.filter(m => m.goalsAgainst > 0).length / jogosCasa : 0,
    pctGMFora: jogosFora > 0 ? awayMatches.filter(m => m.goalsFor > 0).length / jogosFora : 0,
    pctGSFora: jogosFora > 0 ? awayMatches.filter(m => m.goalsAgainst > 0).length / jogosFora : 0,
    forma,
    totalGM: sum(matches, m => m.goalsFor),
    totalGS: sum(matches, m => m.goalsAgainst),
  };
}

async function loadPredictions(round, clubs) {
  const content = document.getElementById('prev-content');
  if (!content) return;

  content.innerHTML = `
    <div style="text-align:center;padding:30px">
      <div class="loading-spinner" style="margin:0 auto 8px"></div>
      <span style="color:var(--text-muted);font-size:12px">Carregando confrontos da Rodada ${round}...</span>
    </div>
  `;

  try {
    const matchData = await fetchMatchesByRound(round);
    const matches = matchData.partidas || [];
    const clubsMap = matchData.clubes || {};

    if (matches.length === 0) {
      content.innerHTML = `<div class="card" style="text-align:center;padding:40px"><p style="color:var(--text-muted)">Nenhum jogo definido para esta rodada</p></div>`;
      return;
    }

    // Build league standings
    buildLeaguePositions(clubs);

    // Compute league-wide averages for Dixon-Coles model (home/away specific)
    const allClubIds = Object.keys(clubs).map(Number);
    let leagueHomeGM = 0, leagueHomeGS = 0, leagueAwayGM = 0, leagueAwayGS = 0;
    let leagueHomeGames = 0, leagueAwayGames = 0;
    allClubIds.forEach(id => {
      const s = calcSimpleStats(id);
      if (!s) return;
      leagueHomeGM += s.avgGMCasa * s.jogosCasa;
      leagueHomeGS += s.avgGSCasa * s.jogosCasa;
      leagueAwayGM += s.avgGMFora * s.jogosFora;
      leagueAwayGS += s.avgGSFora * s.jogosFora;
      leagueHomeGames += s.jogosCasa;
      leagueAwayGames += s.jogosFora;
    });
    const avgHomeGM = leagueHomeGames > 0 ? leagueHomeGM / leagueHomeGames : 1;
    const avgHomeGS = leagueHomeGames > 0 ? leagueHomeGS / leagueHomeGames : 1;
    const avgAwayGM = leagueAwayGames > 0 ? leagueAwayGM / leagueAwayGames : 1;
    const avgAwayGS = leagueAwayGames > 0 ? leagueAwayGS / leagueAwayGames : 1;

    // Build predictions for each match
    const predictions = matches.map(m => {
      const homeId = m.clube_casa_id;
      const awayId = m.clube_visitante_id;
      const homeClub = clubsMap[homeId] || clubs[homeId] || {};
      const awayClub = clubsMap[awayId] || clubs[awayId] || {};

      const homeStats = calcSimpleStats(homeId);
      const awayStats = calcSimpleStats(awayId);

      let predictedHome = 0, predictedAway = 0, totalExpected = 0;
      let confidence = 'low';
      let hasPrediction = false;
      let expHome = 0, expAway = 0;

      if (homeStats && awayStats) {
        // Dixon-Coles with HOME/AWAY specific parameters:
        // Home team goals: home's attack AT HOME × away's defense AWAY
        // Away team goals: away's attack AWAY × home's defense AT HOME
        const homeAttackHome = homeStats.avgGMCasa / Math.max(avgHomeGM, 0.3);
        const awayDefenseAway = awayStats.avgGSFora / Math.max(avgAwayGS, 0.3);
        const awayAttackAway = awayStats.avgGMFora / Math.max(avgAwayGM, 0.3);
        const homeDefenseHome = homeStats.avgGSCasa / Math.max(avgHomeGS, 0.3);

        // λ_home = homeAttack × awayDefense × avgHomeGM (league baseline for home goals)
        // λ_away = awayAttack × homeDefense × avgAwayGM (league baseline for away goals)
        expHome = homeAttackHome * awayDefenseAway * avgHomeGM;
        expAway = awayAttackAway * homeDefenseHome * avgAwayGM;

        predictedHome = Math.round(expHome);
        predictedAway = Math.round(expAway);
        totalExpected = Math.round(expHome + expAway);
        hasPrediction = true;

        const minGames = Math.min(homeStats.jogos, awayStats.jogos);
        confidence = minGames >= 8 ? 'high' : minGames >= 4 ? 'medium' : 'low';
      }

      // Determine SG (saldo de gols) prediction
      const predictedSG_home = predictedHome - predictedAway;
      const predictedSG_away = predictedAway - predictedHome;

      return {
        homeClub, awayClub, homeId, awayId,
        homeStats, awayStats,
        predictedHome, predictedAway, totalExpected,
        expHome, expAway,
        confidence,
        hasPrediction,
        predictedSG_home,
        predictedSG_away,
        homePos: _leaguePositions[homeId] || '?',
        awayPos: _leaguePositions[awayId] || '?',
        isFinished: m.placar_oficial_mandante != null && m.placar_oficial_visitante != null,
        actualHome: m.placar_oficial_mandante,
        actualAway: m.placar_oficial_visitante,
      };
    });

    content.innerHTML = `
      <!-- Summary -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">📊 Resumo da Rodada ${round}</div>
          <div class="card-subtitle">Modelo Dixon-Coles simplificado · Ataque/Defesa relativos à média da liga</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:4px;margin-top:12px;font-size:10px;color:var(--text-muted)">
          <span>🟢 Confiança Alta = 8+ jogos</span>
          <span>🟡 Confiança Média = 4-7 jogos</span>
          <span>🔴 Confiança Baixa = &lt;4 jogos</span>
        </div>
        <div style="display:flex;gap:16px;margin-top:8px;font-size:10px;color:var(--text-muted);flex-wrap:wrap">
          <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--accent-green);border-radius:2px"></span> SG positivo previsto</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--accent-red);border-radius:2px"></span> SG negativo previsto</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--accent-orange);border-radius:2px"></span> Empate previsto</span>
        </div>
      </div>

      <!-- Match Predictions Grid -->
      <div class="previsao-grid">
        ${predictions.map(p => renderPredictionCard(p)).join('')}
      </div>
    `;
  } catch (e) {
    content.innerHTML = `<div class="card" style="text-align:center;padding:30px"><p style="color:var(--accent-red)">Erro: ${e.message}</p></div>`;
  }
}

function renderPredictionCard(p) {
  const pct = (v) => `${(v * 100).toFixed(0)}%`;
  const confColor = p.confidence === 'high' ? 'var(--accent-green)' : p.confidence === 'medium' ? 'var(--accent-orange)' : 'var(--accent-red)';
  const confIcon = p.confidence === 'high' ? '🟢' : p.confidence === 'medium' ? '🟡' : '🔴';
  const confLabel = p.confidence === 'high' ? 'Alta' : p.confidence === 'medium' ? 'Média' : 'Baixa';

  const homeBadge = p.homeClub.escudos?.['45x45'] || p.homeClub.escudos?.['30x30'] || '';
  const awayBadge = p.awayClub.escudos?.['45x45'] || p.awayClub.escudos?.['30x30'] || '';
  const homeName = p.homeClub.nome_fantasia || p.homeClub.nome || '???';
  const awayName = p.awayClub.nome_fantasia || p.awayClub.nome || '???';

  const formBadge = (f) => {
    const bg = f === 'V' ? 'var(--accent-green-dim)' : f === 'D' ? 'var(--accent-red-dim)' : 'var(--accent-orange-dim)';
    const color = f === 'V' ? 'var(--accent-green)' : f === 'D' ? 'var(--accent-red)' : 'var(--accent-orange)';
    return `<span style="width:18px;height:18px;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;background:${bg};color:${color}">${f}</span>`;
  };

  const homeForm = (p.homeStats?.forma || []).slice(-5);
  const awayForm = (p.awayStats?.forma || []).slice(-5);

  // Determine SG highlighting
  let homeSGClass = '', awaySGClass = '', homeSGBorder = '', awaySGBorder = '';
  if (p.hasPrediction) {
    if (p.predictedSG_home > 0) {
      homeSGBorder = 'border-left:4px solid var(--accent-green)';
      awaySGBorder = 'border-right:4px solid var(--accent-red)';
    } else if (p.predictedSG_home < 0) {
      homeSGBorder = 'border-left:4px solid var(--accent-red)';
      awaySGBorder = 'border-right:4px solid var(--accent-green)';
    } else {
      homeSGBorder = 'border-left:4px solid var(--accent-orange)';
      awaySGBorder = 'border-right:4px solid var(--accent-orange)';
    }
  }

  // Display values
  const displayHome = p.hasPrediction ? p.predictedHome : '?';
  const displayAway = p.hasPrediction ? p.predictedAway : '?';
  const displayTotal = p.hasPrediction ? p.totalExpected : '?';

  return `
    <div class="card previsao-card" style="${homeSGBorder};${awaySGBorder}">
      <!-- Header: Team names + predicted score -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="flex:1;text-align:center">
          <img src="${homeBadge}" alt="" style="width:48px;height:48px;display:block;margin:0 auto 6px" onerror="this.style.display='none'">
          <div style="font-weight:700;font-size:14px">${homeName}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">
            🏠 Em Casa · <span style="font-weight:700;color:var(--accent-gold)">${p.homePos}º</span>
          </div>
          <div style="display:flex;gap:2px;justify-content:center;margin-top:4px">${homeForm.map(formBadge).join('')}</div>
        </div>
        <div style="text-align:center;padding:0 12px;min-width:100px">
          ${p.isFinished ? `
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:2px">RESULTADO</div>
            <div style="font-size:28px;font-weight:900">${p.actualHome} x ${p.actualAway}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Previsto: ${displayHome} x ${displayAway}</div>
          ` : `
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:2px">PREVISÃO</div>
            <div style="font-size:32px;font-weight:900;color:var(--accent-gold)">${displayHome} x ${displayAway}</div>
            <div style="font-size:11px;margin-top:4px;color:${confColor};font-weight:600">${confIcon} Confiança ${confLabel}</div>
          `}
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Total esperado: <strong>${displayTotal}</strong> gols</div>
        </div>
        <div style="flex:1;text-align:center">
          <img src="${awayBadge}" alt="" style="width:48px;height:48px;display:block;margin:0 auto 6px" onerror="this.style.display='none'">
          <div style="font-weight:700;font-size:14px">${awayName}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">
            ✈️ Fora · <span style="font-weight:700;color:var(--accent-gold)">${p.awayPos}º</span>
          </div>
          <div style="display:flex;gap:2px;justify-content:center;margin-top:4px">${awayForm.map(formBadge).join('')}</div>
        </div>
      </div>

      ${p.homeStats && p.awayStats ? `
      <!-- Detailed stats comparison -->
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:0;font-size:12px;border-top:1px solid var(--border-color);padding-top:12px">
        ${statRow(p.homeStats.avgGM.toFixed(2), 'Média GM (Total)', p.awayStats.avgGM.toFixed(2), 'higher')}
        ${statRow(p.homeStats.avgGS.toFixed(2), 'Média GS (Total)', p.awayStats.avgGS.toFixed(2), 'lower')}
        ${statRow(p.homeStats.avgGMCasa.toFixed(2), '🏠 GM Casa / ✈️ GM Fora', p.awayStats.avgGMFora.toFixed(2), 'higher')}
        ${statRow(p.homeStats.avgGSCasa.toFixed(2), '🏠 GS Casa / ✈️ GS Fora', p.awayStats.avgGSFora.toFixed(2), 'lower')}
        ${statRow(pct(p.homeStats.pctGM), '%JCGM Total', pct(p.awayStats.pctGM), 'higher')}
        ${statRow(pct(p.homeStats.pctGS), '%JCGS Total', pct(p.awayStats.pctGS), 'lower')}
        ${statRow(pct(p.homeStats.pctGMCasa), '🏠%JCGM / ✈️%JCGM', pct(p.awayStats.pctGMFora), 'higher')}
        ${statRow(pct(p.homeStats.pctGSCasa), '🏠%JCGS / ✈️%JCGS', pct(p.awayStats.pctGSFora), 'lower')}
        ${statRow(p.homeStats.jogos, 'Jogos', p.awayStats.jogos, 'neutral')}
      </div>

      <!-- Narrative insights -->
      <div style="border-top:1px solid var(--border-color);padding-top:10px;margin-top:4px">
        ${buildInsights(p)}
      </div>
      ` : '<p style="color:var(--text-muted);text-align:center;font-size:12px;margin-top:12px">Dados insuficientes para análise</p>'}
    </div>
  `;
}

// Generate analyst-style narrative insights for each match
function buildInsights(p) {
  if (!p.homeStats || !p.awayStats) return '';
  const insights = [];
  const pct = v => `${(v * 100).toFixed(0)}%`;

  // 1. Goal bet — home team attacking at home
  if (p.homeStats.avgGMCasa >= 1.5 && p.homeStats.pctGMCasa >= 0.75) {
    insights.push(`<div style="color:var(--accent-green)">⚽ <b>${p.homeClub.nome_fantasia}</b> marca em ${pct(p.homeStats.pctGMCasa)} dos jogos em casa (${p.homeStats.avgGMCasa.toFixed(2)} gol/jogo)</div>`);
  }
  // 2. Goal bet — away team attacking away
  if (p.awayStats.avgGMFora >= 1.2 && p.awayStats.pctGMFora >= 0.65) {
    insights.push(`<div style="color:var(--accent-green)">⚽ <b>${p.awayClub.nome_fantasia}</b> é visitante que marca: ${pct(p.awayStats.pctGMFora)} dos jogos fora (${p.awayStats.avgGMFora.toFixed(2)} gol/jogo)</div>`);
  }
  // 3. SG bet — home team defending at home
  if (p.homeStats.avgGSCasa <= 0.7) {
    const sgPct = pct(1 - p.homeStats.pctGSCasa);
    insights.push(`<div style="color:var(--accent-blue,#60a5fa)">🛡️ <b>${p.homeClub.nome_fantasia}</b> não sofreu gol em ${sgPct} dos jogos em casa</div>`);
  }
  // 4. SG bet — away team weak offense
  if (p.awayStats.avgGMFora <= 0.5) {
    insights.push(`<div style="color:var(--accent-blue,#60a5fa)">🛡️ <b>${p.awayClub.nome_fantasia}</b> marca apenas ${p.awayStats.avgGMFora.toFixed(2)} gol/jogo fora — favorece SG do mandante</div>`);
  }
  // 5. Warning — strong away attack vs weak home defense
  if (p.awayStats.avgGMFora >= 1.5 && p.homeStats.avgGSCasa >= 1.3) {
    insights.push(`<div style="color:var(--accent-orange)">⚠️ Confronto perigoso: ${p.awayClub.nome_fantasia} ataca bem fora e ${p.homeClub.nome_fantasia} sofre gols em casa</div>`);
  }
  // 6. Low-scoring prediction
  if (p.expHome + p.expAway < 1.5) {
    insights.push(`<div style="color:var(--text-muted)">📉 Jogo com tendência de poucos gols (${(p.expHome + p.expAway).toFixed(1)} total esperado)</div>`);
  }

  if (insights.length === 0) return '<div style="font-size:11px;color:var(--text-muted);text-align:center">Sem destaques adicionais</div>';
  return `<div style="display:flex;flex-direction:column;gap:4px;font-size:11px">${insights.join('')}</div>`;
}

// type: 'higher' = higher is better (GM), 'lower' = lower is better (GS), 'neutral' = no highlight
function statRow(left, label, right, type = 'higher') {
  const leftNum = parseFloat(left);
  const rightNum = parseFloat(right);
  let leftStyle = 'color:var(--text-secondary)';
  let rightStyle = 'color:var(--text-secondary)';

  if (type !== 'neutral' && !isNaN(leftNum) && !isNaN(rightNum) && leftNum !== rightNum) {
    if (type === 'higher') {
      // Higher is better (GM, %JCGM)
      if (leftNum > rightNum) { leftStyle = 'color:var(--accent-green);font-weight:700'; rightStyle = 'color:var(--accent-red);font-weight:600'; }
      else { rightStyle = 'color:var(--accent-green);font-weight:700'; leftStyle = 'color:var(--accent-red);font-weight:600'; }
    } else {
      // Lower is better (GS, %JCGS)
      if (leftNum < rightNum) { leftStyle = 'color:var(--accent-green);font-weight:700'; rightStyle = 'color:var(--accent-red);font-weight:600'; }
      else { rightStyle = 'color:var(--accent-green);font-weight:700'; leftStyle = 'color:var(--accent-red);font-weight:600'; }
    }
  }

  return `
    <div style="text-align:right;padding:5px 10px;${leftStyle}">${left}</div>
    <div style="text-align:center;padding:5px 8px;color:var(--text-muted);font-size:10px;white-space:nowrap;border-left:1px solid var(--border-color);border-right:1px solid var(--border-color)">${label}</div>
    <div style="text-align:left;padding:5px 10px;${rightStyle}">${right}</div>
  `;
}

export function destroyPrevisao() {}
