import os
import hashlib
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from app.db import get_db
from app.upload.parsers import get_parser

upload_bp = Blueprint("upload", __name__, url_prefix="/api/upload")

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'csv'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_hash(file_content):
    return hashlib.sha256(file_content).hexdigest()

@upload_bp.route("/statement", methods=["POST"])
@jwt_required()
def upload_statement():
    """Handle bank statement upload and parsing."""
    user_id = get_jwt_identity()
    
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "No file part"}), 400
    
    file = request.files['file']
    bank_name = request.form.get('bank_name')
    
    if not bank_name:
        return jsonify({"success": False, "message": "Bank name is required"}), 400
    
    if file.filename == '':
        return jsonify({"success": False, "message": "No selected file"}), 400
    
    if file and allowed_file(file.filename):
        file_content = file.read()
        file_hash = get_file_hash(file_content)
        
        db = get_db()
        try:
            # 1. Deduplication check (File Hash)
            with db.cursor() as cursor:
                cursor.execute(
                    "SELECT id FROM bank_statements WHERE user_id = %s AND file_hash = %s",
                    (user_id, file_hash)
                )
                if cursor.fetchone():
                    return jsonify({"success": False, "message": "This file has already been uploaded."}), 409
            
            # 2. Get Parser and Parse
            parser = get_parser(bank_name)
            if not parser:
                return jsonify({"success": False, "message": f"Bank '{bank_name}' is not supported yet."}), 400
            
            transactions = parser.parse(file_content)
            if not transactions:
                return jsonify({"success": False, "message": "No transactions found in the file. Please check the format."}), 400
            
            # 3. Save file to disk
            filename = secure_filename(file.filename)
            # Add user_id prefix to filename to avoid collisions
            stored_filename = f"{user_id}_{int(os.path.getmtime(UPLOAD_FOLDER) if os.path.exists(UPLOAD_FOLDER) else 0)}_{filename}"
            file_path = os.path.join(UPLOAD_FOLDER, stored_filename)
            
            # Reset file pointer and save
            file.seek(0)
            file.save(file_path)
            
            # 4. Insert Metadata
            with db.cursor() as cursor:
                cursor.execute(
                    """INSERT INTO bank_statements 
                       (user_id, bank_name, file_name, file_path, file_hash) 
                       VALUES (%s, %s, %s, %s, %s)""",
                    (user_id, bank_name, filename, file_path, file_hash)
                )
                statement_id = cursor.lastrowid
            
            # 5. Insert Transactions
            with db.cursor() as cursor:
                for txn in transactions:
                    cursor.execute(
                        """INSERT INTO transactions 
                           (statement_id, user_id, txn_date, description, amount, txn_type, balance) 
                           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                        (statement_id, user_id, txn['date'], txn['description'], txn['amount'], txn['type'], txn['balance'])
                    )
            
            db.commit()
            return jsonify({
                "success": True, 
                "message": f"Successfully imported {len(transactions)} transactions from {bank_name} statement.",
                "statement_id": statement_id
            }), 201
            
        except Exception as e:
            db.rollback()
            print(f"Upload error: {e}")
            return jsonify({"success": False, "message": "An error occurred during upload."}), 500
        finally:
            db.close()
            
    return jsonify({"success": False, "message": "Invalid file type. Only CSV is allowed."}), 400
