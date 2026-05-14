import os
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from app.analysis.training_data import SEED_DATA

MODEL_PATH = os.path.join(os.path.dirname(__file__), "category_model.pkl")

def train_and_save_model(additional_data=None):
    """
    Trains the NLP pipeline using the seed dataset and any additional data (e.g., from DB).
    Saves the trained model to disk.
    """
    # Combine seed data with user corrections
    training_data = list(SEED_DATA)
    if additional_data:
        training_data.extend(additional_data)
        
    X_train = [item[0] for item in training_data]
    y_train = [item[1] for item in training_data]
    
    # Build NLP Pipeline
    # TfidfVectorizer converts text to numerical vectors based on word frequency
    # MultinomialNB is a fast, reliable classifier for text data
    model = Pipeline([
        ('tfidf', TfidfVectorizer(lowercase=True, stop_words='english', ngram_range=(1, 2))),
        ('clf', MultinomialNB(alpha=0.1))
    ])
    
    # Train the model
    model.fit(X_train, y_train)
    
    # Save to disk
    joblib.dump(model, MODEL_PATH)
    print(f"Model successfully trained on {len(training_data)} samples and saved to {MODEL_PATH}")
    return model

if __name__ == "__main__":
    train_and_save_model()
