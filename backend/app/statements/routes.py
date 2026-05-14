from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
import os

from app.db import get_db

statements_bp = Blueprint("statements", __name__, url_prefix="/api/statements")

@statements_bp.route("/", methods=["GET"])
@jwt_required()
def get_statements():
    """Fetch all bank statements for the logged-in user."""
    user_id = get_jwt_identity()
    db = get_db()
    try:
        with db.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, bank_name, file_name, upload_date
                FROM bank_statements
                WHERE user_id = %s
                ORDER BY upload_date DESC
                """,
                (user_id,)
            )
            statements = cursor.fetchall()
            
            # Format dates to string
            for stmt in statements:
                stmt['upload_date'] = stmt['upload_date'].isoformat()
                
            return jsonify({"success": True, "statements": statements}), 200
    except Exception as e:
        print(f"Error fetching statements: {e}")
        return jsonify({"success": False, "message": "Failed to fetch statements"}), 500
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
            # First, fetch the file path to delete the actual file
            cursor.execute(
                "SELECT file_path FROM bank_statements WHERE id = %s AND user_id = %s",
                (statement_id, user_id)
            )
            statement = cursor.fetchone()
            
            if not statement:
                return jsonify({"success": False, "message": "Statement not found or unauthorized"}), 404
            
            # Delete from database (transactions are deleted via CASCADE)
            cursor.execute(
                "DELETE FROM bank_statements WHERE id = %s AND user_id = %s",
                (statement_id, user_id)
            )
            db.commit()
            
            # Delete file from disk
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
