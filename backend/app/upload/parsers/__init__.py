from abc import ABC, abstractmethod
import csv
import io
from datetime import datetime
from dateutil import parser as date_parser

class BaseParser(ABC):
    """Base class for all bank statement parsers."""
    
    @abstractmethod
    def parse(self, file_content):
        """Parse file content and return a list of normalized transactions."""
        pass

    def _clean_amount(self, value):
        """Helper to convert string amount to float."""
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        
        # Remove commas and handle parentheses for negative numbers
        clean_val = str(value).replace(',', '').strip()
        if not clean_val or clean_val == '-':
            return 0.0
            
        if clean_val.startswith('(') and clean_val.endswith(')'):
            try:
                return -float(clean_val[1:-1])
            except ValueError:
                return 0.0
        
        try:
            return float(clean_val)
        except ValueError:
            return 0.0

class SmartParser(BaseParser):
    """A generic parser that automatically detects columns based on keywords."""
    
    KEYWORDS_MAP = {
        'date': ['date', 'txn date', 'transaction date', 'value date', 'txndate', 'tran date'],
        'description': ['narration', 'description', 'particulars', 'remarks', 'memo', 'transaction details'],
        'withdrawal': ['withdrawal', 'debit', 'dr', 'withdrawal amt', 'withdrawal amount', 'amt debit', 'payment'],
        'deposit': ['deposit', 'credit', 'cr', 'deposit amt', 'deposit amount', 'amt credit', 'receipt'],
        'balance': ['balance', 'closing balance', 'available balance', 'running balance', 'bal']
    }

    def _find_header_and_mapping(self, lines):
        """Scan lines to find the header row and map columns to standard keys."""
        for i, line in enumerate(lines[:30]): # Check first 30 lines for headers
            # Try to split by comma
            cols = [c.strip().lower() for c in line.split(',')]
            mapping = {}
            matches = 0
            
            for standard_key, keywords in self.KEYWORDS_MAP.items():
                for j, col in enumerate(cols):
                    # Check for exact match or if any keyword is in the column header
                    if col in keywords or any(kw in col for kw in keywords):
                        mapping[standard_key] = j
                        matches += 1
                        break
            
            # If we found at least 3 standard columns (date, description, and one amount/balance)
            if matches >= 3 and 'date' in mapping and 'description' in mapping:
                return i, mapping
        return None, None

    def parse(self, file_content):
        transactions = []
        try:
            decoded_content = file_content.decode('utf-8', errors='ignore')
        except:
            decoded_content = file_content.decode('latin-1', errors='ignore')
            
        lines = [line.strip() for line in decoded_content.splitlines() if line.strip()]
        header_idx, mapping = self._find_header_and_mapping(lines)
        
        if header_idx is None:
            return []

        # Parse data rows starting from the line after the header
        # Using StringIO and csv.reader to handle quoted fields correctly
        data_stream = io.StringIO('\n'.join(lines[header_idx + 1:]))
        reader = csv.reader(data_stream)
        
        max_col_idx = max(mapping.values())
        
        for row in reader:
            if not row or len(row) <= max_col_idx:
                continue
                
            try:
                date_str = row[mapping['date']]
                if not date_str.strip(): continue
                
                # Use dateutil for flexible parsing
                txn_date = date_parser.parse(date_str, dayfirst=True).date()
                
                desc = row[mapping['description']]
                
                withdrawal = 0.0
                deposit = 0.0
                
                if 'withdrawal' in mapping:
                    withdrawal = self._clean_amount(row[mapping['withdrawal']])
                if 'deposit' in mapping:
                    deposit = self._clean_amount(row[mapping['deposit']])
                
                # Determine type and amount
                if withdrawal > 0:
                    amount = withdrawal
                    txn_type = 'debit'
                elif deposit > 0:
                    amount = deposit
                    txn_type = 'credit'
                else:
                    # If both are 0 or only one column exists, use deposit as fallback
                    amount = deposit if deposit != 0 else withdrawal
                    txn_type = 'credit' if deposit != 0 else 'debit'

                balance = 0.0
                if 'balance' in mapping:
                    balance = self._clean_amount(row[mapping['balance']])
                
                txn = {
                    'date': txn_date,
                    'description': desc,
                    'amount': abs(amount),
                    'type': txn_type,
                    'balance': balance
                }
                transactions.append(txn)
            except Exception:
                continue
                
        return transactions

class HDFCParser(SmartParser):
    """Specific parser for HDFC, now using SmartParser logic for robustness."""
    pass

class SBIParser(SmartParser):
    """Specific parser for SBI, now using SmartParser logic for robustness."""
    pass

def get_parser(bank_name):
    """Factory to return the correct parser for a given bank."""
    if not bank_name or bank_name.upper() == 'AUTO':
        return SmartParser()
        
    parsers = {
        'HDFC': HDFCParser(),
        'SBI': SBIParser(),
    }
    return parsers.get(bank_name.upper(), SmartParser())
