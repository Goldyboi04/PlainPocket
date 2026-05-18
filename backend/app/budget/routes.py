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
            # 1. Fetch category-wise budgets
            cursor.execute(
                "SELECT category, amount FROM budgets WHERE user_id = %s AND month = %s AND year = %s AND category != 'Global'",
                (user_id, month, year)
            )
            budget_rows = cursor.fetchall()
            category_budgets = {row['category']: float(row['amount']) for row in budget_rows}

            # 2. Overall budget limit is the sum of all category-specific budgets
            budget_limit = sum(category_budgets.values())
            
            # 3. Fetch total spending (all-time) to reflect on budget for testing with older statements
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

            # 4. Fetch category-wise breakdown (spent)
            cursor.execute(
                """
                SELECT category, SUM(amount) as spent
                FROM transactions
                WHERE user_id = %s AND txn_type = 'debit'
                GROUP BY category
                """,
                (user_id,)
            )
            spent_rows = cursor.fetchall()
            category_spent = {row['category'] or "Uncategorized": float(row['spent']) for row in spent_rows}
            
            # Define standard categories for budgeting (excluding 'Income')
            BUDGET_CATEGORIES = [
                "Food & Dining", "Transportation", "Utilities", "Shopping", 
                "Entertainment", "Healthcare", "Financial & Obligations", 
                "Savings & Investments", "Housing", "Personal Care", 
                "Bank Charges", "Uncategorized"
            ]
            
            # Merge standard and custom/predicted categories
            all_categories = set(BUDGET_CATEGORIES) | set(category_spent.keys()) | set(category_budgets.keys())
            all_categories.discard("Income")
            all_categories.discard("Global")
            
            # Format and sort (highest spent first, then by limit, then alphabetically)
            formatted_categories = []
            for cat in all_categories:
                spent_val = category_spent.get(cat, 0.0)
                limit_val = category_budgets.get(cat, 0.0)
                formatted_categories.append({
                    "name": cat,
                    "value": spent_val,  # for backward compatibility in charts
                    "spent": spent_val,
                    "limit": limit_val
                })
            
            formatted_categories.sort(key=lambda x: (-x["spent"], -x["limit"], x["name"]))
            
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
    """Set or update the monthly budget limit (Global or category-specific)."""
    user_id = get_jwt_identity()
    data = request.json
    amount = data.get("amount")
    category = data.get("category", "Global")
    
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
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE amount = VALUES(amount)
                """,
                (user_id, amount, month, year, category)
            )
            db.commit()
            return jsonify({"success": True, "message": "Budget updated successfully"}), 200
    except Exception as e:
        db.rollback()
        print(f"Error setting budget: {e}")
        return jsonify({"success": False, "message": "Failed to set budget"}), 500
    finally:
        db.close()

