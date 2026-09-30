import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
)


# ============================================================
# CARDIONOIR AI - MODEL TRAINING
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "data" / "cleaned_heart.csv"
MODEL_DIR = BASE_DIR / "model"

MODEL_DIR.mkdir(exist_ok=True)

print("=" * 60)
print("CARDIONOIR AI - MODEL TRAINING")
print("=" * 60)


# ------------------------------------------------------------
# 1. LOAD CLEANED DATA
# ------------------------------------------------------------

df = pd.read_csv(DATA_FILE)

print("\nDataset loaded successfully.")
print(f"Shape: {df.shape}")

print("\nColumns:")
print(df.columns.tolist())


# ------------------------------------------------------------
# 2. TARGET
# ------------------------------------------------------------

TARGET = "target"

if TARGET not in df.columns:
    raise ValueError(
        "Target column 'target' was not found in cleaned_heart.csv"
    )

X = df.drop(columns=[TARGET])
y = df[TARGET]


# ------------------------------------------------------------
# 3. CHECK TARGET
# ------------------------------------------------------------

print("\nTarget distribution:")
print(y.value_counts().sort_index())

if y.nunique() != 2:
    raise ValueError(
        "The target column must contain exactly two classes."
    )


# ------------------------------------------------------------
# 4. TRAIN / TEST SPLIT
# ------------------------------------------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y,
)

print("\nTrain samples:", len(X_train))
print("Test samples:", len(X_test))


# ------------------------------------------------------------
# 5. PREPROCESSING
# ------------------------------------------------------------

# Your cleaned dataset contains numeric ML features.
# Median imputation is retained as a safety layer.

preprocessor = Pipeline(
    steps=[
        (
            "imputer",
            SimpleImputer(strategy="median")
        ),
        (
            "scaler",
            StandardScaler()
        ),
    ]
)


# ------------------------------------------------------------
# 6. MODELS
# ------------------------------------------------------------

models = {
    "Logistic Regression": LogisticRegression(
        max_iter=2000,
        random_state=42
    ),

    "Random Forest": RandomForestClassifier(
        n_estimators=300,
        random_state=42,
        class_weight="balanced"
    ),

    "Gradient Boosting": GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=3,
        random_state=42
    ),
}


# ------------------------------------------------------------
# 7. TRAIN + EVALUATE
# ------------------------------------------------------------

results = {}
trained_models = {}

print("\n" + "=" * 60)
print("MODEL RESULTS")
print("=" * 60)

for name, model in models.items():

    pipeline = Pipeline(
        steps=[
            ("preprocessing", preprocessor),
            ("model", model),
        ]
    )

    pipeline.fit(X_train, y_train)

    predictions = pipeline.predict(X_test)

    if hasattr(pipeline, "predict_proba"):
        probabilities = pipeline.predict_proba(X_test)[:, 1]
    else:
        probabilities = predictions

    accuracy = accuracy_score(y_test, predictions)
    precision = precision_score(
        y_test,
        predictions,
        zero_division=0
    )
    recall = recall_score(
        y_test,
        predictions,
        zero_division=0
    )
    f1 = f1_score(
        y_test,
        predictions,
        zero_division=0
    )
    roc_auc = roc_auc_score(
        y_test,
        probabilities
    )

    results[name] = {
        "accuracy": round(float(accuracy), 4),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1": round(float(f1), 4),
        "roc_auc": round(float(roc_auc), 4),
    }

    trained_models[name] = pipeline

    print(f"\n{name}")
    print(f"Accuracy : {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall   : {recall:.4f}")
    print(f"F1 Score : {f1:.4f}")
    print(f"ROC-AUC  : {roc_auc:.4f}")


# ------------------------------------------------------------
# 8. SELECT BEST MODEL
# ------------------------------------------------------------

best_model_name = max(
    results,
    key=lambda name: results[name]["roc_auc"]
)

best_model = trained_models[best_model_name]

print("\n" + "=" * 60)
print("SELECTED MODEL")
print("=" * 60)

print(f"\nBest model: {best_model_name}")
print(
    f"ROC-AUC: "
    f"{results[best_model_name]['roc_auc']:.4f}"
)


# ------------------------------------------------------------
# 9. SAVE MODEL
# ------------------------------------------------------------

model_path = MODEL_DIR / "model.joblib"

joblib.dump(
    best_model,
    model_path
)

print(f"\nModel saved to:")
print(model_path)


# ------------------------------------------------------------
# 10. SAVE METADATA
# ------------------------------------------------------------

feature_metadata = {}

for column in X.columns:

    if column == "sex":
        feature_metadata[column] = {
            "type": "categorical",
            "label": "Sex",
            "options": {
                "0": "Female",
                "1": "Male",
            },
        }

    elif column == "cp":
        feature_metadata[column] = {
            "type": "categorical",
            "label": "Chest Pain Type",
            "options": {
                "0": "Typical Angina",
                "1": "Atypical Angina",
                "2": "Non-Anginal Pain",
                "3": "Asymptomatic",
            },
        }

    elif column == "fbs":
        feature_metadata[column] = {
            "type": "categorical",
            "label": "Fasting Blood Sugar",
            "options": {
                "0": "No",
                "1": "Yes",
            },
        }

    elif column == "restecg":
        feature_metadata[column] = {
            "type": "categorical",
            "label": "Resting ECG",
            "options": {
                "0": "Normal",
                "1": "ST-T Wave Abnormality",
                "2": "Left Ventricular Hypertrophy",
            },
        }

    elif column == "exang":
        feature_metadata[column] = {
            "type": "categorical",
            "label": "Exercise-Induced Angina",
            "options": {
                "0": "No",
                "1": "Yes",
            },
        }

    elif column == "slope":
        feature_metadata[column] = {
            "type": "categorical",
            "label": "ST Slope",
            "options": {
                "0": "Upsloping",
                "1": "Flat",
                "2": "Downsloping",
            },
        }

    elif column == "ca":
        feature_metadata[column] = {
            "type": "categorical",
            "label": "Major Vessels",
            "options": {
                "0": "0",
                "1": "1",
                "2": "2",
                "3": "3",
            },
        }

    elif column == "thal":
        feature_metadata[column] = {
            "type": "categorical",
            "label": "Thalassemia",
            "options": {
                "0": "Normal",
                "1": "Fixed Defect",
                "2": "Reversible Defect",
            },
        }

    else:
        feature_metadata[column] = {
            "type": "numeric",
            "label": column.replace("_", " ").title(),
            "min": float(X[column].min()),
            "max": float(X[column].max()),
            "median": float(X[column].median()),
        }


metadata = {
    "target": TARGET,
    "features": list(X.columns),
    "feature_metadata": feature_metadata,
    "best_model": best_model_name,
    "models": results,
    "dataset": {
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
    },
}


metadata_path = MODEL_DIR / "metadata.json"

with open(
    metadata_path,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        metadata,
        file,
        indent=4
    )


# ------------------------------------------------------------
# 11. FINAL SUMMARY
# ------------------------------------------------------------

print("\nMetadata saved to:")
print(metadata_path)

print("\n" + "=" * 60)
print("TRAINING COMPLETED SUCCESSFULLY")
print("=" * 60)

print(f"\nDataset rows : {len(df)}")
print(f"Features     : {len(X.columns)}")
print(f"Best model   : {best_model_name}")
print(f"ROC-AUC      : {results[best_model_name]['roc_auc']:.4f}")