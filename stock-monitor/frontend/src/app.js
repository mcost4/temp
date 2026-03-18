// Configuração
const API_BASE_URL = 'http://localhost:8000/api';
let autoRefreshInterval = null;
let clocksInterval = null;
const AUTO_REFRESH_BASE_MS = 5000;
const AUTO_REFRESH_MAX_MS = 60000;
let autoRefreshDelayMs = AUTO_REFRESH_BASE_MS;
let isRefreshing = false;
let hasRenderedStocks = false;
const NO_TICK_WARNING_SECONDS = 15;
const PRICE_CHANGE_EPSILON = 0.0001;
const PRICE_FLASH_DURATION_MS = 2500;
const stockTickState = {};
const DY_SOURCE_KEY = 'dySource';
const THEME_STORAGE_KEY = 'themeMode';
const DEFAULT_DY_SOURCE = 'yahoo_finance';
const DEFAULT_THEME = 'neon';
const ASSET_GRID_INITIAL_TICKERS = ['NVDA', 'GE', 'CVX', 'CCJ', 'SQM'];
const ASSET_GRID_SORT_DEFAULT = { key: 'company_name', direction: 'asc' };
let assetGridSort = { ...ASSET_GRID_SORT_DEFAULT };
let latestAssetGridPayload = null;
const LOCAL_DY_SOURCE_LABELS = {
    alpha_vantage: 'Alpha Vantage',
    finnhub: 'Finnhub',
    yahoo_finance: 'Yahoo Finance'
};
let dySourceLabels = { ...LOCAL_DY_SOURCE_LABELS };
const PRICE_SOURCE_LABELS = {
    alpha_vantage: 'Alpha Vantage',
    finnhub: 'Finnhub',
    yahoo_finance: 'Yahoo Finance',
    mock_data: 'Dados de exemplo'
};
const STATUS_LABELS = {
    success: 'Tempo real',
    fallback_realtime: 'Tempo real (fallback)',
    mock_data: 'Fallback',
    fallback_metadata: 'Fallback metadata'
};

// Carregar API Key do localStorage
window.addEventListener('DOMContentLoaded', async () => {
    await loadDySources();

    const savedDySource = localStorage.getItem(DY_SOURCE_KEY);
    const sourceSelect = document.getElementById('dySource');
    sourceSelect.value = normalizeDySource(savedDySource);

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const themeSelect = document.getElementById('themeMode');
    if (themeSelect) {
        themeSelect.value = normalizeTheme(savedTheme);
    }
    applyTheme(normalizeTheme(savedTheme));

    setAutoRefreshVisualState(true);
    startAutoRefresh();

    startClocks();
    refreshData();
});

function setAutoRefreshVisualState(isActive) {
    document.body.classList.toggle('auto-refresh-active', isActive);
}

function normalizeTheme(theme) {
    if (theme === 'editorial' || theme === 'midnight') {
        return theme;
    }

    return DEFAULT_THEME;
}

function applyTheme(theme) {
    document.body.setAttribute('data-theme', normalizeTheme(theme));
}

function changeTheme() {
    const themeSelect = document.getElementById('themeMode');
    const theme = normalizeTheme(themeSelect ? themeSelect.value : DEFAULT_THEME);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(theme);
}

function formatClockTime(timeZone) {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(new Date());
}

function updateClocks() {
    const brasiliaEl = document.getElementById('clockBrasilia');
    const newYorkEl = document.getElementById('clockNewYork');

    if (brasiliaEl) {
        brasiliaEl.textContent = `Brasilia: ${formatClockTime('America/Sao_Paulo')}`;
    }

    if (newYorkEl) {
        newYorkEl.textContent = `Nova York: ${formatClockTime('America/New_York')}`;
    }
}

function startClocks() {
    updateClocks();
    if (clocksInterval) {
        clearInterval(clocksInterval);
    }
    clocksInterval = setInterval(updateClocks, 1000);
}

function normalizeDySource(source) {
    if (source && dySourceLabels[source]) {
        return source;
    }
    return DEFAULT_DY_SOURCE;
}

async function loadDySources() {
    const sourceSelect = document.getElementById('dySource');

    try {
        const response = await fetch(`${API_BASE_URL}/dy-sources`);
        if (!response.ok) throw new Error('Falha ao carregar fontes de DY');

        const payload = await response.json();
        const sources = Array.isArray(payload.sources) ? payload.sources : [];
        const defaultSource = typeof payload.default_source === 'string'
            ? payload.default_source
            : DEFAULT_DY_SOURCE;

        if (sources.length > 0) {
            dySourceLabels = {};
            sourceSelect.innerHTML = '';

            sources.forEach((source) => {
                if (!source || !source.value || !source.label) return;

                dySourceLabels[source.value] = source.label;
                const option = document.createElement('option');
                option.value = source.value;
                option.textContent = source.value === defaultSource
                    ? `DY via ${source.label} (padrão)`
                    : `DY via ${source.label}`;
                sourceSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.warn('Usando fontes de DY locais (fallback):', error);
        dySourceLabels = { ...LOCAL_DY_SOURCE_LABELS };
    }
}

function getSelectedDySource() {
    const sourceSelect = document.getElementById('dySource');
    return normalizeDySource(sourceSelect ? sourceSelect.value : DEFAULT_DY_SOURCE);
}

function changeDySource() {
    const dySource = getSelectedDySource();
    localStorage.setItem(DY_SOURCE_KEY, dySource);
    updateFooterDataSource(dySourceLabels[dySource] || dySourceLabels[DEFAULT_DY_SOURCE]);
    refreshData();
}

function updateFooterDataSource(sourceLabel) {
    const footerEl = document.getElementById('footerDataSource');
    if (!footerEl) return;
    footerEl.textContent = `Dados fornecidos por APIs de mercado | DY: ${sourceLabel}`;
}

// Auto-atualização sempre ativa
function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    autoRefreshInterval = setInterval(() => {
        refreshData();
    }, autoRefreshDelayMs);
}

// Função principal de atualização
async function refreshData() {
    if (isRefreshing) {
        return;
    }

    isRefreshing = true;
    const container = document.getElementById('stocksContainer');
    const selectedDySource = getSelectedDySource();
    const selectedDySourceLabel = dySourceLabels[selectedDySource] || dySourceLabels[DEFAULT_DY_SOURCE];
    updateFooterDataSource(selectedDySourceLabel);
    
    try {
        if (!hasRenderedStocks) {
            container.innerHTML = '<div class="loading">⏳ Carregando dados...</div>';
        }
        
        // Tentar conectar ao servidor, se falhar usar URL alternativa ou dados de exemplo
        let data;
        let assetGridData;
        try {
            const response = await fetch(`${API_BASE_URL}/stocks?dy_source=${encodeURIComponent(selectedDySource)}`);
            if (!response.ok) throw new Error('Erro na API');
            data = await response.json();

            const assetGridResponse = await fetch(
                `${API_BASE_URL}/asset-grid?tickers=${encodeURIComponent(ASSET_GRID_INITIAL_TICKERS.join(','))}`
            );
            if (!assetGridResponse.ok) throw new Error('Erro na API da grade de ativos');
            assetGridData = await assetGridResponse.json();

            const responseDySource = normalizeDySource(data.dy_source || selectedDySource);
            const responseDySourceLabel = dySourceLabels[responseDySource] || selectedDySourceLabel;
            updateFooterDataSource(responseDySourceLabel);
            autoRefreshDelayMs = AUTO_REFRESH_BASE_MS;
            startAutoRefresh();
        } catch (apiError) {
            console.warn('API não disponível, usando dados de exemplo:', apiError);
            data = getMockData();
            assetGridData = getMockAssetGridData();
            updateFooterDataSource(selectedDySourceLabel);

            autoRefreshDelayMs = Math.min(autoRefreshDelayMs * 2, AUTO_REFRESH_MAX_MS);
            startAutoRefresh();
        }
        
        renderStocks(data.stocks);
        updateLastUpdate(data.last_update);
        latestAssetGridPayload = assetGridData;
        renderAssetGrid(assetGridData);
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        container.innerHTML = `
            <div class="error">
                ❌ Erro ao carregar dados. Verifique se o servidor está rodando em http://localhost:8000
                <br><br>
                <small>Para testes, acesse: <a href="http://localhost:8000/docs" target="_blank">http://localhost:8000/docs</a></small>
            </div>
        `;
    } finally {
        isRefreshing = false;
    }
}

function formatGridPercent(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return 'N/D';
    }

    const numeric = Number(value);
    const sign = numeric > 0 ? '+' : '';
    return `${sign}${numeric.toFixed(2)}%`;
}

function formatGridDy(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return 'N/D';
    }

    return `${Number(value).toFixed(2)}%`;
}

function setAssetGridSort(key) {
    if (assetGridSort.key === key) {
        assetGridSort.direction = assetGridSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        assetGridSort = { key, direction: 'asc' };
    }

    if (latestAssetGridPayload) {
        renderAssetGrid(latestAssetGridPayload);
    }
}

function getAssetGridSortIndicator(key) {
    if (assetGridSort.key !== key) {
        return '↕';
    }
    return assetGridSort.direction === 'asc' ? '↑' : '↓';
}

function getAssetGridSortValue(item, key) {
    if (key === 'company_name') {
        return `${item.company_name || ''} (${item.ticker || ''})`.toLowerCase();
    }
    return item[key];
}

function sortAssetGridItems(items) {
    const sorted = [...items];
    const { key, direction } = assetGridSort;

    sorted.sort((a, b) => {
        const va = getAssetGridSortValue(a, key);
        const vb = getAssetGridSortValue(b, key);

        const aMissing = va === null || va === undefined || va === '' || Number.isNaN(Number(va));
        const bMissing = vb === null || vb === undefined || vb === '' || Number.isNaN(Number(vb));

        if (aMissing && bMissing) return 0;
        if (aMissing) return 1;
        if (bMissing) return -1;

        let comparison = 0;
        if (typeof va === 'string' || typeof vb === 'string') {
            comparison = String(va).localeCompare(String(vb), 'pt-BR');
        } else {
            comparison = Number(va) - Number(vb);
        }

        return direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
}

function getGridTrendClass(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return 'neutral';
    }

    return Number(value) >= 0 ? 'positive' : 'negative';
}

function renderAssetGrid(payload) {
    const container = document.getElementById('assetGridContainer');
    if (!container) return;

    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (!items.length) {
        container.innerHTML = '<div class="error">Nenhum dado disponível para a Grade de Ativos.</div>';
        return;
    }

    const sortedItems = sortAssetGridItems(items);

    const rowsHtml = sortedItems.map((item) => {
        const currentPrice = item.current_price === null || item.current_price === undefined
            ? 'N/D'
            : `$${Number(item.current_price).toFixed(2)}`;

        return `
            <tr>
                <td>${item.company_name || item.ticker} (${item.ticker})</td>
                <td>${currentPrice}</td>
                <td class="grid-change ${getGridTrendClass(item.dy)}">${formatGridDy(item.dy)}</td>
                <td class="grid-change ${getGridTrendClass(item.day_change_pct)}">${formatGridPercent(item.day_change_pct)}</td>
                <td class="grid-change ${getGridTrendClass(item.month_change_pct)}">${formatGridPercent(item.month_change_pct)}</td>
                <td class="grid-change ${getGridTrendClass(item.ytd_change_pct)}">${formatGridPercent(item.ytd_change_pct)}</td>
                <td class="grid-change ${getGridTrendClass(item.trailing_12m_change_pct)}">${formatGridPercent(item.trailing_12m_change_pct)}</td>
                <td class="grid-change ${getGridTrendClass(item.trailing_5y_change_pct)}">${formatGridPercent(item.trailing_5y_change_pct)}</td>
                <td class="grid-change ${getGridTrendClass(item.trailing_5y_value_pct)}">${formatGridPercent(item.trailing_5y_value_pct)}</td>
                <td class="grid-change ${getGridTrendClass(item.trailing_10y_change_pct)}">${formatGridPercent(item.trailing_10y_change_pct)}</td>
                <td class="grid-change ${getGridTrendClass(item.trailing_10y_value_pct)}">${formatGridPercent(item.trailing_10y_value_pct)}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <table class="asset-grid-table" aria-label="Grade de ativos">
            <thead>
                <tr>
                    <th><button type="button" class="asset-grid-sort-btn" onclick="setAssetGridSort('company_name')">Ativo <span>${getAssetGridSortIndicator('company_name')}</span></button></th>
                    <th><button type="button" class="asset-grid-sort-btn" onclick="setAssetGridSort('current_price')">Preço <span>${getAssetGridSortIndicator('current_price')}</span></button></th>
                    <th><button type="button" class="asset-grid-sort-btn" onclick="setAssetGridSort('dy')">DY <span>${getAssetGridSortIndicator('dy')}</span></button></th>
                    <th><button type="button" class="asset-grid-sort-btn" onclick="setAssetGridSort('day_change_pct')">Dia <span>${getAssetGridSortIndicator('day_change_pct')}</span></button></th>
                    <th><button type="button" class="asset-grid-sort-btn" onclick="setAssetGridSort('month_change_pct')">Mês <span>${getAssetGridSortIndicator('month_change_pct')}</span></button></th>
                    <th><button type="button" class="asset-grid-sort-btn" onclick="setAssetGridSort('ytd_change_pct')">Ano Atual <span>${getAssetGridSortIndicator('ytd_change_pct')}</span></button></th>
                    <th><button type="button" class="asset-grid-sort-btn" onclick="setAssetGridSort('trailing_12m_change_pct')">Últimos 12 Meses <span>${getAssetGridSortIndicator('trailing_12m_change_pct')}</span></button></th>
                    <th><button type="button" class="asset-grid-sort-btn" onclick="setAssetGridSort('trailing_5y_change_pct')">Rendimento dos últimos 5 anos USD <span>${getAssetGridSortIndicator('trailing_5y_change_pct')}</span></button></th>
                    <th><button type="button" class="asset-grid-sort-btn" onclick="setAssetGridSort('trailing_5y_value_pct')">Rendimento dos últimos 5 anos BRL <span>${getAssetGridSortIndicator('trailing_5y_value_pct')}</span></button></th>
                    <th><button type="button" class="asset-grid-sort-btn" onclick="setAssetGridSort('trailing_10y_change_pct')">Rendimento dos últimos 10 anos USD <span>${getAssetGridSortIndicator('trailing_10y_change_pct')}</span></button></th>
                    <th><button type="button" class="asset-grid-sort-btn" onclick="setAssetGridSort('trailing_10y_value_pct')">Rendimento dos últimos 10 anos BRL <span>${getAssetGridSortIndicator('trailing_10y_value_pct')}</span></button></th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    `;
}

// Renderizar cards de ações
function renderStocks(stocks) {
    const container = document.getElementById('stocksContainer');
    
    if (!stocks || stocks.length === 0) {
        container.innerHTML = '<div class="error">Nenhuma ação para exibir</div>';
        return;
    }
    
    const enrichedStocks = stocks.map((stock) => enrichStockWithTickState(stock));

    if (!hasRenderedStocks) {
        container.innerHTML = enrichedStocks.map(stock => createStockCard(stock)).join('');
        hasRenderedStocks = true;
        return;
    }

    updateStockCards(container, enrichedStocks);
}

function updateStockCards(container, stocks) {
    const existingCards = new Map(
        Array.from(container.querySelectorAll('.stock-card[data-ticker]'))
            .map((card) => [card.getAttribute('data-ticker'), card])
    );

    stocks.forEach((stock) => {
        const ticker = stock.ticker;
        let card = existingCards.get(ticker);

        if (!card) {
            container.insertAdjacentHTML('beforeend', createStockCard(stock));
            return;
        }

        const isPositive = stock.variation_percent >= 0;
        const variationClass = isPositive ? 'positive' : 'negative';
        const variationIcon = isPositive ? '📈' : '📉';

        card.classList.remove('positive', 'negative');
        card.classList.add(variationClass);

        const tickerEl = card.querySelector('[data-role="ticker"]');
        const companyEl = card.querySelector('[data-role="company"]');
        const priceEl = card.querySelector('[data-role="price-value"]');
        const variationWrapEl = card.querySelector('[data-role="variation-wrap"]');
        const variationIconEl = card.querySelector('[data-role="variation-icon"]');
        const variationValueEl = card.querySelector('[data-role="variation-value"]');

        if (tickerEl) tickerEl.textContent = stock.ticker;
        if (companyEl) companyEl.textContent = stock.company_name || stock.ticker;
        if (priceEl) {
            priceEl.textContent = `$${stock.price.toFixed(2)}`;
            applyFlashClass(priceEl, stock._ui?.priceFlashClass || '');
        }

        if (variationWrapEl) {
            variationWrapEl.classList.remove('positive', 'negative');
            variationWrapEl.classList.add(variationClass);
        }
        if (variationIconEl) variationIconEl.textContent = variationIcon;
        if (variationValueEl) {
            variationValueEl.textContent = `${stock.variation_percent > 0 ? '+' : ''}${stock.variation_percent.toFixed(2)}%`;
            applyFlashClass(variationValueEl, stock._ui?.variationFlashClass || '');
        }
    });
}

function applyFlashClass(element, flashClass) {
    if (!element) return;

    element.classList.remove('flash-number-up', 'flash-number-down');
    if (!flashClass) {
        return;
    }

    void element.offsetWidth;
    element.classList.add(flashClass);
}

function getCompanyLogoUrl(ticker) {
    const logoOverrides = {
        PANW: 'https://www.paloaltonetworks.com/etc/clientlibs/clean/imgs/pan-logo-dark.svg'
    };

    if (logoOverrides[ticker]) {
        return logoOverrides[ticker];
    }

    const logoMap = {
        NVDA: 'nvidia.com',
        GE: 'ge.com',
        CVX: 'chevron.com',
        CCJ: 'cameco.com',
        SQM: 'sqm.com',
        PLTR: 'palantir.com',
        MARA: 'mara.com',
        LLY: 'lilly.com',
        WMT: 'walmart.com',
        FTNT: 'fortinet.com',
        PANW: 'paloaltonetworks.com',
        CRWD: 'crowdstrike.com',
        ZS: 'zscaler.com',
        CHKP: 'checkpoint.com'
    };

    const domain = logoMap[ticker];
    if (!domain) {
        return '';
    }

    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

function parseTimestampToMillis(timestamp) {
    if (!timestamp) {
        return null;
    }

    if (typeof timestamp === 'number' || /^\d+$/.test(String(timestamp))) {
        const numericValue = Number(timestamp);
        if (Number.isNaN(numericValue)) {
            return null;
        }
        return numericValue < 1e12 ? numericValue * 1000 : numericValue;
    }

    const parsedMillis = Date.parse(String(timestamp));
    return Number.isNaN(parsedMillis) ? null : parsedMillis;
}

function formatStockTimestamp(timestamp) {
    if (!timestamp) {
        return 'Sem horário';
    }

    let date;
    if (typeof timestamp === 'number' || /^\d+$/.test(String(timestamp))) {
        const numericValue = Number(timestamp);
        if (Number.isNaN(numericValue)) {
            return 'Sem horário';
        }
        // Epoch de 10 dígitos vem em segundos.
        const millis = numericValue < 1e12 ? numericValue * 1000 : numericValue;
        date = new Date(millis);
    } else {
        date = new Date(timestamp);
    }

    if (Number.isNaN(date.getTime())) {
        return 'Sem horário';
    }

    const datePart = date.toLocaleDateString('pt-BR');
    const timePart = date.toLocaleTimeString('pt-BR');
    return `${datePart} ${timePart}`;
}

function enrichStockWithTickState(stock) {
    const now = Date.now();
    const ticker = stock.ticker;
    const sourceTimestampMs = parseTimestampToMillis(stock.timestamp);
    const currentPrice = Number(stock.price);

    const state = stockTickState[ticker] || {
        lastPrice: null,
        lastVariationPercent: null,
        lastTickSeenAtMs: now,
        priceFlashClass: '',
        priceFlashUntilMs: 0,
        variationFlashClass: '',
        variationFlashUntilMs: 0
    };

    const currentVariationPercent = Number(stock.variation_percent);
    const hasPriceChanged = state.lastPrice !== null
        && Math.abs(currentPrice - state.lastPrice) > PRICE_CHANGE_EPSILON;
    const hasVariationChanged = state.lastVariationPercent !== null
        && Math.abs(currentVariationPercent - state.lastVariationPercent) > PRICE_CHANGE_EPSILON;

    if (state.lastPrice === null) {
        state.lastPrice = currentPrice;
        state.lastVariationPercent = currentVariationPercent;
        state.lastTickSeenAtMs = now;
    }

    if (hasPriceChanged) {
        const priceDelta = currentPrice - state.lastPrice;
        state.lastPrice = currentPrice;
        state.lastTickSeenAtMs = now;
        state.priceFlashClass = priceDelta >= 0 ? 'flash-number-up' : 'flash-number-down';
        state.priceFlashUntilMs = now + PRICE_FLASH_DURATION_MS;
    }

    if (hasVariationChanged) {
        const variationDelta = currentVariationPercent - state.lastVariationPercent;
        state.lastVariationPercent = currentVariationPercent;
        state.variationFlashClass = variationDelta >= 0 ? 'flash-number-up' : 'flash-number-down';
        state.variationFlashUntilMs = now + PRICE_FLASH_DURATION_MS;
    }

    if (sourceTimestampMs !== null) {
        if (!state.lastSourceTimestampMs || sourceTimestampMs > state.lastSourceTimestampMs) {
            state.lastSourceTimestampMs = sourceTimestampMs;
            state.lastTickSeenAtMs = now;
        }
    }

    const noTickSeconds = Math.max(0, Math.floor((now - state.lastTickSeenAtMs) / 1000));
    const sourceAgeSeconds = sourceTimestampMs !== null
        ? Math.max(0, Math.floor((now - sourceTimestampMs) / 1000))
        : null;
    const priceFlashClass = state.priceFlashUntilMs > now ? state.priceFlashClass : '';
    const variationFlashClass = state.variationFlashUntilMs > now ? state.variationFlashClass : '';

    stockTickState[ticker] = state;

    return {
        ...stock,
        _ui: {
            noTickSeconds,
            sourceAgeSeconds,
            priceFlashClass,
            variationFlashClass
        }
    };
}

function getStatusLabel(status) {
    return STATUS_LABELS[status] || status || 'N/D';
}

function getStatusClass(status) {
    return status === 'success' ? 'ok' : 'fallback';
}

function getPriceSourceLabel(source) {
    return PRICE_SOURCE_LABELS[source] || source || 'N/D';
}

function summarizePriceSources(stocks) {
    const list = Array.isArray(stocks) ? stocks : [];
    if (!list.length) {
        return 'N/D';
    }

    const countsBySource = {};
    list.forEach((stock) => {
        const source = stock.price_source || 'unknown';
        countsBySource[source] = (countsBySource[source] || 0) + 1;
    });

    return Object.entries(countsBySource)
        .map(([source, count]) => `${getPriceSourceLabel(source)} ${count}/${list.length}`)
        .join(', ');
}

function summarizeStatuses(stocks) {
    const list = Array.isArray(stocks) ? stocks : [];
    const hasPriceFallback = list.some((stock) => stock.price_status && stock.price_status !== 'success');
    const hasDyFallback = list.some((stock) => stock.dy_status && stock.dy_status !== 'success');

    if (hasPriceFallback && hasDyFallback) {
        return '⚠️ Preço e DY com fallback parcial nesta atualização';
    }

    if (hasPriceFallback) {
        return '⚠️ Preço com fallback parcial nesta atualização';
    }

    if (hasDyFallback) {
        return '⚠️ DY com fallback parcial nesta atualização';
    }

    return '✅ Preço e DY em tempo real nesta atualização';
}

function hasAnyFallback(stocks) {
    const list = Array.isArray(stocks) ? stocks : [];
    return list.some((stock) => {
        const priceStatus = stock.price_status || stock.status;
        const dyStatus = stock.dy_status;
        return (priceStatus && priceStatus !== 'success') || (dyStatus && dyStatus !== 'success');
    });
}

// Criar card de ação
function createStockCard(stock) {
    const isPositive = stock.variation_percent >= 0;
    const variationIcon = isPositive ? '📈' : '📉';
    const variationClass = isPositive ? 'positive' : 'negative';
    const logoUrl = getCompanyLogoUrl(stock.ticker);
    const logoFallback = (stock.company_name || stock.ticker).slice(0, 2).toUpperCase();
    
    const priceFlashClass = stock._ui?.priceFlashClass || '';
    const variationFlashClass = stock._ui?.variationFlashClass || '';
    return `
        <div class="stock-card ${variationClass}" data-ticker="${stock.ticker}">
            <div class="stock-header-row">
                <div>
                    <div class="stock-ticker" data-role="ticker">${stock.ticker}</div>
                    <div class="stock-company-name" data-role="company">${stock.company_name || stock.ticker}</div>
                </div>
                <div class="stock-logo-wrap">
                    <img
                        class="stock-logo"
                        src="${logoUrl}"
                        alt="Logo ${stock.company_name || stock.ticker}"
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                    >
                    <div class="stock-logo-fallback">${logoFallback}</div>
                </div>
            </div>
            <div class="stock-price">
                <span class="stock-price-value ${priceFlashClass}" data-role="price-value">$${stock.price.toFixed(2)}</span>
                <span class="stock-price-currency">USD</span>
            </div>
            
            <div class="stock-variation">
                <div class="variation-percent ${variationClass}" data-role="variation-wrap">
                    <span class="variation-icon" data-role="variation-icon">${variationIcon}</span>
                    <span class="variation-value ${variationFlashClass}" data-role="variation-value">${stock.variation_percent > 0 ? '+' : ''}${stock.variation_percent.toFixed(2)}%</span>
                </div>
            </div>
        </div>
    `;
}

// Atualizar timestamp da última atualização
function updateLastUpdate(timestamp) {
    const lastUpdateEl = document.getElementById('lastUpdateClock');
    if (!lastUpdateEl) {
        return;
    }

    if (!timestamp) {
        lastUpdateEl.textContent = 'Data atualização: horário indisponível';
        return;
    }

    const timestampMs = parseTimestampToMillis(timestamp);
    if (timestampMs === null) {
        lastUpdateEl.textContent = 'Data atualização: horário indisponível';
        return;
    }

    const date = new Date(timestampMs);
    const formattedDateTime = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);

    lastUpdateEl.textContent = `Data atualização: ${formattedDateTime}`;
}

// Dados de exemplo (mock)
function getMockData() {
    const now = new Date().toISOString();
    const selectedDySource = getSelectedDySource();
    return {
        stocks: [
            {
                ticker: 'NVDA',
                company_name: 'NVIDIA',
                price: 875.50,
                variation_percent: 3.45,
                variation_abs: 29.25,
                dy: 0.05,
                dy_source: selectedDySource,
                price_source: 'mock_data',
                price_status: 'mock_data',
                dy_status: 'fallback_metadata',
                timestamp: now,
                status: 'mock_data'
            },
            {
                ticker: 'GE',
                company_name: 'GE Aerospace',
                price: 175.30,
                variation_percent: -1.23,
                variation_abs: -2.18,
                dy: 3.25,
                dy_source: selectedDySource,
                price_source: 'mock_data',
                price_status: 'mock_data',
                dy_status: 'fallback_metadata',
                timestamp: now,
                status: 'mock_data'
            },
            {
                ticker: 'CVX',
                company_name: 'Chevron',
                price: 152.75,
                variation_percent: 2.10,
                variation_abs: 3.15,
                dy: 3.85,
                dy_source: selectedDySource,
                price_source: 'mock_data',
                price_status: 'mock_data',
                dy_status: 'fallback_metadata',
                timestamp: now,
                status: 'mock_data'
            },
            {
                ticker: 'FTNT',
                company_name: 'Fortinet',
                price: 83.40,
                variation_percent: 1.18,
                variation_abs: 0.97,
                dy: null,
                dy_source: selectedDySource,
                price_source: 'mock_data',
                price_status: 'mock_data',
                dy_status: 'fallback_metadata',
                timestamp: now,
                status: 'mock_data'
            },
            {
                ticker: 'PANW',
                company_name: 'Palo Alto Networks',
                price: 327.15,
                variation_percent: -0.64,
                variation_abs: -2.10,
                dy: null,
                dy_source: selectedDySource,
                price_source: 'mock_data',
                price_status: 'mock_data',
                dy_status: 'fallback_metadata',
                timestamp: now,
                status: 'mock_data'
            },
            {
                ticker: 'CRWD',
                company_name: 'CrowdStrike',
                price: 362.80,
                variation_percent: 2.45,
                variation_abs: 8.69,
                dy: null,
                dy_source: selectedDySource,
                price_source: 'mock_data',
                price_status: 'mock_data',
                dy_status: 'fallback_metadata',
                timestamp: now,
                status: 'mock_data'
            },
            {
                ticker: 'ZS',
                company_name: 'Zscaler',
                price: 212.35,
                variation_percent: 0.92,
                variation_abs: 1.94,
                dy: null,
                dy_source: selectedDySource,
                price_source: 'mock_data',
                price_status: 'mock_data',
                dy_status: 'fallback_metadata',
                timestamp: now,
                status: 'mock_data'
            },
            {
                ticker: 'CHKP',
                company_name: 'Check Point Software',
                price: 176.90,
                variation_percent: -0.48,
                variation_abs: -0.85,
                dy: null,
                dy_source: selectedDySource,
                price_source: 'mock_data',
                price_status: 'mock_data',
                dy_status: 'fallback_metadata',
                timestamp: now,
                status: 'mock_data'
            }
        ],
        dy_source: selectedDySource,
        last_update: now
    };
}

function getMockAssetGridData() {
    return {
        items: [
            {
                ticker: 'NVDA',
                company_name: 'NVIDIA',
                current_price: 875.5,
                dy: 0.03,
                day_change_pct: 1.14,
                month_change_pct: 4.92,
                ytd_change_pct: 12.31,
                trailing_12m_change_pct: 66.82,
                trailing_5y_change_pct: 1087.12,
                trailing_5y_value_pct: 1087.12,
                trailing_10y_change_pct: 5420.13,
                trailing_10y_value_pct: 6882.44
            },
            {
                ticker: 'GE',
                company_name: 'GE Aerospace',
                current_price: 175.3,
                dy: 0.37,
                day_change_pct: -0.53,
                month_change_pct: 2.37,
                ytd_change_pct: 7.06,
                trailing_12m_change_pct: 44.73,
                trailing_5y_change_pct: 211.15,
                trailing_5y_value_pct: 211.15,
                trailing_10y_change_pct: 932.56,
                trailing_10y_value_pct: 1218.33
            },
            {
                ticker: 'CVX',
                company_name: 'Chevron',
                current_price: 152.75,
                dy: 4.12,
                day_change_pct: 0.62,
                month_change_pct: -1.04,
                ytd_change_pct: 3.18,
                trailing_12m_change_pct: 12.22,
                trailing_5y_change_pct: 84.51,
                trailing_5y_value_pct: 84.51,
                trailing_10y_change_pct: 248.19,
                trailing_10y_value_pct: 365.91
            },
            {
                ticker: 'CCJ',
                company_name: 'Cameco',
                current_price: 49.2,
                dy: null,
                day_change_pct: -1.2,
                month_change_pct: -3.44,
                ytd_change_pct: 9.65,
                trailing_12m_change_pct: 28.17,
                trailing_5y_change_pct: 356.8,
                trailing_5y_value_pct: 356.8,
                trailing_10y_change_pct: 1120.42,
                trailing_10y_value_pct: 1492.03
            },
            {
                ticker: 'SQM',
                company_name: 'Sociedad Quimica y Minera',
                current_price: 47.05,
                dy: null,
                day_change_pct: 0.27,
                month_change_pct: 5.02,
                ytd_change_pct: 11.73,
                trailing_12m_change_pct: -14.96,
                trailing_5y_change_pct: 63.4,
                trailing_5y_value_pct: 63.4,
                trailing_10y_change_pct: 174.68,
                trailing_10y_value_pct: 256.57
            }
        ]
    };
}
