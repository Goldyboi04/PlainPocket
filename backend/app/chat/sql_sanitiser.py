"""
SQL Sanitiser — Security layer for LLM-generated SQL queries.

Ensures:
  1. Only SELECT statements are allowed
  2. user_id filter is always present
  3. LIMIT clause is enforced
"""

import re


# Dangerous keywords that must never appear in a query
_DANGEROUS_KEYWORDS = re.compile(
    r'\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC|EXECUTE|CALL|SET)\b',
    re.IGNORECASE
)

# Match existing LIMIT clause
_LIMIT_PATTERN = re.compile(r'\bLIMIT\s+\d+', re.IGNORECASE)

# Match user_id filter
_USER_ID_PATTERN = re.compile(r'user_id\s*=\s*(%s|\d+)', re.IGNORECASE)


def is_read_only(sql: str) -> bool:
    """Check if a SQL string is read-only (SELECT only)."""
    stripped = sql.strip().rstrip(';').strip()

    # Must start with SELECT (or WITH for CTEs)
    if not re.match(r'^(SELECT|WITH)\b', stripped, re.IGNORECASE):
        return False

    # Must not contain dangerous keywords
    if _DANGEROUS_KEYWORDS.search(stripped):
        return False

    # Check for multiple statements (semicolons followed by new statements)
    # Allow semicolons at the very end only
    parts = [p.strip() for p in stripped.split(';') if p.strip()]
    if len(parts) > 1:
        return False

    return True


def validate_and_sanitise(sql: str, user_id: int, max_limit: int = 100) -> tuple[bool, str, str]:
    """
    Validate and sanitise LLM-generated SQL.

    Returns:
        (is_valid, sanitised_sql, error_message)
    """
    if not sql or not sql.strip():
        return False, "", "Empty SQL query"

    sql = sql.strip().rstrip(';').strip()

    # 1. Read-only check
    if not is_read_only(sql):
        return False, "", "Only SELECT queries are allowed. The generated query was rejected for safety."

    # 2. Inject user_id filter if missing
    if not _USER_ID_PATTERN.search(sql):
        # Try to insert after WHERE clause
        if re.search(r'\bWHERE\b', sql, re.IGNORECASE):
            sql = re.sub(
                r'\bWHERE\b',
                f'WHERE user_id = {user_id} AND',
                sql,
                count=1,
                flags=re.IGNORECASE
            )
        else:
            # No WHERE clause at all — find the right place to add one
            # Insert before GROUP BY, ORDER BY, HAVING, LIMIT, or end
            insert_pattern = re.compile(
                r'(\bGROUP\s+BY\b|\bORDER\s+BY\b|\bHAVING\b|\bLIMIT\b)',
                re.IGNORECASE
            )
            match = insert_pattern.search(sql)
            if match:
                pos = match.start()
                sql = sql[:pos] + f' WHERE user_id = {user_id} ' + sql[pos:]
            else:
                sql += f' WHERE user_id = {user_id}'
    else:
        # Replace the placeholder or existing user_id value with the actual user_id
        sql = re.sub(
            r'user_id\s*=\s*(%s|\d+|{user_id})',
            f'user_id = {user_id}',
            sql,
            flags=re.IGNORECASE
        )

    # 3. Enforce LIMIT
    if not _LIMIT_PATTERN.search(sql):
        sql += f' LIMIT {max_limit}'

    return True, sql, ""
