from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.db import get_db
from app.analysis.categorizer import retrain_model_with_db

transactions_bp = Blueprint("transactions", __name__, url_prefix="/api/transactions")

@transactions_bp.route("/", methods=["GET"])
@jwt_required()
def get_transactions():
    """Fetch all transactions for the logged-in user."""
    user_id = get_jwt_identity()
    limit = request.args.get('limit', default=100, type=int)
    db = get_db()
    try:
        with db.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, txn_date, description, amount, txn_type, category, balance
                FROM transactions
                WHERE user_id = %s
                ORDER BY txn_date DESC
                LIMIT %s
                """,
                (user_id, limit)
            )
            transactions = cursor.fetchall()
            
            # Format dates to string
            for txn in transactions:
                txn['txn_date'] = txn['txn_date'].isoformat()
                
            return jsonify({"success": True, "transactions": transactions}), 200
    except Exception as e:
        print(f"Error fetching transactions: {e}")
        return jsonify({"success": False, "message": "Failed to fetch transactions"}), 500
    finally:
        db.close()

@transactions_bp.route("/summary", methods=["GET"])
@jwt_required()
def get_summary():
    """Fetch accurate aggregate metrics for the dashboard."""
    user_id = get_jwt_identity()
    db = get_db()
    try:
        with db.cursor() as cursor:
            # 1. Total transactions count
            cursor.execute("SELECT COUNT(*) as total FROM transactions WHERE user_id = %s", (user_id,))
            total_txns = cursor.fetchone()['total'] or 0

            # 2. Latest balance (sum of latest balance from each unique bank)
            cursor.execute("""
                SELECT SUM(t.balance) as total_balance
                FROM transactions t
                JOIN (
                    SELECT bs.bank_name, MAX(t2.id) as latest_id
                    FROM transactions t2
                    JOIN bank_statements bs ON t2.statement_id = bs.id
                    WHERE t2.user_id = %s
                    GROUP BY bs.bank_name
                ) as latest_txns ON t.id = latest_txns.latest_id
            """, (user_id,))
            balance_row = cursor.fetchone()
            current_balance = float(balance_row['total_balance']) if balance_row and balance_row['total_balance'] else 0

            # 3. Total spent (current month only)
            from datetime import datetime
            now = datetime.now()
            cursor.execute("""
                SELECT SUM(amount) as spent 
                FROM transactions 
                WHERE user_id = %s AND txn_type = 'debit'
                AND MONTH(txn_date) = %s AND YEAR(txn_date) = %s
            """, (user_id, now.month, now.year))
            spent_row = cursor.fetchone()
            total_spent = spent_row['spent'] if spent_row and spent_row['spent'] else 0

            return jsonify({
                "success": True,
                "summary": {
                    "total_transactions": total_txns,
                    "current_balance": current_balance,
                    "total_spent": total_spent
                }
            }), 200
    except Exception as e:
        print(f"Error fetching summary: {e}")
        return jsonify({"success": False, "message": "Failed to fetch summary"}), 500
    finally:
        db.close()

@transactions_bp.route("/<int:txn_id>/category", methods=["PUT"])
@jwt_required()
def update_category(txn_id):
    """Update the category for all transactions with the same name/description."""
    user_id = get_jwt_identity()
    data = request.json
    new_category = data.get("category")
    
    if not new_category:
        return jsonify({"success": False, "message": "Category is required"}), 400
        
    db = get_db()
    try:
        with db.cursor() as cursor:
            # First fetch the transaction description to verify ownership and find duplicates
            cursor.execute(
                "SELECT description FROM transactions WHERE id = %s AND user_id = %s",
                (txn_id, user_id)
            )
            row = cursor.fetchone()
            if not row:
                return jsonify({"success": False, "message": "Transaction not found or unauthorized"}), 404
                
            description = row['description']
            
            # Update all transactions with the same description for this user
            cursor.execute(
                "UPDATE transactions SET category = %s WHERE description = %s AND user_id = %s",
                (new_category, description, user_id)
            )
            db.commit()
            
        # Trigger dynamic retraining in the background or synchronously
        # For this lightweight model, retraining takes <10ms
        retrain_model_with_db(db)
            
        return jsonify({
            "success": True,
            "message": "Categories updated and model retrained",
            "description": description
        }), 200
    except Exception as e:
        db.rollback()
        print(f"Error updating category: {e}")
        return jsonify({"success": False, "message": "Failed to update category"}), 500
    finally:
        db.close()


@transactions_bp.route("/months", methods=["GET"])
@jwt_required()
def get_transaction_months():
    """Return distinct (year, month) pairs that have transaction data for the user."""
    user_id = get_jwt_identity()
    db = get_db()
    try:
        with db.cursor() as cursor:
            cursor.execute(
                """
                SELECT DISTINCT
                    YEAR(txn_date) as year,
                    MONTH(txn_date) as month
                FROM transactions
                WHERE user_id = %s
                ORDER BY year DESC, month DESC
                """,
                (user_id,)
            )
            months = cursor.fetchall()
            return jsonify({"success": True, "months": months}), 200
    except Exception as e:
        print(f"Error fetching transaction months: {e}")
        return jsonify({"success": False, "message": "Failed to fetch months"}), 500
    finally:
        db.close()


from collections import defaultdict

@transactions_bp.route("/trends", methods=["GET"])
@jwt_required()
def get_trends():
    """Fetch pivoted category-wise monthly trends and automatic insights."""
    user_id = get_jwt_identity()
    db = get_db()
    
    month_names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    
    try:
        with db.cursor() as cursor:
            # Aggregate monthly debit amounts per category
            cursor.execute(
                """
                SELECT YEAR(txn_date) as y, MONTH(txn_date) as m, category, SUM(amount) as total
                FROM transactions
                WHERE user_id = %s AND txn_type = 'debit'
                GROUP BY YEAR(txn_date), MONTH(txn_date), category
                ORDER BY y ASC, m ASC
                """,
                (user_id,)
            )
            rows = cursor.fetchall()
            
            # Pivot the rows
            month_map = defaultdict(dict)
            all_categories = set()
            
            for row in rows:
                key = f"{row['y']}-{row['m']}"
                month_label = f"{month_names[row['m'] - 1]} {row['y']}"
                
                month_map[key]["month"] = month_label
                month_map[key]["year"] = row['y']
                month_map[key]["month_num"] = row['m']
                month_map[key][row['category']] = float(row['total'])
                all_categories.add(row['category'])
            
            # Convert to sorted list
            trends_data = list(month_map.values())
            trends_data.sort(key=lambda x: (x["year"], x["month_num"]))
            
            # Fill missing categories with 0.0 for consistency
            categories_list = sorted(list(all_categories))
            for item in trends_data:
                for cat in categories_list:
                    if cat not in item:
                        item[cat] = 0.0
            
            # Generate MoM velocity insights
            insights = []
            if len(trends_data) >= 2:
                current = trends_data[-1]
                previous = trends_data[-2]
                
                for cat in categories_list:
                    curr_val = current.get(cat, 0.0)
                    prev_val = previous.get(cat, 0.0)
                    
                    if prev_val > 0:
                        change_pct = ((curr_val - prev_val) / prev_val) * 100
                        if abs(change_pct) >= 10:
                            insights.append({
                                "category": cat,
                                "direction": "up" if change_pct > 0 else "down",
                                "percentage": round(abs(change_pct), 1),
                                "text": f"Your {cat} spending is {'up' if change_pct > 0 else 'down'} by {abs(change_pct):.0f}% compared to last month."
                            })
                            
            insights.sort(key=lambda x: -x["percentage"])
            
            return jsonify({
                "success": True,
                "categories": categories_list,
                "trends": trends_data,
                "insights": insights
            }), 200
    except Exception as e:
        print(f"Error generating trends: {e}")
        return jsonify({"success": False, "message": "Failed to fetch category trends"}), 500
    finally:
        db.close()

