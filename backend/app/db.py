"""Database connection and initialization for PlainPocket (MySQL)."""

import pymysql
import time
from config import Config


def get_db():
    """Get a database connection with dictionary cursor."""
    return pymysql.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        password=Config.MYSQL_PASSWORD,
        database=Config.MYSQL_DB,
        cursorclass=pymysql.cursors.DictCursor
    )


def init_db():
    """Initialize the database with required tables."""
    retries = 5
    conn = None
    
    print(f"Connecting to MySQL at {Config.MYSQL_HOST}...")
    
    while retries > 0:
        try:
            conn = get_db()
            break
        except Exception as e:
            print(f"Database not ready... retrying in 5s ({retries} retries left). Error: {e}")
            retries -= 1
            time.sleep(5)
    
    if not conn:
        print("[ERROR] Could not connect to database.")
        return

    try:
        with conn.cursor() as cursor:
            # Users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    mobile VARCHAR(20) NOT NULL,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    currency VARCHAR(10) DEFAULT 'INR',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Bank Statements table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS bank_statements (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    bank_name VARCHAR(50) NOT NULL,
                    file_name VARCHAR(255) NOT NULL,
                    file_path VARCHAR(512) NOT NULL,
                    file_hash VARCHAR(64) NOT NULL,
                    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)

            # Transactions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS transactions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    statement_id INT NOT NULL,
                    user_id INT NOT NULL,
                    txn_date DATE NOT NULL,
                    description TEXT NOT NULL,
                    amount DECIMAL(15, 2) NOT NULL,
                    txn_type ENUM('debit', 'credit') NOT NULL,
                    category VARCHAR(100) DEFAULT 'Uncategorized',
                    balance DECIMAL(15, 2),
                    FOREIGN KEY (statement_id) REFERENCES bank_statements(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)
            # Budgets table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS budgets (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    category VARCHAR(100) DEFAULT 'Global',
                    amount DECIMAL(15, 2) NOT NULL,
                    month INT NOT NULL,
                    year INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_budget (user_id, category, month, year),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)
        conn.commit()
        print("[OK] Database initialized successfully.")
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
