from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    alpha_vantage_api_key: str = ""
    finnhub_api_key: str = ""
    dy_data_source: str = "alpha_vantage"
    stocks: str = "NVDA,GE,CVX,X,CCJ,SQM,PLTR,MARA,LLY,WMT"
    update_interval: int = 60
    
    class Config:
        env_file = ".env"
    
    @property
    def stocks_list(self) -> List[str]:
        return [s.strip().upper() for s in self.stocks.split(",")]

    @property
    def normalized_dy_data_source(self) -> str:
        return self.dy_data_source.strip().lower()


settings = Settings()
