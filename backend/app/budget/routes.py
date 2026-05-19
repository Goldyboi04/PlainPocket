from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

from app.db import get_db

budget_bp = Blueprint("budget", __name__, url_prefix="/api/budget")

BUDGET_CATEGORIES = [
    "Food & Dining", "Transportation", "Utilities", "Shopping",
    "Entertainment", "Healthcare", "Financial & Obligations",
    "Savings & Investments", "Housing", "Personal Care",
    "Bank Charges", "Uncategorized"
]


@budget_bp.route("/", methods=["GET"])
@jwt_required()
def get_budget():
    """Fetch budget for a given month (defaults to current month)."""
    user_id = get_jwt_identity()
    now = datetime.now()
    month = request.args.get("month", default=now.month, type=int)
    year = request.args.get("year", default=now.year, type=int)

    db = get_db()
    try:
        with db.cursor() as cursor:
            # 1. Fetch category-wise budgets for this month
            cursor.execute(
                "SELECT category, amount FROM budgets WHERE user_id = %s AND month = %s AND year = %s AND category != 'Global'",
                (user_id, month, year)
            )
            budget_rows = cursor.fetchall()
            category_budgets = {row['category']: float(row['amount']) for row in budget_rows}

            # 1b. If no budget set for this past month, fall back to current month's budget
            is_current_month = (month == now.month and year == now.year)
            budget_inherited = False
            if not category_budgets and not is_current_month:
                cursor.execute(
                    "SELECT category, amount FROM budgets WHERE user_id = %s AND month = %s AND year = %s AND category != 'Global'",
                    (user_id, now.month, now.year)
                )
                fallback_rows = cursor.fetchall()
                if fallback_rows:
                    category_budgets = {row['category']: float(row['amount']) for row in fallback_rows}
                    budget_inherited = True

            # 2. Overall budget limit = sum of all category budgets
            budget_limit = sum(category_budgets.values())

            # 3. Fetch total spending for the requested month only
            cursor.execute(
                """
                SELECT SUM(amount) as spent
                FROM transactions
                WHERE user_id = %s
                AND txn_type = 'debit'
                AND MONTH(txn_date) = %s AND YEAR(txn_date) = %s
                """,
                (user_id, month, year)
            )
            spent_row = cursor.fetchone()
            total_spent = float(spent_row['spent']) if spent_row and spent_row['spent'] else 0.0

            # 4. Fetch category-wise spending for the requested month
            cursor.execute(
                """
                SELECT category, SUM(amount) as spent
                FROM transactions
                WHERE user_id = %s AND txn_type = 'debit'
                AND MONTH(txn_date) = %s AND YEAR(txn_date) = %s
                GROUP BY category
                """,
                (user_id, month, year)
            )
            spent_rows = cursor.fetchall()
            category_spent = {row['category'] or "Uncategorized": float(row['spent']) for row in spent_rows}

            # Merge standard and actual categories (exclude Income / Global)
            all_categories = set(BUDGET_CATEGORIES) | set(category_spent.keys()) | set(category_budgets.keys())
            all_categories.discard("Income")
            all_categories.discard("Global")

            formatted_categories = []
            for cat in all_categories:
                spent_val = category_spent.get(cat, 0.0)
                limit_val = category_budgets.get(cat, 0.0)
                formatted_categories.append({
                    "name": cat,
                    "value": spent_val,
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
                    "budget_inherited": budget_inherited,
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
    """Set or update the monthly budget limit for the current month."""
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


@budget_bp.route("/monthly-overview", methods=["GET"])
@jwt_required()
def monthly_overview():
    """Return per-month spending overview for all months that have transaction data."""
    user_id = get_jwt_identity()

    db = get_db()
    try:
        with db.cursor() as cursor:
            # Get all months that have debit transactions
            cursor.execute(
                """
                SELECT
                    YEAR(txn_date) as year,
                    MONTH(txn_date) as month,
                    SUM(CASE WHEN txn_type = 'debit' THEN amount ELSE 0 END) as total_spent,
                    SUM(CASE WHEN txn_type = 'credit' THEN amount ELSE 0 END) as total_income,
                    COUNT(*) as txn_count
                FROM transactions
                WHERE user_id = %s
                GROUP BY YEAR(txn_date), MONTH(txn_date)
                ORDER BY year DESC, month DESC
                """,
                (user_id,)
            )
            month_rows = cursor.fetchall()

            # Get all budgets for the user grouped by month/year
            cursor.execute(
                """
                SELECT month, year, SUM(amount) as total_budget
                FROM budgets
                WHERE user_id = %s AND category != 'Global'
                GROUP BY year, month
                """,
                (user_id,)
            )
            budget_rows = cursor.fetchall()
            budget_map = {(row['year'], row['month']): float(row['total_budget']) for row in budget_rows}

            months = []
            for row in month_rows:
                yr = row['year']
                mo = row['month']
                months.append({
                    "year": yr,
                    "month": mo,
                    "total_spent": float(row['total_spent']),
                    "total_income": float(row['total_income']),
                    "txn_count": row['txn_count'],
                    "budget_limit": budget_map.get((yr, mo), 0.0)
                })

            return jsonify({"success": True, "months": months}), 200
    except Exception as e:
        print(f"Error fetching monthly overview: {e}")
        return jsonify({"success": False, "message": "Failed to fetch monthly overview"}), 500
    finally:
        db.close()
