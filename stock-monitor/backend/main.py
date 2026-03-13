from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import asyncio
import time
from config import settings
from typing import Any, List, Optional
import logging
import warnings
from datetime import datetime, timezone
from contextlib import asynccontextmanager

try:
    import yfinance as yf
except ImportError:
    yf = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

warnings.filterwarnings(
    "ignore",
    message=r".*Timestamp\.utcnow is deprecated.*",
    module=r"yfinance.*",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"🚀 Stock Monitor iniciado")
    logger.info(f"📊 Monitorando: {', '.join(settings.stocks_list)}")
    if settings.alpha_vantage_api_key:
        logger.info(f"✅ API Key configurada")
    else:
        logger.warning(f"⚠️  Modo demo (dados de exemplo)")
    yield


app = FastAPI(title="Stock Monitor API", lifespan=lifespan)

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
    dy_source: str = "alpha_vantage"
    price_source: str = "alpha_vantage"
    price_status: str = "success"
    dy_status: str = "success"
    timestamp: str
    status: str = "success"


class PortfolioData(BaseModel):
    stocks: List[StockData]
    last_update: str
    dy_source: str


class DySourceOption(BaseModel):
    value: str
    label: str


class DySourcesResponse(BaseModel):
    default_source: str
    sources: List[DySourceOption]


COMPANY_METADATA = {
    "NVDA": {"company_name": "NVIDIA", "dy": 0.03},
    "GE": {"company_name": "GE Aerospace", "dy": 0.37},
    "CVX": {"company_name": "Chevron", "dy": 4.12},
}


# Cache em memória com timestamp
stock_cache = {}
last_cache_time = {}
CACHE_DURATION = 10  # Cache curto para refletir melhor atualizações intraday
VALID_DY_SOURCES = {"alpha_vantage", "finnhub", "yahoo_finance"}
DY_SOURCE_LABELS = {
    "alpha_vantage": "Alpha Vantage",
    "finnhub": "Finnhub",
    "yahoo_finance": "Yahoo Finance",
}


def get_company_metadata(ticker: str) -> dict:
    return COMPANY_METADATA.get(ticker, {"company_name": ticker, "dy": None})


def normalize_dy_source(dy_source: Optional[str]) -> str:
    requested = (dy_source or settings.normalized_dy_data_source).strip().lower()
    if requested in VALID_DY_SOURCES:
        return requested
    return "alpha_vantage"


def parse_dividend_yield(raw_value: Any, scale_fraction: bool = True) -> Optional[float]:
    if raw_value is None:
        return None

    value = raw_value
    if isinstance(raw_value, str):
        cleaned = raw_value.strip().rstrip("%")
        if cleaned in {"", "None", "N/A", "null"}:
            return None
        value = cleaned

    try:
        dy_value = float(value)
    except (TypeError, ValueError):
        return None

    # Algumas fontes retornam fração (0.0123), outras percentual (1.23)
    if scale_fraction and 0 <= dy_value <= 1:
        dy_value *= 100

    return round(dy_value, 2)


async def fetch_dy_from_alpha_vantage(client: httpx.AsyncClient, ticker: str) -> Optional[float]:
    if not settings.alpha_vantage_api_key:
        return None

    response = await client.get(
        "https://www.alphavantage.co/query",
        params={
            "function": "OVERVIEW",
            "symbol": ticker,
            "apikey": settings.alpha_vantage_api_key,
        },
    )
    response.raise_for_status()
    overview = response.json()
    return parse_dividend_yield(overview.get("DividendYield"))


async def fetch_price_from_alpha_vantage(client: httpx.AsyncClient, ticker: str) -> Optional[dict]:
    if not settings.alpha_vantage_api_key:
        return None

    response = await client.get(
        "https://www.alphavantage.co/query",
        params={
            "function": "GLOBAL_QUOTE",
            "symbol": ticker,
            "apikey": settings.alpha_vantage_api_key,
        },
    )
    response.raise_for_status()
    data = response.json()

    quote = data.get("Global Quote")
    if not quote or "05. price" not in quote or quote["05. price"] == "":
        return None

    return {
        "price": float(quote.get("05. price", 0)),
        "variation_abs": float(quote.get("09. change", 0)),
        "variation_percent": float(quote.get("10. change percent", "0").rstrip("%")),
        "timestamp": quote.get("07. latest trading day", "N/A"),
        "price_source": "alpha_vantage",
    }


async def fetch_price_from_finnhub(client: httpx.AsyncClient, ticker: str) -> Optional[dict]:
    if not settings.finnhub_api_key:
        return None

    response = await client.get(
        "https://finnhub.io/api/v1/quote",
        params={
            "symbol": ticker,
            "token": settings.finnhub_api_key,
        },
    )
    response.raise_for_status()
    payload = response.json()

    current_price = payload.get("c")
    if current_price in (None, 0):
        return None

    change_abs = float(payload.get("d") or 0)
    change_percent = float(payload.get("dp") or 0)
    epoch_time = payload.get("t")
    timestamp = datetime.now(timezone.utc).isoformat()
    if epoch_time:
        try:
            timestamp = datetime.fromtimestamp(int(epoch_time), tz=timezone.utc).isoformat()
        except (TypeError, ValueError, OSError):
            pass

    return {
        "price": float(current_price),
        "variation_abs": change_abs,
        "variation_percent": change_percent,
        "timestamp": timestamp,
        "price_source": "finnhub",
    }


async def fetch_price_from_yahoo_yfinance(ticker: str) -> Optional[dict]:
    if yf is None:
        return None

    def _get_yf_price() -> Optional[dict]:
        ticker_data = yf.Ticker(ticker)
        fast_info = getattr(ticker_data, "fast_info", None) or {}

        current_price = fast_info.get("lastPrice")
        previous_close = fast_info.get("previousClose")

        if current_price is None:
            info = ticker_data.info or {}
            current_price = info.get("currentPrice") or info.get("regularMarketPrice")
            previous_close = info.get("previousClose") or info.get("regularMarketPreviousClose")

        if current_price is None:
            return None

        if previous_close in (None, 0):
            change_abs = 0.0
            change_percent = 0.0
        else:
            change_abs = float(current_price) - float(previous_close)
            change_percent = (change_abs / float(previous_close)) * 100

        return {
            "price": float(current_price),
            "variation_abs": round(change_abs, 2),
            "variation_percent": round(change_percent, 4),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "price_source": "yahoo_finance",
        }

    try:
        return await asyncio.to_thread(_get_yf_price)
    except Exception as e:
        logger.warning(f"⚠️  {ticker}: fallback preço yfinance falhou - {str(e)}")
        return None


async def fetch_prices_from_yahoo_batch(
    client: httpx.AsyncClient,
    tickers: List[str],
) -> dict:
    symbols = ",".join(tickers)
    if not symbols:
        return {}

    response = await client.get(
        "https://query1.finance.yahoo.com/v7/finance/quote",
        params={"symbols": symbols},
    )
    response.raise_for_status()
    payload = response.json()
    results = payload.get("quoteResponse", {}).get("result") or []

    prices = {}
    for item in results:
        ticker = str(item.get("symbol") or "").upper()
        if not ticker:
            continue

        current_price = item.get("regularMarketPrice")
        if current_price is None:
            continue

        previous_close = item.get("regularMarketPreviousClose")
        change_abs = item.get("regularMarketChange")
        change_percent = item.get("regularMarketChangePercent")

        if change_abs is None:
            if previous_close not in (None, 0):
                change_abs = float(current_price) - float(previous_close)
            else:
                change_abs = 0.0

        if change_percent is None:
            if previous_close not in (None, 0):
                change_percent = (float(change_abs) / float(previous_close)) * 100
            else:
                change_percent = 0.0

        market_time = item.get("regularMarketTime")
        timestamp = datetime.now(timezone.utc).isoformat()
        if market_time:
            try:
                timestamp = datetime.fromtimestamp(int(market_time), tz=timezone.utc).isoformat()
            except (TypeError, ValueError, OSError):
                pass

        prices[ticker] = {
            "price": float(current_price),
            "variation_abs": round(float(change_abs), 2),
            "variation_percent": round(float(change_percent), 4),
            "timestamp": timestamp,
            "price_source": "yahoo_finance",
        }

    return prices


async def fetch_price_from_yahoo_http(
    client: httpx.AsyncClient,
    ticker: str,
) -> Optional[dict]:
    prices = await fetch_prices_from_yahoo_batch(client, [ticker])
    return prices.get(ticker)


async def fetch_fallback_price_data(
    ticker: str,
    preferred_source: str,
    client: Optional[httpx.AsyncClient] = None,
) -> Optional[dict]:
    fetch_order = {
        "yahoo_finance": ["yahoo_yfinance", "yahoo_http", "finnhub", "alpha_vantage"],
        "finnhub": ["finnhub", "alpha_vantage", "yahoo_finance"],
        "alpha_vantage": ["alpha_vantage", "finnhub", "yahoo_finance"],
    }.get(preferred_source, ["finnhub", "alpha_vantage", "yahoo_finance"])

    for source in fetch_order:
        try:
            if source in {"yahoo_finance", "yahoo_yfinance"}:
                yahoo_price = await fetch_price_from_yahoo_yfinance(ticker)
                if yahoo_price is not None:
                    return yahoo_price
                continue

            if source == "yahoo_http":
                if client is None:
                    async with httpx.AsyncClient(timeout=10) as fallback_client:
                        price = await fetch_price_from_yahoo_http(fallback_client, ticker)
                else:
                    price = await fetch_price_from_yahoo_http(client, ticker)

                if price is not None:
                    return price
                continue

            if client is None:
                async with httpx.AsyncClient(timeout=10) as fallback_client:
                    if source == "finnhub":
                        price = await fetch_price_from_finnhub(fallback_client, ticker)
                    else:
                        price = await fetch_price_from_alpha_vantage(fallback_client, ticker)
            else:
                if source == "finnhub":
                    price = await fetch_price_from_finnhub(client, ticker)
                else:
                    price = await fetch_price_from_alpha_vantage(client, ticker)

            if price is not None:
                return price
        except Exception as e:
            logger.warning(f"⚠️  {ticker}: fallback preço {source} falhou - {str(e)}")

    return None


async def fetch_dy_from_finnhub(client: httpx.AsyncClient, ticker: str) -> Optional[float]:
    if not settings.finnhub_api_key:
        logger.warning("⚠️  Finnhub API key não configurada")
        return None

    response = await client.get(
        "https://finnhub.io/api/v1/stock/metric",
        params={
            "symbol": ticker,
            "metric": "all",
            "token": settings.finnhub_api_key,
        },
    )
    response.raise_for_status()
    payload = response.json()
    metric = payload.get("metric", {})
    return parse_dividend_yield(
        metric.get("dividendYieldIndicatedAnnual")
        or metric.get("currentDividendYieldTTM")
        or metric.get("dividendYield5Y"),
        scale_fraction=False,
    )


async def fetch_dy_from_yahoo_finance(client: httpx.AsyncClient, ticker: str) -> Optional[float]:
    # Caminho principal Yahoo: yfinance; endpoint HTTP como backup.
    yfinance_dy = await fetch_dy_from_yahoo_yfinance(ticker)
    if yfinance_dy is not None:
        return yfinance_dy

    try:
        response = await client.get(
            f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}",
            params={"modules": "summaryDetail"},
        )
        response.raise_for_status()
        payload = response.json()

        result = payload.get("quoteSummary", {}).get("result") or []
        if not result:
            return None

        summary_detail = result[0].get("summaryDetail", {})
        dy_data = summary_detail.get("dividendYield")
        if isinstance(dy_data, dict):
            return parse_dividend_yield(dy_data.get("raw"))

        return parse_dividend_yield(dy_data)
    except Exception as e:
        logger.warning(f"⚠️  {ticker}: quoteSummary Yahoo falhou (backup) - {str(e)}")
        return None


async def fetch_dy_from_yahoo_yfinance(ticker: str) -> Optional[float]:
    if yf is None:
        logger.warning("⚠️  yfinance não instalado para fallback do Yahoo")
        return None

    def _get_yf_dy() -> Optional[float]:
        ticker_data = yf.Ticker(ticker)

        info = ticker_data.info or {}
        candidate = info.get("dividendYield")
        parsed = parse_dividend_yield(candidate, scale_fraction=False)
        if parsed is not None:
            return parsed

        fast_info = getattr(ticker_data, "fast_info", None)
        if fast_info:
            return parse_dividend_yield(
                fast_info.get("dividendYield")
                or fast_info.get("trailingAnnualDividendYield"),
                scale_fraction=False,
            )

        return None

    try:
        return await asyncio.to_thread(_get_yf_dy)
    except Exception as e:
        logger.warning(f"⚠️  {ticker}: fallback yfinance falhou - {str(e)}")
        return None


async def fetch_dividend_yield(
    client: httpx.AsyncClient,
    ticker: str,
    dy_source: str,
) -> Optional[float]:
    try:
        if dy_source == "finnhub":
            return await fetch_dy_from_finnhub(client, ticker)
        if dy_source == "yahoo_finance":
            return await fetch_dy_from_yahoo_finance(client, ticker)
        return await fetch_dy_from_alpha_vantage(client, ticker)
    except Exception as e:
        logger.warning(f"⚠️  {ticker}: erro ao buscar DY em {dy_source} - {str(e)}")
        return None


async def get_fallback_data_with_selected_dy(
    ticker: str,
    dy_source: str,
    client: Optional[httpx.AsyncClient] = None,
) -> StockData:
    """Monta resposta de fallback preservando DY da fonte selecionada quando possível."""
    fallback_price = await fetch_fallback_price_data(ticker, dy_source, client)

    if fallback_price is not None:
        stock_data = StockData(
            ticker=ticker,
            company_name=get_company_metadata(ticker)["company_name"],
            price=fallback_price["price"],
            variation_abs=fallback_price["variation_abs"],
            variation_percent=fallback_price["variation_percent"],
            timestamp=fallback_price["timestamp"],
            dy=get_company_metadata(ticker)["dy"],
            dy_source=dy_source,
            price_source=fallback_price["price_source"],
            price_status="fallback_realtime",
            dy_status="fallback_metadata",
            status="fallback_realtime",
        )
    else:
        stock_data = get_mock_data(ticker, dy_source)

    if client is not None:
        provider_dy = await fetch_dividend_yield(client, ticker, dy_source)
    else:
        async with httpx.AsyncClient(timeout=10) as fallback_client:
            provider_dy = await fetch_dividend_yield(fallback_client, ticker, dy_source)

    if provider_dy is not None:
        stock_data.dy = provider_dy
        stock_data.dy_status = "success"
    else:
        stock_data.dy_status = "fallback_metadata"

    stock_data.status = stock_data.price_status

    return stock_data


async def fetch_stock_data(
    ticker: str,
    dy_source: Optional[str] = None,
    preloaded_price_data: Optional[dict] = None,
) -> Optional[StockData]:
    """Busca dados com cache inteligente para evitar rate limit"""

    selected_dy_source = normalize_dy_source(dy_source)
    cache_key = f"{ticker}:{selected_dy_source}"
    current_time = time.time()

    # Retornar do cache se ainda válido
    if cache_key in stock_cache and cache_key in last_cache_time:
        age = current_time - last_cache_time[cache_key]
        if age < CACHE_DURATION:
            remaining = CACHE_DURATION - age
            logger.info(
                f"✓ {ticker}: usando cache ({selected_dy_source}, válido por {remaining:.0f}s)"
            )
            return stock_cache[cache_key]

    if not settings.alpha_vantage_api_key:
        logger.warning(f"⚠️  {ticker}: sem API key, usando mock")
        if cache_key in stock_cache:
            return stock_cache[cache_key]
        return await get_fallback_data_with_selected_dy(ticker, selected_dy_source)

    try:
        logger.info(f"🔄 {ticker}: buscando da API...")
        async with httpx.AsyncClient(timeout=10) as client:
            price_data = None

            if preloaded_price_data:
                price_data = preloaded_price_data.get(ticker)

            if price_data is None:
                price_data = await fetch_fallback_price_data(ticker, selected_dy_source, client)

            if price_data is None:
                logger.warning(f"⚠️  {ticker}: sem preço válido da fonte primária")
                if cache_key in stock_cache:
                    logger.info("   retornando cache anterior")
                    return stock_cache[cache_key]
                return await get_fallback_data_with_selected_dy(
                    ticker,
                    selected_dy_source,
                    client,
                )

            provider_dy = await fetch_dividend_yield(client, ticker, selected_dy_source)
            dy = provider_dy
            if dy is None:
                dy = get_company_metadata(ticker)["dy"]
            
            stock_data = StockData(
                ticker=ticker,
                company_name=get_company_metadata(ticker)["company_name"],
                price=price_data["price"],
                variation_abs=price_data["variation_abs"],
                variation_percent=price_data["variation_percent"],
                timestamp=price_data["timestamp"],
                dy=dy,
                dy_source=selected_dy_source,
                price_source=price_data["price_source"],
                price_status="success",
                dy_status="success" if provider_dy is not None else "fallback_metadata",
                status="success"
            )

            # Cachear resultado
            stock_cache[cache_key] = stock_data
            last_cache_time[cache_key] = current_time
            logger.info(
                f"✅ {ticker}: ${price_data['price']:.2f} ({price_data['variation_percent']:+.2f}%)"
            )
            return stock_data

    except Exception as e:
        logger.error(f"❌ {ticker}: erro - {str(e)}")
        if cache_key in stock_cache:
            logger.info(f"   retornando cache anterior")
            return stock_cache[cache_key]
        return await get_fallback_data_with_selected_dy(ticker, selected_dy_source)


def get_mock_data(ticker: str, dy_source: str = "alpha_vantage") -> StockData:
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
        dy_source=dy_source,
        price_source="mock_data",
        price_status="mock_data",
        dy_status="fallback_metadata",
        status="mock_data"
    )


@app.get("/api/stocks", response_model=PortfolioData)
async def get_stocks(dy_source: Optional[str] = Query(default=None)):
    """Retorna todas as ações"""
    selected_dy_source = normalize_dy_source(dy_source)
    logger.info(f"📊 Buscando: {', '.join(settings.stocks_list)}")

    preloaded_price_data = None

    # Buscar em paralelo
    tasks = [
        fetch_stock_data(ticker, selected_dy_source, preloaded_price_data)
        for ticker in settings.stocks_list
    ]
    results = await asyncio.gather(*tasks)

    stocks = [stock for stock in results if stock is not None]

    return PortfolioData(
        stocks=stocks,
        last_update=datetime.now(timezone.utc).isoformat(),
        dy_source=selected_dy_source,
    )


@app.get("/api/stocks/{ticker}", response_model=StockData)
async def get_stock(ticker: str, dy_source: Optional[str] = Query(default=None)):
    """Retorna uma ação específica"""

    selected_dy_source = normalize_dy_source(dy_source)
    ticker = ticker.upper()

    if ticker not in settings.stocks_list:
        raise HTTPException(
            status_code=404,
            detail=f"{ticker} não monitorado. Disponíveis: {', '.join(settings.stocks_list)}"
        )

    stock_data = await fetch_stock_data(ticker, selected_dy_source)

    if not stock_data:
        raise HTTPException(
            status_code=500,
            detail=f"Sem dados para {ticker}"
        )

    return stock_data


@app.get("/api/dy-sources", response_model=DySourcesResponse)
async def get_dy_sources():
    """Retorna fontes de DY suportadas e fonte padrão"""
    ordered_sources = ["alpha_vantage", "finnhub", "yahoo_finance"]
    sources = [
        DySourceOption(value=source, label=DY_SOURCE_LABELS[source])
        for source in ordered_sources
        if source in VALID_DY_SOURCES
    ]

    return DySourcesResponse(
        default_source=normalize_dy_source(None),
        sources=sources,
    )


@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "stocks_monitored": settings.stocks_list,
        "cached_items": len(stock_cache),
        "api_configured": bool(settings.alpha_vantage_api_key),
        "default_dy_source": normalize_dy_source(None),
        "supported_dy_sources": sorted(list(VALID_DY_SOURCES)),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
