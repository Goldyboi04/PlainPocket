from flask import Blueprint, jsonify, request
import os

from app.db import get_db
from flask_jwt_extended import jwt_required, get_jwt_identity

statements_bp = Blueprint("statements", __name__, url_prefix="/api/statements")


@statements_bp.route("/", methods=["GET"])
@jwt_required()
def get_statements():
    """Fetch all bank statements for the logged-in user with their date ranges."""
    user_id = get_jwt_identity()
    db = get_db()
    try:
        with db.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    bs.id,
                    bs.bank_name,
                    bs.file_name,
                    bs.upload_date,
                    MIN(t.txn_date) as date_from,
                    MAX(t.txn_date) as date_to,
                    COUNT(t.id) as txn_count,
                    SUM(CASE WHEN t.txn_type = 'debit' THEN t.amount ELSE 0 END) as total_debit,
                    SUM(CASE WHEN t.txn_type = 'credit' THEN t.amount ELSE 0 END) as total_credit
                FROM bank_statements bs
                LEFT JOIN transactions t ON t.statement_id = bs.id
                WHERE bs.user_id = %s
                GROUP BY bs.id, bs.bank_name, bs.file_name, bs.upload_date
                ORDER BY bs.upload_date DESC
                """,
                (user_id,)
            )
            statements = cursor.fetchall()

            for stmt in statements:
                stmt['upload_date'] = stmt['upload_date'].isoformat()
                stmt['date_from'] = stmt['date_from'].isoformat() if stmt['date_from'] else None
                stmt['date_to'] = stmt['date_to'].isoformat() if stmt['date_to'] else None
                stmt['total_debit'] = float(stmt['total_debit']) if stmt['total_debit'] else 0.0
                stmt['total_credit'] = float(stmt['total_credit']) if stmt['total_credit'] else 0.0

            return jsonify({"success": True, "statements": statements}), 200
    except Exception as e:
        print(f"Error fetching statements: {e}")
        return jsonify({"success": False, "message": "Failed to fetch statements"}), 500
    finally:
        db.close()


@statements_bp.route("/monthly-summary", methods=["GET"])
@jwt_required()
def monthly_summary():
    """Return statements grouped by month based on their transaction dates."""
    user_id = get_jwt_identity()
    db = get_db()
    try:
        with db.cursor() as cursor:
            # Get distinct months that have transactions, with aggregate stats
            cursor.execute(
                """
                SELECT
                    YEAR(t.txn_date) as year,
                    MONTH(t.txn_date) as month,
                    COUNT(DISTINCT t.statement_id) as statement_count,
                    COUNT(t.id) as txn_count,
                    SUM(CASE WHEN t.txn_type = 'debit' THEN t.amount ELSE 0 END) as total_debit,
                    SUM(CASE WHEN t.txn_type = 'credit' THEN t.amount ELSE 0 END) as total_income
                FROM transactions t
                WHERE t.user_id = %s
                GROUP BY YEAR(t.txn_date), MONTH(t.txn_date)
                ORDER BY year DESC, month DESC
                """,
                (user_id,)
            )
            month_groups = cursor.fetchall()

            # For each month, get the statements that contributed transactions in that month
            result = []
            for mg in month_groups:
                yr = mg['year']
                mo = mg['month']

                cursor.execute(
                    """
                    SELECT DISTINCT
                        bs.id,
                        bs.bank_name,
                        bs.file_name,
                        bs.upload_date,
                        COUNT(t.id) as txn_count_in_month,
                        SUM(CASE WHEN t.txn_type = 'debit' THEN t.amount ELSE 0 END) as debit_in_month,
                        SUM(CASE WHEN t.txn_type = 'credit' THEN t.amount ELSE 0 END) as credit_in_month
                    FROM bank_statements bs
                    JOIN transactions t ON t.statement_id = bs.id
                    WHERE t.user_id = %s
                    AND YEAR(t.txn_date) = %s AND MONTH(t.txn_date) = %s
                    GROUP BY bs.id, bs.bank_name, bs.file_name, bs.upload_date
                    ORDER BY bs.upload_date DESC
                    """,
                    (user_id, yr, mo)
                )
                stmts = cursor.fetchall()
                for s in stmts:
                    s['upload_date'] = s['upload_date'].isoformat()
                    s['debit_in_month'] = float(s['debit_in_month']) if s['debit_in_month'] else 0.0
                    s['credit_in_month'] = float(s['credit_in_month']) if s['credit_in_month'] else 0.0

                result.append({
                    "year": yr,
                    "month": mo,
                    "txn_count": mg['txn_count'],
                    "total_debit": float(mg['total_debit']) if mg['total_debit'] else 0.0,
                    "total_income": float(mg['total_income']) if mg['total_income'] else 0.0,
                    "statements": stmts
                })

            return jsonify({"success": True, "monthly_summary": result}), 200
    except Exception as e:
        print(f"Error fetching monthly summary: {e}")
        return jsonify({"success": False, "message": "Failed to fetch monthly summary"}), 500
    finally:
        db.close()


@statements_bp.route("/<int:statement_id>", methods=["DELETE"])
@jwt_required()
def delete_statement(statement_id):
    """Delete a bank statement and its transactions."""
    user_id = get_jwt_identity()
    db = get_db()
    try:
        with db.cursor() as cursor:
            cursor.execute(
                "SELECT file_path FROM bank_statements WHERE id = %s AND user_id = %s",
                (statement_id, user_id)
            )
            statement = cursor.fetchone()

            if not statement:
                return jsonify({"success": False, "message": "Statement not found or unauthorized"}), 404

            cursor.execute(
                "DELETE FROM bank_statements WHERE id = %s AND user_id = %s",
                (statement_id, user_id)
            )
            db.commit()

            file_path = statement['file_path']
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Warning: Failed to delete file {file_path}: {e}")

            return jsonify({"success": True, "message": "Statement deleted successfully"}), 200
    except Exception as e:
        db.rollback()
        print(f"Error deleting statement: {e}")
        return jsonify({"success": False, "message": "Failed to delete statement"}), 500
    finally:
        db.close()
