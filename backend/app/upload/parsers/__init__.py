from abc import ABC, abstractmethod
import csv
import io
from datetime import datetime

class BaseParser(ABC):
    """Base class for all bank statement parsers."""
    
    @abstractmethod
    def parse(self, file_content):
        """Parse file content and return a list of normalized transactions."""
        pass

    def _clean_amount(self, value):
        """Helper to convert string amount to float."""
        if not value or not isinstance(value, str):
            return 0.0
        # Remove commas and handle parentheses for negative numbers
        clean_val = value.replace(',', '').strip()
        if clean_val.startswith('(') and clean_val.endswith(')'):
            return -float(clean_val[1:-1])
        return float(clean_val)

class HDFCParser(BaseParser):
    """Parser for HDFC Bank CSV statements."""
    
    def parse(self, file_content):
        transactions = []
        # HDFC CSVs often have metadata at the top, we look for the header row
        decoded_content = file_content.decode('utf-8')
        reader = csv.DictReader(io.StringIO(decoded_content))
        
        for row in reader:
            try:
                # Expected HDFC Headers: Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance
                # Note: Actual headers might vary slightly, but we normalize here
                date_str = row.get('Date') or row.get('Transaction Date')
                if not date_str: continue
                
                withdrawal = self._clean_amount(row.get('Withdrawal Amt.') or '0')
                deposit = self._clean_amount(row.get('Deposit Amt.') or '0')
                
                txn = {
                    'date': datetime.strptime(date_str, '%d/%m/%y').date(),
                    'description': row.get('Narration') or row.get('Description'),
                    'amount': withdrawal if withdrawal > 0 else deposit,
                    'type': 'debit' if withdrawal > 0 else 'credit',
                    'balance': self._clean_amount(row.get('Closing Balance') or '0')
                }
                transactions.append(txn)
            except Exception as e:
                print(f"Skipping row due to error: {e}")
                continue
        return transactions

class SBIParser(BaseParser):
    """Parser for SBI Bank CSV statements."""
    
    def parse(self, file_content):
        transactions = []
        decoded_content = file_content.decode('utf-8')
        reader = csv.DictReader(io.StringIO(decoded_content))
        
        for row in reader:
            try:
                # Expected SBI Headers: Txn Date, Value Date, Description, Ref No./Cheque No., Debit, Credit, Balance
                date_str = row.get('Txn Date')
                if not date_str: continue
                
                debit = self._clean_amount(row.get('Debit') or '0')
                credit = self._clean_amount(row.get('Credit') or '0')
                
                txn = {
                    'date': datetime.strptime(date_str, '%d %b %Y').date(),
                    'description': row.get('Description'),
                    'amount': debit if debit > 0 else credit,
                    'type': 'debit' if debit > 0 else 'credit',
                    'balance': self._clean_amount(row.get('Balance') or '0')
                }
                transactions.append(txn)
            except Exception as e:
                print(f"Skipping row due to error: {e}")
                continue
        return transactions

def get_parser(bank_name):
    """Factory to return the correct parser for a given bank."""
    parsers = {
        'HDFC': HDFCParser(),
        'SBI': SBIParser(),
    }
    return parsers.get(bank_name.upper())
