from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import asyncio
import time
from config import settings
from typing import List, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Stock Monitor API")

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StockData(BaseModel):
    ticker: str
    company_name: str
    price: float
    variation_percent: float
    variation_abs: float
    currency: str = "USD"
    dy: Optional[float] = None
    timestamp: str
    status: str = "success"


class PortfolioData(BaseModel):
    stocks: List[StockData]
    last_update: str


COMPANY_METADATA = {
    "NVDA": {"company_name": "NVIDIA", "dy": 0.03},
    "GE": {"company_name": "GE Aerospace", "dy": 0.37},
    "CVX": {"company_name": "Chevron", "dy": 4.12},
}


# Cache em memória com timestamp
stock_cache = {}
last_cache_time = {}
CACHE_DURATION = 60  # Cache por 60 segundos para respeitar rate limit


def get_company_metadata(ticker: str) -> dict:
    return COMPANY_METADATA.get(ticker, {"company_name": ticker, "dy": None})


async def fetch_stock_data(ticker: str) -> Optional[StockData]:
    """Busca dados com cache inteligente para evitar rate limit"""
    
    current_time = time.time()
    
    # Retornar do cache se ainda válido
    if ticker in stock_cache and ticker in last_cache_time:
        age = current_time - last_cache_time[ticker]
        if age < CACHE_DURATION:
            remaining = CACHE_DURATION - age
            logger.info(f"✓ {ticker}: usando cache (válido por {remaining:.0f}s)")
            return stock_cache[ticker]
    
    if not settings.alpha_vantage_api_key:
        logger.warning(f"⚠️  {ticker}: sem API key, usando mock")
        if ticker in stock_cache:
            return stock_cache[ticker]
        return get_mock_data(ticker)
    
    try:
        logger.info(f"🔄 {ticker}: buscando da API...")
        async with httpx.AsyncClient(timeout=10) as client:
            url = "https://www.alphavantage.co/query"
            params = {
                "function": "GLOBAL_QUOTE",
                "symbol": ticker,
                "apikey": settings.alpha_vantage_api_key,
            }
            
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if "Global Quote" not in data:
                logger.error(f"❌ {ticker}: resposta inválida")
                return stock_cache.get(ticker) or get_mock_data(ticker)
            
            quote = data["Global Quote"]
            
            # Verificar se há dados válidos
            if not quote or "05. price" not in quote or quote["05. price"] == "":
                logger.warning(f"⚠️  {ticker}: rate limit ou sem dados")
                if ticker in stock_cache:
                    logger.info(f"   retornando cache anterior")
                    return stock_cache[ticker]
                return get_mock_data(ticker)
            
            price = float(quote.get("05. price", 0))
            change = float(quote.get("09. change", 0))
            change_percent = float(quote.get("10. change percent", "0").rstrip("%"))
            
            stock_data = StockData(
                ticker=ticker,
                company_name=get_company_metadata(ticker)["company_name"],
                price=price,
                variation_abs=change,
                variation_percent=change_percent,
                timestamp=quote.get("07. latest trading day", "N/A"),
                dy=get_company_metadata(ticker)["dy"],
                status="success"
            )
            
            # Cachear resultado
            stock_cache[ticker] = stock_data
            last_cache_time[ticker] = current_time
            logger.info(f"✅ {ticker}: ${price:.2f} ({change_percent:+.2f}%)")
            return stock_data
            
    except Exception as e:
        logger.error(f"❌ {ticker}: erro - {str(e)}")
        if ticker in stock_cache:
            logger.info(f"   retornando cache anterior")
            return stock_cache[ticker]
        return get_mock_data(ticker)


def get_mock_data(ticker: str) -> StockData:
    """Dados de exemplo para testes"""
    import random
    from datetime import datetime
    
    mock_prices = {"NVDA": 875.50, "GE": 175.30, "CVX": 152.75}
    price = mock_prices.get(ticker, 100.0)
    variation_percent = random.uniform(-5, 5)
    variation_abs = price * (variation_percent / 100)
    
    return StockData(
        ticker=ticker,
        company_name=get_company_metadata(ticker)["company_name"],
        price=price,
        variation_abs=round(variation_abs, 2),
        variation_percent=round(variation_percent, 2),
        timestamp=datetime.now().isoformat(),
        dy=get_company_metadata(ticker)["dy"],
        status="mock_data"
    )


@app.get("/api/stocks", response_model=PortfolioData)
async def get_stocks():
    """Retorna todas as ações"""
    from datetime import datetime
    
    logger.info(f"📊 Buscando: {', '.join(settings.stocks_list)}")
    
    # Buscar em paralelo
    tasks = [fetch_stock_data(ticker) for ticker in settings.stocks_list]
    results = await asyncio.gather(*tasks)
    
    stocks = [stock for stock in results if stock is not None]
    
    return PortfolioData(
        stocks=stocks,
        last_update=datetime.now().isoformat()
    )


@app.get("/api/stocks/{ticker}", response_model=StockData)
async def get_stock(ticker: str):
    """Retorna uma ação específica"""
    
    ticker = ticker.upper()
    
    if ticker not in settings.stocks_list:
        raise HTTPException(
            status_code=404,
            detail=f"{ticker} não monitorado. Disponíveis: {', '.join(settings.stocks_list)}"
        )
    
    stock_data = await fetch_stock_data(ticker)
    
    if not stock_data:
        raise HTTPException(
            status_code=500,
            detail=f"Sem dados para {ticker}"
        )
    
    return stock_data


@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "stocks_monitored": settings.stocks_list,
        "cached_items": len(stock_cache),
        "api_configured": bool(settings.alpha_vantage_api_key),
    }


@app.on_event("startup")
async def startup():
    logger.info(f"🚀 Stock Monitor iniciado")
    logger.info(f"📊 Monitorando: {', '.join(settings.stocks_list)}")
    if settings.alpha_vantage_api_key:
        logger.info(f"✅ API Key configurada")
    else:
        logger.warning(f"⚠️  Modo demo (dados de exemplo)")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
