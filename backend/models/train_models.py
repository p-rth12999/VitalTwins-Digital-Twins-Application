import os
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EHR_PATH = os.path.join(BASE_DIR, "data", "synthetic_ehr.csv")
MODEL_PATH = os.path.join(BASE_DIR, "models", "xgb_ehr_model.json")

FEATURES = [
    "age", "bmi", "systolic_bp", "diastolic_bp",
    "cholesterol_mg_dl", "hypertension_history",
    "diabetes_history", "smoker"
]

def train_baseline_model():
    df = pd.read_csv(EHR_PATH)
    X = df[FEATURES]
    y = df["high_baseline_risk"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.08,
        eval_metric="logloss",
        random_state=42
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    probs = model.predict_proba(X_test)[:, 1]

    print(f"[+] XGBoost EHR Baseline Model Trained!")
    print(f"    -> Validation Accuracy: {accuracy_score(y_test, preds) * 100:.2f}%")
    print(f"    -> ROC-AUC Score:       {roc_auc_score(y_test, probs):.3f}")

    model.save_model(MODEL_PATH)
    print(f"[+] Saved model to: {MODEL_PATH}")

if __name__ == "__main__":
    train_baseline_model()