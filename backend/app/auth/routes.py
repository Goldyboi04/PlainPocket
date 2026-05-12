"""Authentication routes for PlainPocket."""

import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import bcrypt

from app.db import get_db

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def validate_email(email):
    """Basic email validation."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_mobile(mobile):
    """Validate Indian mobile number (10 digits)."""
    pattern = r'^\d{10}$'
    return re.match(pattern, mobile) is not None


@auth_bp.route("/signup", methods=["POST"])
def signup():
    """Register a new user."""
    data = request.get_json()

    # Extract fields
    name = data.get("name", "").strip()
    mobile = data.get("mobile", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    confirm_password = data.get("confirmPassword", "")

    # Validation
    errors = {}

    if not name or len(name) < 2:
        errors["name"] = "Name must be at least 2 characters."

    if not mobile or not validate_mobile(mobile):
        errors["mobile"] = "Enter a valid 10-digit mobile number."

    if not email or not validate_email(email):
        errors["email"] = "Enter a valid email address."

    if not password or len(password) < 6:
        errors["password"] = "Password must be at least 6 characters."

    if password != confirm_password:
        errors["confirmPassword"] = "Passwords do not match."

    if errors:
        return jsonify({"success": False, "errors": errors}), 400

    # Check if email already exists
    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        db.close()
        return jsonify({
            "success": False,
            "errors": {"email": "An account with this email already exists."}
        }), 409

    # Check if mobile already exists
    existing_mobile = db.execute("SELECT id FROM users WHERE mobile = ?", (mobile,)).fetchone()
    if existing_mobile:
        db.close()
        return jsonify({
            "success": False,
            "errors": {"mobile": "An account with this mobile number already exists."}
        }), 409

    # Hash password and insert
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    db.execute(
        "INSERT INTO users (name, mobile, email, password_hash) VALUES (?, ?, ?, ?)",
        (name, mobile, email, password_hash)
    )
    db.commit()

    # Get the newly created user
    user = db.execute("SELECT id, name, email FROM users WHERE email = ?", (email,)).fetchone()
    db.close()

    # Generate JWT
    access_token = create_access_token(identity=str(user["id"]))

    return jsonify({
        "success": True,
        "message": "Account created successfully!",
        "token": access_token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"]
        }
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """Authenticate a user and return JWT."""
    data = request.get_json()

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({
            "success": False,
            "errors": {"general": "Email and password are required."}
        }), 400

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    db.close()

    if not user:
        return jsonify({
            "success": False,
            "errors": {"general": "Invalid email or password."}
        }), 401

    # Verify password
    if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        return jsonify({
            "success": False,
            "errors": {"general": "Invalid email or password."}
        }), 401

    # Generate JWT
    access_token = create_access_token(identity=str(user["id"]))

    return jsonify({
        "success": True,
        "message": "Login successful!",
        "token": access_token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"]
        }
    }), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_profile():
    """Get current user's profile (protected route)."""
    user_id = get_jwt_identity()

    db = get_db()
    user = db.execute(
        "SELECT id, name, mobile, email, currency, created_at FROM users WHERE id = ?",
        (user_id,)
    ).fetchone()
    db.close()

    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404

    return jsonify({
        "success": True,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "mobile": user["mobile"],
            "email": user["email"],
            "currency": user["currency"],
            "createdAt": user["created_at"]
        }
    }), 200
