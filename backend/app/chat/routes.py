"""
Chat with Statement — Natural Language to SQL via Google Gemini.

Endpoints:
  POST /api/chat           — Accepts a plain-language question, returns SQL + results
  GET  /api/chat/suggestions — Returns curated example questions
"""

import json
import re
import traceback

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from google import genai
from openai import OpenAI

from config import Config
from app.db import get_db
from app.chat.sql_sanitiser import validate_and_sanitise

chat_bp = Blueprint("chat", __name__, url_prefix="/api/chat")

# ── Clients (initialised lazily) ──────────────────────────────────────────────
_client = None
_openai_client = None

def _get_client():
    global _client
    if _client is None:
        api_key = Config.GEMINI_API_KEY
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set. Add it to backend/.env")
        _client = genai.Client(api_key=api_key)
    return _client

def _get_openai_client():
    global _openai_client
    if _openai_client is None:
        api_key = Config.OPENAI_API_KEY
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set. Add it to backend/.env")
        _openai_client = OpenAI(
            api_key=api_key,
            base_url=Config.OPENAI_BASE_URL
        )
    return _openai_client


# ── System prompt ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a SQL query generator for a personal finance app called PlainPocket.
The user will ask questions about their financial data in plain English.
You must generate a valid MySQL SELECT query to answer their question.

DATABASE SCHEMA:

TABLE: transactions
  - id INT (primary key)
  - statement_id INT (FK to bank_statements)
  - user_id INT (FK to users)
  - txn_date DATE
  - description TEXT (raw transaction description/merchant name)
  - amount DECIMAL(15,2) (always positive; use txn_type to determine direction)
  - txn_type ENUM('debit', 'credit')  — debit = money spent, credit = money received
  - category VARCHAR(100) — e.g. 'Food & Dining', 'Transportation', 'Utilities', 'Shopping',
      'Entertainment', 'Healthcare', 'Financial & Obligations', 'Savings & Investments',
      'Housing', 'Personal Care', 'Bank Charges', 'Income', 'Uncategorized'
  - balance DECIMAL(15,2)

TABLE: bank_statements
  - id INT (primary key)
  - user_id INT
  - bank_name VARCHAR(50) — e.g. 'HDFC', 'SBI', 'ICICI', 'AXIS'
  - file_name VARCHAR(255)
  - file_hash VARCHAR(64)
  - upload_date TIMESTAMP

TABLE: budgets
  - id INT (primary key)
  - user_id INT
  - category VARCHAR(100)
  - amount DECIMAL(15,2) — the budget limit
  - month INT (1-12)
  - year INT

RULES:
1. ONLY generate SELECT queries. Never INSERT, UPDATE, DELETE, DROP, or ALTER.
2. ALWAYS filter by user_id = {user_id} in every query.
3. Use MySQL syntax (DATE functions like MONTH(), YEAR(), DATE_FORMAT(), CURDATE()).
4. Add LIMIT 100 unless the user asks for a specific count.
5. For "spending" or "expense" questions, filter txn_type = 'debit'.
6. For "income" or "earnings" questions, filter txn_type = 'credit'.
7. When the user says "this month", use MONTH(CURDATE()) and YEAR(CURDATE()).
8. When the user says "last month", subtract 1 from the current month appropriately.
9. Format aggregated amounts using ROUND(..., 2).
10. Use meaningful column aliases (e.g. AS total_spent, AS category_name).

Respond ONLY with a valid JSON object in this exact format (no markdown, no code fences):
{"sql": "<the MySQL SELECT query>", "explanation": "<1-2 sentence plain-English explanation of what this query does>"}
"""


# ── Suggested queries ─────────────────────────────────────────────────────────
SUGGESTIONS = [
    {
        "group": "Spending Overview",
        "queries": [
            "How much did I spend this month?",
            "What is my total spending for 2026?",
            "What is my average daily spending this month?",
        ]
    },
    {
        "group": "Category Analysis",
        "queries": [
            "What's my top spending category this month?",
            "Show spending by category for this month",
            "How much did I spend on Food & Dining in the last 3 months?",
        ]
    },
    {
        "group": "Merchants & Transactions",
        "queries": [
            "Show my top 5 merchants by spending",
            "What are my largest 10 transactions?",
            "List all transactions above ₹5000",
        ]
    },
    {
        "group": "Trends & Comparison",
        "queries": [
            "Compare my spending in April vs May 2026",
            "Show my monthly spending trend for this year",
            "Which month did I spend the most this year?",
        ]
    },
    {
        "group": "Banking & Income",
        "queries": [
            "Show spending breakdown by bank",
            "What is my total income this month?",
            "Show my balance trend over time",
        ]
    },
    {
        "group": "Budget",
        "queries": [
            "Show my budget limits for this month",
            "Which categories are over budget?",
        ]
    },
]


# ── Routes ────────────────────────────────────────────────────────────────────

@chat_bp.route("/", methods=["POST"])
@jwt_required()
def chat():
    """Accept a natural language question, generate SQL via Gemini, execute, and return results."""
    user_id = get_jwt_identity()
    data = request.json
    question = (data or {}).get("question", "").strip()

    if not question:
        return jsonify({"success": False, "message": "Please provide a question"}), 400

    if len(question) > 500:
        return jsonify({"success": False, "message": "Question is too long (max 500 characters)"}), 400

    # ── 1. Call LLM (OpenAI or Gemini) ────────────────────────────────────────
    prompt = SYSTEM_PROMPT.replace("{user_id}", str(user_id))
    raw_text = None

    if Config.OPENAI_API_KEY:
        try:
            openai_client = _get_openai_client()
            response = openai_client.chat.completions.create(
                model=Config.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": question}
                ],
                temperature=0.0,
            )
            raw_text = response.choices[0].message.content.strip()
        except Exception as e:
            error_str = str(e)
            print(f"OpenAI API error: {error_str}")
            traceback.print_exc()
            return jsonify({
                "success": False,
                "message": f"Failed to reach OpenAI service: {error_str}"
            }), 502
    else:
        try:
            client = _get_client()
        except RuntimeError as e:
            return jsonify({"success": False, "message": str(e)}), 500

        try:
            response = client.models.generate_content(
                model=Config.GEMINI_MODEL,
                contents=f"{prompt}\n\nUser question: {question}",
            )
            raw_text = response.text.strip()
        except Exception as e:
            error_str = str(e)
            print(f"Gemini API error: {error_str}")
            traceback.print_exc()

            # Detect rate limit / quota errors
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                return jsonify({
                    "success": False,
                    "message": "⏳ Gemini API rate limit reached. Please wait 30 seconds and try again. If this persists, your daily free-tier quota may be exhausted."
                }), 429
            
            if "API_KEY_INVALID" in error_str or "401" in error_str:
                return jsonify({
                    "success": False,
                    "message": "🔑 Invalid Gemini API key. Please check your GEMINI_API_KEY in the .env file."
                }), 401

            return jsonify({
                "success": False,
                "message": "Failed to reach the AI service. Please try again."
            }), 502

    # ── 2. Parse Gemini response ──────────────────────────────────────────────
    try:
        # Strip markdown code fences if present
        cleaned = raw_text
        if cleaned.startswith("```"):
            cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
            cleaned = re.sub(r'```\s*$', '', cleaned)
        
        parsed = json.loads(cleaned)
        sql = parsed.get("sql", "").strip()
        explanation = parsed.get("explanation", "").strip()
    except (json.JSONDecodeError, AttributeError) as e:
        print(f"Failed to parse Gemini response: {raw_text}")
        return jsonify({
            "success": False,
            "message": "The AI returned an unexpected response format. Please rephrase your question.",
            "raw_response": raw_text
        }), 422

    if not sql:
        return jsonify({
            "success": False,
            "message": "The AI could not generate a query for this question. Try rephrasing.",
        }), 422

    # ── 3. Validate & sanitise SQL ────────────────────────────────────────────
    is_valid, sanitised_sql, error_msg = validate_and_sanitise(sql, user_id)

    if not is_valid:
        return jsonify({
            "success": False,
            "message": error_msg,
            "sql": sql,
            "explanation": explanation,
        }), 400

    # ── 4. Execute the query ──────────────────────────────────────────────────
    db = get_db()
    try:
        with db.cursor() as cursor:
            cursor.execute(sanitised_sql)
            rows = cursor.fetchall()

            # Extract column names from cursor description
            columns = [desc[0] for desc in cursor.description] if cursor.description else []

            # Serialise — convert non-JSON-safe types
            serialised_rows = []
            for row in rows:
                clean_row = {}
                for key, val in row.items():
                    if hasattr(val, 'isoformat'):
                        clean_row[key] = val.isoformat()
                    elif isinstance(val, (int, float, str, bool, type(None))):
                        clean_row[key] = val
                    else:
                        clean_row[key] = str(val)
                serialised_rows.append(clean_row)

            return jsonify({
                "success": True,
                "sql": sanitised_sql,
                "explanation": explanation,
                "columns": columns,
                "results": serialised_rows,
                "row_count": len(serialised_rows),
            }), 200

    except Exception as e:
        error_str = str(e)
        print(f"SQL execution error: {error_str}")
        return jsonify({
            "success": False,
            "message": f"Query execution failed: {error_str}",
            "sql": sanitised_sql,
            "explanation": explanation,
        }), 400
    finally:
        db.close()


@chat_bp.route("/suggestions", methods=["GET"])
@jwt_required()
def get_suggestions():
    """Return curated example queries grouped by category."""
    return jsonify({
        "success": True,
        "suggestions": SUGGESTIONS
    }), 200
