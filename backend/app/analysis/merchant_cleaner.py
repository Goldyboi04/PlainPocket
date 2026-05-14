import re

def clean_merchant_name(raw_desc):
    """
    Cleans raw bank statement descriptions into readable merchant names.
    """
    if not raw_desc:
        return "Unknown"

    desc = raw_desc.upper()

    # Common UPI/Gateway patterns
    # Example: UPI-ZOMATO-PAY-@okaxis
    # Example: UPI/ZOMATO/123456
    
    # Remove UPI prefixes
    desc = re.sub(r'^UPI[/-]', '', desc)
    
    # Remove @okaxis, @oksbi, etc.
    desc = re.sub(r'@[A-Z0-9]+', '', desc)
    
    # Remove TXN numbers or reference numbers
    desc = re.sub(r'TXN\d+', '', desc)
    
    # Replace hyphens and slashes with spaces
    desc = desc.replace('-', ' ').replace('/', ' ')
    
    # Specific lookup table for common merchants
    lookup = {
        'ZOMATO': 'Zomato',
        'SWIGGY': 'Swiggy',
        'AMAZON': 'Amazon',
        'FLIPKART': 'Flipkart',
        'BIG BASKET': 'BigBasket',
        'BIGBASKET': 'BigBasket',
        'STARBUCKS': 'Starbucks',
        'UBER': 'Uber',
        'OLA': 'Ola',
        'AIRTEL': 'Airtel',
        'JIO': 'Jio',
        'TATA PLAY': 'Tata Play',
        'NETFLIX': 'Netflix',
        'AMUL': 'Amul',
        'MOTHER DAIRY': 'Mother Dairy',
        'PVR': 'PVR Cinemas',
        'RELIANCE FRESH': 'Reliance Fresh',
        'ACT FIBERNET': 'ACT Fibernet',
        'URBAN COMPANY': 'Urban Company',
        'HDFC': 'HDFC Bank',
        'SBI': 'SBI',
        'LIC': 'LIC',
    }
    
    # Try to find common merchants
    for key, value in lookup.items():
        if key in desc:
            return value

    # Fallback to cleaning up the string
    # Remove extra spaces
    desc = ' '.join(desc.split())
    
    # Title case
    desc = desc.title()
    
    # Clean up generic terms if needed
    desc = desc.replace(' Pay', '').replace(' Ind', '').strip()

    return desc if desc else "Unknown"
