from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

from app.db import get_db

budget_bp = Blueprint("budget", __name__, url_prefix="/api/budget")

@budget_bp.route("/", methods=["GET"])
@jwt_required()
def get_budget():
    """Fetch budget for the current month and progress."""
    user_id = get_jwt_identity()
    now = datetime.now()
    month = now.month
    year = now.year
    
    db = get_db()
    try:
        with db.cursor() as cursor:
            # 1. Fetch budget limit
            cursor.execute(
                "SELECT amount FROM budgets WHERE user_id = %s AND month = %s AND year = %s AND category = 'Global'",
                (user_id, month, year)
            )
            budget_row = cursor.fetchone()
            budget_limit = float(budget_row['amount']) if budget_row else 0.0
            
            # 2. Fetch total spending (all-time) to reflect on budget for testing with older statements
            cursor.execute(
                """
                SELECT SUM(amount) as spent 
                FROM transactions 
                WHERE user_id = %s 
                AND txn_type = 'debit' 
                """,
                (user_id,)
            )
            spent_row = cursor.fetchone()
            total_spent = float(spent_row['spent']) if spent_row and spent_row['spent'] else 0.0

            # 3. Fetch category-wise breakdown
            cursor.execute(
                """
                SELECT category, SUM(amount) as spent
                FROM transactions
                WHERE user_id = %s AND txn_type = 'debit'
                GROUP BY category
                ORDER BY spent DESC
                """,
                (user_id,)
            )
            category_spent = cursor.fetchall()
            # Convert decimal to float for JSON serialization
            formatted_categories = [
                {"name": row['category'] or "Uncategorized", "value": float(row['spent'])}
                for row in category_spent
            ]
            
            return jsonify({
                "success": True,
                "budget": {
                    "limit": budget_limit,
                    "spent": total_spent,
                    "month": month,
                    "year": year,
                    "categories": formatted_categories
                }
            }), 200
    except Exception as e:
        print(f"Error fetching budget: {e}")
        return jsonify({"success": False, "message": "Failed to fetch budget"}), 500
    finally:
        db.close()

@budget_bp.route("/", methods=["POST"])
@jwt_required()
def set_budget():
    """Set or update the monthly budget limit."""
    user_id = get_jwt_identity()
    data = request.json
    amount = data.get("amount")
    
    if amount is None:
        return jsonify({"success": False, "message": "Budget amount is required"}), 400
        
    now = datetime.now()
    month = now.month
    year = now.year
    
    db = get_db()
    try:
        with db.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO budgets (user_id, amount, month, year, category)
                VALUES (%s, %s, %s, %s, 'Global')
                ON DUPLICATE KEY UPDATE amount = VALUES(amount)
                """,
                (user_id, amount, month, year)
            )
            db.commit()
            return jsonify({"success": True, "message": "Budget updated successfully"}), 200
    except Exception as e:
        db.rollback()
        print(f"Error setting budget: {e}")
        return jsonify({"success": False, "message": "Failed to set budget"}), 500
    finally:
        db.close()
