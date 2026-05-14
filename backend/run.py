"""PlainPocket Backend Entry Point."""

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import Config
from app.db import init_db
from app.auth.routes import auth_bp
from app.upload.routes import upload_bp


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(Config)

    # Extensions
    CORS(app, origins=["http://localhost:5173"], supports_credentials=True)
    JWTManager(app)

    # Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(upload_bp)

    # Initialize database
    with app.app_context():
        init_db()

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", debug=True, port=5000)
