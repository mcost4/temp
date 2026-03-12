from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    alpha_vantage_api_key: str = ""
    stocks: str = "NVDA,GE,CVX"
    update_interval: int = 60
    
    class Config:
        env_file = ".env"
    
    @property
    def stocks_list(self) -> List[str]:
        return [s.strip().upper() for s in self.stocks.split(",")]


settings = Settings()
