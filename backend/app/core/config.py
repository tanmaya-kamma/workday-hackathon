"""
Core configuration — reads environment variables with Pydantic Settings.

All app-wide settings are centralized here. Values come from .env file
or actual environment variables (env vars take precedence).
"""

# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # -- Application --
    app_name: str = "Workday Leave Management System"
    app_version: str = "0.1.0"
    debug: bool = False

    # -- MongoDB --
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "LMS"

    # -- JWT --
    jwt_secret_key: str = "change-me-to-a-random-secret-key"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 480  # 8 hours

    # -- CORS --
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # -- Jira --
    jira_base_url: str = "https://meiyappansworkspace-43655612.atlassian.net"
    jira_project_key: str = "KAN"
    jira_email: str = "meiyappanmeenal2005@gmail.com"
    jira_api_token: str = "ATATT3xFfGF0hNPLRxWdyxZG29vr3oObvWD_Dy9IOkbhZH_m-6fnsglIOVe8YMz0iVIAG9OyaO4RXHD_V4vNhpWihZ2CQ21dEEvxedytbPoeKSZ9fB3wNdQ6emmVd9Xzbu9uL0wMs9LxQwP9EhsHEnuotDBwmr-Thl5JEIF6zNaimy8w6eWwJ4w=0700597F"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore",
    }


# Singleton instance — import this throughout the app.
settings = Settings()
