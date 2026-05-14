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

            # 2. Latest balance (most recent transaction)
            cursor.execute("""
                SELECT balance FROM transactions 
                WHERE user_id = %s 
                ORDER BY txn_date DESC, id DESC LIMIT 1
            """, (user_id,))
            balance_row = cursor.fetchone()
            current_balance = balance_row['balance'] if balance_row else 0

            # 3. Total spent (all debits) instead of just this month to avoid 0s on old dummy data
            cursor.execute("""
                SELECT SUM(amount) as spent 
                FROM transactions 
                WHERE user_id = %s AND txn_type = 'debit'
            """, (user_id,))
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
    """Update the category for a specific transaction and retrain the model."""
    user_id = get_jwt_identity()
    data = request.json
    new_category = data.get("category")
    
    if not new_category:
        return jsonify({"success": False, "message": "Category is required"}), 400
        
    db = get_db()
    try:
        with db.cursor() as cursor:
            # First verify the transaction belongs to the user
            cursor.execute("SELECT id FROM transactions WHERE id = %s AND user_id = %s", (txn_id, user_id))
            if not cursor.fetchone():
                return jsonify({"success": False, "message": "Transaction not found or unauthorized"}), 404
                
            # Update the category
            cursor.execute(
                "UPDATE transactions SET category = %s WHERE id = %s AND user_id = %s",
                (new_category, txn_id, user_id)
            )
            db.commit()
            
        # Trigger dynamic retraining in the background or synchronously
        # For this lightweight model, synchronous retraining takes <10ms
        retrain_model_with_db(db)
            
        return jsonify({"success": True, "message": "Category updated and model retrained"}), 200
    except Exception as e:
        db.rollback()
        print(f"Error updating category: {e}")
        return jsonify({"success": False, "message": "Failed to update category"}), 500
    finally:
        db.close()
