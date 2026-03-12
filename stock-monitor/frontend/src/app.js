// Configuração
const API_BASE_URL = 'http://localhost:8000/api';
let autoRefreshInterval = null;

// Carregar API Key do localStorage
window.addEventListener('DOMContentLoaded', () => {
    const savedApiKey = localStorage.getItem('apiKey');
    if (savedApiKey) {
        document.getElementById('apiKey').value = savedApiKey;
    }
    refreshData();
});

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
function toggleAutoRefresh() {
    const isChecked = document.getElementById('autoRefresh').checked;
    
    if (isChecked) {
        // Atualizar a cada 60 segundos
        autoRefreshInterval = setInterval(() => {
            refreshData();
        }, 60000);
        alert('Auto-atualização ativada (a cada 60 segundos)');
    } else {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
        alert('Auto-atualização desativada');
    }
}

// Função principal de atualização
async function refreshData() {
    const container = document.getElementById('stocksContainer');
    const statusDiv = document.getElementById('dataStatus');
    
    try {
        container.innerHTML = '<div class="loading">⏳ Carregando dados...</div>';
        
        // Tentar conectar ao servidor, se falhar usar URL alternativa ou dados de exemplo
        let data;
        try {
            const response = await fetch(`${API_BASE_URL}/stocks`);
            if (!response.ok) throw new Error('Erro na API');
            data = await response.json();
            statusDiv.textContent = '✅ Dados em tempo real (API Alpha Vantage)';
            statusDiv.className = 'status-real';
        } catch (apiError) {
            console.warn('API não disponível, usando dados de exemplo:', apiError);
            data = getMockData();
            statusDiv.textContent = '⚠️ Usando dados de exemplo (API não conectada)';
            statusDiv.className = 'status-mock';
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
    }
}

// Renderizar cards de ações
function renderStocks(stocks) {
    const container = document.getElementById('stocksContainer');
    
    if (!stocks || stocks.length === 0) {
        container.innerHTML = '<div class="error">Nenhuma ação para exibir</div>';
        return;
    }
    
    container.innerHTML = stocks.map(stock => createStockCard(stock)).join('');
}

function getCompanyLogoUrl(ticker) {
    const logoMap = {
        NVDA: 'nvidia.com',
        GE: 'geaerospace.com',
        CVX: 'chevron.com'
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

// Criar card de ação
function createStockCard(stock) {
    const isPositive = stock.variation_percent >= 0;
    const variationIcon = isPositive ? '📈' : '📉';
    const variationClass = isPositive ? 'positive' : 'negative';
    const logoUrl = getCompanyLogoUrl(stock.ticker);
    const logoFallback = (stock.company_name || stock.ticker).slice(0, 2).toUpperCase();
    
    const dyDisplay = stock.dy !== null && stock.dy !== undefined 
        ? `<div class="stock-dy">
             <label>DY (Dividend Yield)</label>
             <div class="value">${formatDividendYield(stock.dy)}</div>
           </div>`
        : '<div class="stock-dy"><label>DY</label><div class="value">N/A</div></div>';
    
    const timestamp = new Date(stock.timestamp).toLocaleDateString('pt-BR');
    
    return `
        <div class="stock-card ${variationClass}">
            <div class="stock-header-row">
                <div>
                    <div class="stock-ticker">${stock.ticker}</div>
                    <div class="stock-company-name">${stock.company_name || stock.ticker}</div>
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
                $${stock.price.toFixed(2)}
                <span class="stock-price-currency">USD</span>
            </div>
            
            <div class="stock-variation">
                <div class="variation-percent ${variationClass}">
                    <span class="variation-icon">${variationIcon}</span>
                    <span>${stock.variation_percent > 0 ? '+' : ''}${stock.variation_percent.toFixed(2)}%</span>
                </div>
            </div>
            
            ${dyDisplay}
            
            <div class="stock-timestamp">📅 ${timestamp}</div>
        </div>
    `;
}

// Atualizar timestamp da última atualização
function updateLastUpdate(timestamp) {
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (timestamp) {
        const date = new Date(timestamp);
        const timeStr = date.toLocaleTimeString('pt-BR');
        lastUpdateEl.textContent = `Última atualização: ${timeStr}`;
    }
}

// Dados de exemplo (mock)
function getMockData() {
    const now = new Date().toISOString();
    return {
        stocks: [
            {
                ticker: 'NVDA',
                company_name: 'NVIDIA',
                price: 875.50,
                variation_percent: 3.45,
                variation_abs: 29.25,
                dy: 0.05,
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
                timestamp: now,
                status: 'mock_data'
            }
        ],
        last_update: now
    };
}
