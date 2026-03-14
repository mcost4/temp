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
    const savedApiKey = localStorage.getItem('apiKey');
    if (savedApiKey) {
        document.getElementById('apiKey').value = savedApiKey;
    }

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

    const autoRefreshCheckbox = document.getElementById('autoRefresh');
    setAutoRefreshVisualState(Boolean(autoRefreshCheckbox && autoRefreshCheckbox.checked));
    if (autoRefreshCheckbox && autoRefreshCheckbox.checked) {
        toggleAutoRefresh(false);
    }

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

// Salvar API Key
function saveApiKey() {
    const apiKey = document.getElementById('apiKey').value.trim();
    if (apiKey) {
        localStorage.setItem('apiKey', apiKey);
        alert('✅ API Key salva com sucesso!');
        refreshData();
    } else {
        localStorage.removeItem('apiKey');
        alert('API Key removida. Usando dados de exemplo.');
        refreshData();
    }
}

// Alternar auto-atualização
function toggleAutoRefresh(showAlert = true) {
    const isChecked = document.getElementById('autoRefresh').checked;
    setAutoRefreshVisualState(isChecked);
    
    if (isChecked) {
        autoRefreshDelayMs = AUTO_REFRESH_BASE_MS;
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
        autoRefreshInterval = setInterval(() => {
            refreshData();
        }, autoRefreshDelayMs);
        if (showAlert) {
            alert('Auto-atualização ativada (5s, com proteção de rate limit)');
        }
    } else {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
        if (showAlert) {
            alert('Auto-atualização desativada');
        }
    }
}

// Função principal de atualização
async function refreshData() {
    if (isRefreshing) {
        return;
    }

    isRefreshing = true;
    const container = document.getElementById('stocksContainer');
    const statusDiv = document.getElementById('dataStatus');
    const selectedDySource = getSelectedDySource();
    const selectedDySourceLabel = dySourceLabels[selectedDySource] || dySourceLabels[DEFAULT_DY_SOURCE];
    updateFooterDataSource(selectedDySourceLabel);
    
    try {
        if (!hasRenderedStocks) {
            container.innerHTML = '<div class="loading">⏳ Carregando dados...</div>';
        }
        
        // Tentar conectar ao servidor, se falhar usar URL alternativa ou dados de exemplo
        let data;
        try {
            const response = await fetch(`${API_BASE_URL}/stocks?dy_source=${encodeURIComponent(selectedDySource)}`);
            if (!response.ok) throw new Error('Erro na API');
            data = await response.json();
            const responseDySource = normalizeDySource(data.dy_source || selectedDySource);
            const responseDySourceLabel = dySourceLabels[responseDySource] || selectedDySourceLabel;
            const runtimeStatus = summarizeStatuses(data.stocks);
            const priceSourceSummary = summarizePriceSources(data.stocks);
            statusDiv.textContent = `${runtimeStatus} (Fonte DY: ${responseDySourceLabel} | Fontes preço: ${priceSourceSummary})`;
            statusDiv.className = hasAnyFallback(data.stocks) ? 'status-mock' : 'status-real';
            updateFooterDataSource(responseDySourceLabel);
            autoRefreshDelayMs = AUTO_REFRESH_BASE_MS;
            if (document.getElementById('autoRefresh').checked && autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = setInterval(() => {
                    refreshData();
                }, autoRefreshDelayMs);
            }
        } catch (apiError) {
            console.warn('API não disponível, usando dados de exemplo:', apiError);
            data = getMockData();
            statusDiv.textContent = `⚠️ Usando dados de exemplo (DY: ${selectedDySourceLabel})`;
            statusDiv.className = 'status-mock';
            updateFooterDataSource(selectedDySourceLabel);

            autoRefreshDelayMs = Math.min(autoRefreshDelayMs * 2, AUTO_REFRESH_MAX_MS);
            if (document.getElementById('autoRefresh').checked && autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = setInterval(() => {
                    refreshData();
                }, autoRefreshDelayMs);
            }
        }
        
        renderStocks(data.stocks);
        updateLastUpdate(data.last_update);
        
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
        const dyValueEl = card.querySelector('[data-role="dy-value"]');
        const priceStatusEl = card.querySelector('[data-role="price-status"]');
        const dyStatusEl = card.querySelector('[data-role="dy-status"]');
        const tickStatusEl = card.querySelector('[data-role="tick-status"]');
        const sourceEl = card.querySelector('[data-role="price-source"]');
        const sourceUpdateEl = card.querySelector('[data-role="source-update"]');
        const timestampEl = card.querySelector('[data-role="timestamp"]');

        const priceStatus = stock.price_status || stock.status || 'mock_data';
        const dyStatus = stock.dy_status || (stock.status === 'success' ? 'success' : 'fallback_metadata');
        const noTickSeconds = stock._ui?.noTickSeconds ?? 0;
        const sourceAgeSeconds = stock._ui?.sourceAgeSeconds;
        const noTickBadgeClass = noTickSeconds >= NO_TICK_WARNING_SECONDS ? 'stale' : 'ok';
        const noTickBadgeLabel = noTickSeconds >= NO_TICK_WARNING_SECONDS
            ? `Sem novo tick há ${noTickSeconds}s`
            : `Tick recente (${noTickSeconds}s)`;
        const sourceAgeLabel = sourceAgeSeconds === null
            ? 'idade N/D'
            : `há ${formatSecondsLabel(sourceAgeSeconds)}`;

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

        if (dyValueEl) dyValueEl.textContent = formatDividendYield(stock.dy);

        if (priceStatusEl) {
            priceStatusEl.textContent = `Preço: ${getStatusLabel(priceStatus)}`;
            priceStatusEl.className = `stock-status-badge ${getStatusClass(priceStatus)}`;
        }
        if (dyStatusEl) {
            dyStatusEl.textContent = `DY: ${getStatusLabel(dyStatus)}`;
            dyStatusEl.className = `stock-status-badge ${getStatusClass(dyStatus)}`;
        }
        if (tickStatusEl) {
            tickStatusEl.textContent = noTickBadgeLabel;
            tickStatusEl.className = `stock-status-badge ${noTickBadgeClass}`;
        }

        if (sourceEl) sourceEl.textContent = `Fonte preço: ${getPriceSourceLabel(stock.price_source)}`;
        if (sourceUpdateEl) {
            sourceUpdateEl.textContent = `Atualização da fonte: ${formatStockTimestamp(stock.timestamp)} (${sourceAgeLabel})`;
        }
        if (timestampEl) {
            timestampEl.textContent = `📅 ${formatStockTimestamp(stock.timestamp)}`;
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

function formatDividendYield(dy) {
    if (dy === null || dy === undefined || Number.isNaN(Number(dy))) {
        return 'N/D';
    }

    return `${Number(dy).toFixed(2)}%`;
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

function formatSecondsLabel(seconds) {
    if (seconds === null || seconds === undefined) {
        return 'N/D';
    }

    return `${seconds}s`;
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
    
    const priceStatus = stock.price_status || stock.status || 'mock_data';
    const dyStatus = stock.dy_status || (stock.status === 'success' ? 'success' : 'fallback_metadata');
    const priceSourceLabel = getPriceSourceLabel(stock.price_source);
    const noTickSeconds = stock._ui?.noTickSeconds ?? 0;
    const sourceAgeSeconds = stock._ui?.sourceAgeSeconds;
    const priceFlashClass = stock._ui?.priceFlashClass || '';
    const variationFlashClass = stock._ui?.variationFlashClass || '';
    const noTickBadgeClass = noTickSeconds >= NO_TICK_WARNING_SECONDS ? 'stale' : 'ok';
    const noTickBadgeLabel = noTickSeconds >= NO_TICK_WARNING_SECONDS
        ? `Sem novo tick há ${noTickSeconds}s`
        : `Tick recente (${noTickSeconds}s)`;
    const sourceAgeLabel = sourceAgeSeconds === null
        ? 'idade N/D'
        : `há ${formatSecondsLabel(sourceAgeSeconds)}`;
    const timestamp = formatStockTimestamp(stock.timestamp);
    
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
            
            <div class="stock-dy">
                <label>DY (Dividend Yield)</label>
                <div class="value" data-role="dy-value">${formatDividendYield(stock.dy)}</div>
            </div>
            <div class="stock-status-row">
                <span class="stock-status-badge ${getStatusClass(priceStatus)}" data-role="price-status">Preço: ${getStatusLabel(priceStatus)}</span>
                <span class="stock-status-badge ${getStatusClass(dyStatus)}" data-role="dy-status">DY: ${getStatusLabel(dyStatus)}</span>
                <span class="stock-status-badge ${noTickBadgeClass}" data-role="tick-status">${noTickBadgeLabel}</span>
            </div>
            <div class="stock-source" data-role="price-source">Fonte preço: ${priceSourceLabel}</div>
            <div class="stock-source-update" data-role="source-update">Atualização da fonte: ${formatStockTimestamp(stock.timestamp)} (${sourceAgeLabel})</div>
            
            <div class="stock-timestamp" data-role="timestamp">📅 ${timestamp}</div>
        </div>
    `;
}

// Atualizar timestamp da última atualização
function updateLastUpdate(timestamp) {
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (!lastUpdateEl) {
        return;
    }

    if (!timestamp) {
        lastUpdateEl.textContent = 'Última atualização: horário indisponível';
        return;
    }

    const timestampMs = parseTimestampToMillis(timestamp);
    if (timestampMs === null) {
        lastUpdateEl.textContent = 'Última atualização: horário indisponível';
        return;
    }

    const date = new Date(timestampMs);
    const brasiliaTime = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);
    const newYorkTime = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);

    lastUpdateEl.textContent = `Última atualização: Brasília ${brasiliaTime} | Nova York ${newYorkTime}`;
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
