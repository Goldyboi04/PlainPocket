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
import calendar
from datetime import datetime
import numpy as np
from sklearn.linear_model import LinearRegression

@transactions_bp.route("/predictions", methods=["GET"])
@jwt_required()
def get_predictions():
    """
    ML-powered end-of-month spending predictions per category.

    Algorithm:
      1. Collect historical full-month debit totals per category.
      2. Fit a per-category LinearRegression on (month_index → total_spend).
         This captures the trend: is this category growing, shrinking, or flat?
      3. Blend the trend-based prediction with the current month's actual pace:
           pace_projection = (spent_so_far / days_elapsed) * days_in_month
           final = pace_weight * pace + (1 - pace_weight) * trend
         pace_weight grows linearly as the month progresses (max 0.8 at month-end).
      4. Join with the user's budget limits → compute budget_status.
      5. Assign confidence: high / medium / low based on data richness.
    """
    user_id = get_jwt_identity()
    db = get_db()

    try:
        now = datetime.now()
        cur_year, cur_month = now.year, now.month
        days_elapsed = now.day
        days_in_month = calendar.monthrange(cur_year, cur_month)[1]

        # Pace weight: 0 at day 1 → 0.8 at day 31
        pace_weight = min((days_elapsed / days_in_month) * 0.8, 0.8)
        trend_weight = 1.0 - pace_weight

        with db.cursor() as cursor:
            # ── 1. Historical full-month totals (exclude current month) ──────────
            cursor.execute(
                """
                SELECT
                    YEAR(txn_date)  AS y,
                    MONTH(txn_date) AS m,
                    category,
                    SUM(amount)     AS total
                FROM transactions
                WHERE user_id = %s
                  AND txn_type = 'debit'
                  AND NOT (YEAR(txn_date) = %s AND MONTH(txn_date) = %s)
                GROUP BY YEAR(txn_date), MONTH(txn_date), category
                ORDER BY y ASC, m ASC
                """,
                (user_id, cur_year, cur_month)
            )
            hist_rows = cursor.fetchall()

            # ── 2. Current month partial spend per category ───────────────────────
            cursor.execute(
                """
                SELECT category, SUM(amount) AS spent
                FROM transactions
                WHERE user_id = %s
                  AND txn_type = 'debit'
                  AND YEAR(txn_date) = %s AND MONTH(txn_date) = %s
                GROUP BY category
                """,
                (user_id, cur_year, cur_month)
            )
            cur_rows = cursor.fetchall()
            cur_spend = {
                (r['category'] or 'Uncategorized'): float(r['spent'])
                for r in cur_rows
            }

            # ── 3. Budget limits for current month ────────────────────────────────
            cursor.execute(
                """
                SELECT category, amount
                FROM budgets
                WHERE user_id = %s AND month = %s AND year = %s
                  AND category != 'Global'
                """,
                (user_id, cur_month, cur_year)
            )
            budget_rows = cursor.fetchall()
            budgets = {r['category']: float(r['amount']) for r in budget_rows}

        # ── 4. Pivot historical data into per-category time series ─────────────
        # Build a sorted list of (year, month) tuples that appear in history
        month_order = {}
        for row in hist_rows:
            key = (row['y'], row['m'])
            if key not in month_order:
                month_order[key] = len(month_order) + 1   # 1-indexed

        # cat → { month_index: total }
        cat_history = defaultdict(dict)
        for row in hist_rows:
            idx = month_order[(row['y'], row['m'])]
            cat = row['category'] or 'Uncategorized'
            cat_history[cat][idx] = float(row['total'])

        # Current month index = one step beyond the last historical index
        n_hist_months = len(month_order)
        cur_idx = n_hist_months + 1

        # Union of all categories seen in history OR current month
        all_cats = sorted(set(cat_history.keys()) | set(cur_spend.keys()))

        # ── 5. Fit per-category LinearRegression + blend ──────────────────────
        results = []
        for cat in all_cats:
            spent_so_far = cur_spend.get(cat, 0.0)
            history = cat_history.get(cat, {})
            budget_limit = budgets.get(cat, 0.0)
            n_hist = len(history)

            # ── ML: Weighted Linear Regression ───────────────────────────────
            if n_hist >= 2:
                # Sort history items by month index to ensure correct weight ordering
                sorted_history = sorted(history.items())
                X = np.array([item[0] for item in sorted_history]).reshape(-1, 1)
                y = np.array([item[1] for item in sorted_history])
                
                # Apply exponential weight decay (alpha = 0.8)
                # The most recent month gets weight 1.0, older months decay by 0.8 per month
                alpha = 0.8
                weights = np.array([alpha ** (n_hist - 1 - i) for i in range(n_hist)])
                
                model = LinearRegression()
                model.fit(X, y, sample_weight=weights)
                trend_pred = float(model.predict([[cur_idx]])[0])

                # Trend direction from slope
                slope = float(model.coef_[0])
                if slope > 50:
                    trend = "up"
                elif slope < -50:
                    trend = "down"
                else:
                    trend = "stable"
            elif n_hist == 1:
                # Only one historical month: use it as flat baseline
                trend_pred = list(history.values())[0]
                trend = "stable"
            else:
                # No history: extrapolate purely from pace
                trend_pred = (
                    (spent_so_far / days_elapsed) * days_in_month
                    if days_elapsed > 0 else spent_so_far
                )
                trend = "stable"

            # ── Pace projection ─────────────────────────────────────────────
            if days_elapsed > 0 and spent_so_far > 0:
                pace_proj = (spent_so_far / days_elapsed) * days_in_month
            else:
                pace_proj = trend_pred  # fallback: pure trend

            # ── Blend ────────────────────────────────────────────────────────
            predicted = pace_weight * pace_proj + trend_weight * trend_pred
            predicted = max(predicted, spent_so_far)   # never predict < already spent
            predicted = round(predicted, 2)

            # Historical average (all past months for this category)
            historical_avg = round(sum(history.values()) / n_hist, 2) if n_hist > 0 else 0.0

            # ── Confidence ───────────────────────────────────────────────────
            if days_elapsed >= 15 and n_hist >= 3:
                confidence = "high"
            elif days_elapsed >= 5 and n_hist >= 2:
                confidence = "medium"
            else:
                confidence = "low"

            # ── Budget status ────────────────────────────────────────────────
            if budget_limit > 0:
                ratio = predicted / budget_limit
                if ratio >= 1.0:
                    budget_status = "over_budget"
                elif ratio >= 0.8:
                    budget_status = "warning"
                else:
                    budget_status = "on_track"
            else:
                budget_status = "no_budget"

            results.append({
                "category":       cat,
                "spent_so_far":   round(spent_so_far, 2),
                "predicted_total": predicted,
                "historical_avg":  historical_avg,
                "trend":          trend,
                "confidence":     confidence,
                "budget_limit":   budget_limit,
                "budget_status":  budget_status,
            })

        # Sort: over_budget → warning → on_track / no_budget, then by predicted desc
        status_order = {"over_budget": 0, "warning": 1, "on_track": 2, "no_budget": 3}
        results.sort(key=lambda x: (status_order.get(x["budget_status"], 3), -x["predicted_total"]))

        # ── 6. Totals ─────────────────────────────────────────────────────────
        total_spent_so_far = round(sum(r["spent_so_far"] for r in results), 2)
        total_predicted    = round(sum(r["predicted_total"] for r in results), 2)
        total_hist_avg     = round(sum(r["historical_avg"] for r in results), 2)
        total_budget       = round(sum(budgets.values()), 2)

        if total_budget > 0:
            total_ratio = total_predicted / total_budget
            total_status = (
                "over_budget" if total_ratio >= 1.0
                else "warning" if total_ratio >= 0.8
                else "on_track"
            )
        else:
            total_status = "no_budget"

        month_names = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]

        return jsonify({
            "success":       True,
            "month_name":    f"{month_names[cur_month - 1]} {cur_year}",
            "days_elapsed":  days_elapsed,
            "days_in_month": days_in_month,
            "categories":    results,
            "total": {
                "spent_so_far":    total_spent_so_far,
                "predicted_total": total_predicted,
                "historical_avg":  total_hist_avg,
                "budget_limit":    total_budget,
                "budget_status":   total_status,
            }
        }), 200

    except Exception as e:
        print(f"Error generating predictions: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"success": False, "message": "Failed to generate predictions"}), 500
    finally:
        db.close()


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

