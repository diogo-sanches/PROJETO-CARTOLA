// ===== CARTOLA FC STATS - MAIN =====
import './style.css';
import { loadAllData, getData } from './api.js';
import { loadHistory, isHistoryLoaded } from './history.js';
import { renderDashboard, destroyDashboard } from './views/dashboard.js';
import { renderPlayers, destroyPlayers } from './views/players.js';
import { renderTeams, destroyTeams } from './views/teams.js';
import { renderCompare, destroyCompare } from './views/compare.js';
import { renderRecommendations, destroyRecommendations } from './views/recommendations.js';
import { renderPlayerProfile, destroyPlayerProfile } from './views/player-profile.js';
import { renderParciais, destroyParciais } from './views/parciais.js';
import { renderEscalados, destroyEscalados } from './views/escalados.js';

// ===== VIEW CONFIG =====
const VIEWS = {
  dashboard: {
    title: 'Dashboard',
    icon: '🏠',
    render: renderDashboard,
    destroy: destroyDashboard,
  },
  players: {
    title: 'Jogadores',
    icon: '⚽',
    render: renderPlayers,
    destroy: destroyPlayers,
  },
  teams: {
    title: 'Times',
    icon: '🏟️',
    render: renderTeams,
    destroy: destroyTeams,
  },
  compare: {
    title: 'Comparar',
    icon: '⚖️',
    render: renderCompare,
    destroy: destroyCompare,
  },
  recommendations: {
    title: 'Recomendações',
    icon: '💡',
    render: renderRecommendations,
    destroy: destroyRecommendations,
  },
  parciais: {
    title: 'Parciais',
    icon: '📡',
    render: renderParciais,
    destroy: destroyParciais,
  },
  escalados: {
    title: 'Mais Escalados',
    icon: '🔝',
    render: renderEscalados,
    destroy: destroyEscalados,
  },
  'player-profile': {
    title: 'Perfil do Jogador',
    icon: '👤',
    render: (container) => {
      const id = _currentPlayerId;
      if (id) renderPlayerProfile(container, id);
    },
    destroy: destroyPlayerProfile,
    hidden: true, // Not shown in sidebar
  },
};

let currentView = 'dashboard';
let _currentPlayerId = null;

// ===== NAVIGATION =====
function navigateTo(viewName, params = {}) {
  if (!VIEWS[viewName]) return;

  // Destroy current view
  const currentConfig = VIEWS[currentView];
  if (currentConfig && currentConfig.destroy) {
    currentConfig.destroy();
  }

  // Handle player profile params
  if (viewName === 'player-profile' && params.atletaId) {
    _currentPlayerId = params.atletaId;
  }

  // Update sidebar (don't highlight hidden views)
  if (!VIEWS[viewName].hidden) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });
  }

  // Update header
  const view = VIEWS[viewName];
  document.getElementById('header-icon').textContent = view.icon;
  document.getElementById('header-text').textContent = params.playerName || view.title;

  // Render new view
  currentView = viewName;
  const container = document.getElementById('page-content');
  container.innerHTML = ''; // Clear
  view.render(container);

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Expose navigation globally for views
window.__navigateTo = (view, params) => navigateTo(view, params);
window.__openPlayerProfile = (atletaId, playerName) => {
  navigateTo('player-profile', { atletaId, playerName });
};

// ===== MARKET STATUS =====
function updateMarketStatus(market) {
  const isOpen = market.status_mercado === 1;
  const dot = document.getElementById('market-dot');
  const label = document.getElementById('market-label');
  const round = document.getElementById('market-round');

  if (dot) dot.className = `market-status-dot ${isOpen ? '' : 'closed'}`;
  if (label) label.textContent = isOpen ? 'Mercado Aberto' : 'Mercado Fechado';
  if (round) round.textContent = market.nome_rodada || `Rodada ${market.rodada_atual}`;

  // Header badges
  const roundNum = document.getElementById('header-round-num');
  const seasonYear = document.getElementById('header-season-year');
  if (roundNum) roundNum.textContent = market.rodada_atual;
  if (seasonYear) seasonYear.textContent = market.temporada;
}

// ===== HISTORY PROGRESS =====
function showHistoryProgress() {
  const existing = document.getElementById('history-progress');
  if (existing) return;

  const bar = document.createElement('div');
  bar.id = 'history-progress';
  bar.className = 'history-progress-bar';
  bar.innerHTML = `
    <div class="history-progress-inner">
      <span class="history-progress-icon">📊</span>
      <div class="history-progress-text">
        <span id="history-progress-label">Carregando histórico...</span>
        <div class="history-progress-track">
          <div class="history-progress-fill" id="history-progress-fill"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(bar);
}

function updateHistoryProgress(loaded, total) {
  const fill = document.getElementById('history-progress-fill');
  const label = document.getElementById('history-progress-label');
  if (fill) fill.style.width = `${(loaded / total) * 100}%`;
  if (label) label.textContent = `Carregando histórico... Rodada ${loaded}/${total}`;
}

function hideHistoryProgress() {
  const bar = document.getElementById('history-progress');
  if (bar) {
    bar.classList.add('done');
    setTimeout(() => bar.remove(), 1000);
  }
}

// ===== MOBILE MENU =====
function setupMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('visible');
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  });
}

// ===== INIT =====
async function init() {
  const loadingOverlay = document.getElementById('loading-overlay');

  try {
    // Setup navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        navigateTo(item.dataset.view);
      });
    });

    setupMobileMenu();

    // Load current market data (fast)
    const data = await loadAllData();
    
    // Update market status
    updateMarketStatus(data.market);

    // Render initial view
    navigateTo('dashboard');

    // Hide loading screen
    loadingOverlay.classList.add('hidden');
    setTimeout(() => loadingOverlay.remove(), 500);

    // Load historical data in background
    const currentRound = data.market.rodada_atual;
    if (currentRound > 1) {
      showHistoryProgress();
      await loadHistory(currentRound, (loaded, total) => {
        updateHistoryProgress(loaded, total);
      });
      hideHistoryProgress();
      console.log(`✅ Historical data loaded: rounds 1-${currentRound - 1}`);
    }

  } catch (error) {
    console.error('Failed to initialize:', error);
    loadingOverlay.innerHTML = `
      <div style="text-align:center">
        <div style="font-size:48px;margin-bottom:16px">⚠️</div>
        <h2 style="margin-bottom:8px;font-size:18px">Erro ao carregar dados</h2>
        <p style="color:var(--text-secondary);font-size:14px;margin-bottom:20px">${error.message}</p>
        <button class="btn btn-primary" onclick="location.reload()">Tentar novamente</button>
      </div>
    `;
  }
}

// Start the app
init();
