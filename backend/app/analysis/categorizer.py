import os
import joblib
from app.analysis.train_model import MODEL_PATH, train_and_save_model

# Global variable to hold the model in memory
_model = None

def _load_model():
    """Load the model from disk if it exists, otherwise train a new one."""
    global _model
    if _model is not None:
        return _model
        
    if os.path.exists(MODEL_PATH):
        try:
            _model = joblib.load(MODEL_PATH)
        except Exception as e:
            print(f"Error loading model: {e}. Retraining...")
            _model = train_and_save_model()
    else:
        _model = train_and_save_model()
    return _model

def predict_category(description):
    """
    Predict the category for a given transaction description.
    """
    if not description or not description.strip() or description.lower() == "unknown":
        return "Uncategorized"
        
    model = _load_model()
    try:
        prediction = model.predict([description])
        return prediction[0]
    except Exception as e:
        print(f"Prediction error: {e}")
        return "Uncategorized"

def retrain_model_with_db(db):
    """
    Fetch user-edited transactions from the DB and retrain the model.
    This enables dynamic learning from user feedback.
    """
    try:
        with db.cursor() as cursor:
            # Fetch all categorized transactions to reinforce the model
            # In a real app, you might only fetch 'user_edited = True' or a verified subset
            cursor.execute(
                "SELECT description, category FROM transactions WHERE category IS NOT NULL AND category != 'Uncategorized'"
            )
            rows = cursor.fetchall()
            
            additional_data = [(row['description'], row['category']) for row in rows]
            
            # Retrain and update the global model
            global _model
            _model = train_and_save_model(additional_data)
            return True
    except Exception as e:
        print(f"Failed to retrain model with DB data: {e}")
        return False
