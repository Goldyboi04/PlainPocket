import os
from datetime import timedelta

class Config:
    """Application configuration."""
    SECRET_KEY = os.environ.get("SECRET_KEY", "plainpocket-dev-secret-key-change-in-prod")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "plainpocket-jwt-secret-key-change-in-prod")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plainpocket.db")
