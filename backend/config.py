import os
from datetime import timedelta

class Config:
    """Application configuration."""
    SECRET_KEY = os.environ.get("SECRET_KEY", "plainpocket-dev-secret-key-change-in-prod")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "plainpocket-jwt-secret-key-change-in-prod")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    
    # MySQL Configuration
    MYSQL_HOST = os.environ.get("MYSQL_HOST", "localhost")
    MYSQL_USER = os.environ.get("MYSQL_USER", "pp_user")
    MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "pp_password")
    MYSQL_DB = os.environ.get("MYSQL_DB", "plainpocket")
