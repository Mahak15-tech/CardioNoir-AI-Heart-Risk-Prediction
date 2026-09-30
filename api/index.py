import json
from pathlib import Path

import joblib
import pandas as pd

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


# ============================================================
# CARDIONOIR AI - FASTAPI BACKEND
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_FILE = BASE_DIR / "model" / "model.joblib"
METADATA_FILE = BASE_DIR / "model" / "metadata.json"
DATA_FILE = BASE_DIR / "data" / "cleaned_heart.csv"
PUBLIC_DIR = BASE_DIR / "public"


# ------------------------------------------------------------
# LOAD MODEL
# ------------------------------------------------------------

if not MODEL_FILE.exists():
    raise FileNotFoundError(
        f"Model not found: {MODEL_FILE}. "
        "Run training/train.py first."
    )

model = joblib.load(MODEL_FILE)


# ------------------------------------------------------------
# LOAD METADATA
# ------------------------------------------------------------

if not METADATA_FILE.exists():
    raise FileNotFoundError(
        f"Metadata not found: {METADATA_FILE}. "
        "Run training/train.py first."
    )

with open(
    METADATA_FILE,
    "r",
    encoding="utf-8"
) as file:
    metadata = json.load(file)


# ------------------------------------------------------------
# LOAD CLEANED DATA
# ------------------------------------------------------------

if not DATA_FILE.exists():
    raise FileNotFoundError(
        f"Cleaned dataset not found: {DATA_FILE}"
    )

df = pd.read_csv(DATA_FILE)


# ------------------------------------------------------------
# FASTAPI
# ------------------------------------------------------------

app = FastAPI(
    title="CardioNoir AI",
    description="Heart disease risk estimation API",
    version="1.0.0",
)


# ------------------------------------------------------------
# CORS
# ------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------
# REQUEST MODEL
# ------------------------------------------------------------

class PredictionRequest(BaseModel):

    age: float
    sex: int
    cp: int
    trestbps: float
    chol: float
    fbs: int
    restecg: int
    thalach: float
    exang: int
    oldpeak: float
    slope: int
    ca: int
    thal: int


# ------------------------------------------------------------
# HEALTH CHECK
# ------------------------------------------------------------

@app.get("/api/health")
def health():

    return {
        "status": "healthy",
        "app": "CardioNoir AI",
        "model_loaded": True,
        "dataset_rows": len(df),
    }


# ------------------------------------------------------------
# METADATA
# ------------------------------------------------------------

@app.get("/api/metadata")
def get_metadata():
    
    return metadata


# ------------------------------------------------------------
# ANALYTICS
# ------------------------------------------------------------

@app.get("/api/analytics")
def analytics():

    analytics_data = {}

    # -------------------------
    # Dataset information
    # -------------------------

    analytics_data["dataset"] = {
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
    }

    # -------------------------
    # Target distribution
    # -------------------------

    if "target" in df.columns:

        target_counts = (
            df["target"]
            .value_counts()
            .sort_index()
            .to_dict()
        )

        analytics_data["target_distribution"] = {
            str(key): int(value)
            for key, value in target_counts.items()
        }

    # -------------------------
    # Sex distribution
    # -------------------------

    if "sex" in df.columns:

        sex_counts = (
            df["sex"]
            .value_counts()
            .sort_index()
            .to_dict()
        )

        analytics_data["sex_distribution"] = {
            "Female": int(sex_counts.get(0, 0)),
            "Male": int(sex_counts.get(1, 0)),
        }

    # -------------------------
    # Age statistics
    # -------------------------

    if "age" in df.columns:

        analytics_data["age"] = {
            "min": float(df["age"].min()),
            "max": float(df["age"].max()),
            "mean": round(float(df["age"].mean()), 2),
            "median": round(float(df["age"].median()), 2),
        }

    # -------------------------
    # Medical statistics
    # -------------------------

    medical_columns = [
        "trestbps",
        "chol",
        "thalach",
        "oldpeak",
    ]

    analytics_data["medical_statistics"] = {}

    for column in medical_columns:

        if column in df.columns:

            analytics_data["medical_statistics"][column] = {
                "mean": round(
                    float(df[column].mean()),
                    2
                ),
                "median": round(
                    float(df[column].median()),
                    2
                ),
                "min": round(
                    float(df[column].min()),
                    2
                ),
                "max": round(
                    float(df[column].max()),
                    2
                ),
            }

    # -------------------------
    # Chest pain distribution
    # -------------------------

    if "cp" in df.columns:

        cp_counts = (
            df["cp"]
            .value_counts()
            .sort_index()
            .to_dict()
        )

        analytics_data["chest_pain"] = {
            str(key): int(value)
            for key, value in cp_counts.items()
        }

    return analytics_data


# ------------------------------------------------------------
# PREDICTION
# ------------------------------------------------------------

@app.post("/api/predict")
def predict(request: PredictionRequest):

    try:

        data = {
            "age": request.age,
            "sex": request.sex,
            "cp": request.cp,
            "trestbps": request.trestbps,
            "chol": request.chol,
            "fbs": request.fbs,
            "restecg": request.restecg,
            "thalach": request.thalach,
            "exang": request.exang,
            "oldpeak": request.oldpeak,
            "slope": request.slope,
            "ca": request.ca,
            "thal": request.thal,
        }

        input_df = pd.DataFrame([data])

        # Make prediction
        prediction = int(
            model.predict(input_df)[0]
        )

        # Probability
        if hasattr(model, "predict_proba"):

            probabilities = model.predict_proba(
                input_df
            )[0]

            probability = float(
                probabilities[1]
            )

        else:

            probability = 1.0 if prediction == 1 else 0.0

        # Convert to percentage
        risk_percentage = round(
            probability * 100,
            2
        )

        # Risk classification
        if risk_percentage < 30:

            risk_level = "Low"

        elif risk_percentage < 60:

            risk_level = "Moderate"

        else:

            risk_level = "High"

        # Human-readable result
        if prediction == 1:

            result = "Higher estimated risk"

        else:

            result = "Lower estimated risk"

        return {
            "prediction": prediction,
            "result": result,
            "risk_percentage": risk_percentage,
            "risk_level": risk_level,
            "model": metadata.get(
                "best_model",
                "Unknown"
            ),
            "disclaimer": (
                "This result is an ML-based risk estimate "
                "and is not a medical diagnosis."
            ),
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

@app.get("/api/analytics/raw")
def analytics_raw():

    return {
        "age_chol": [
            {
                "x": float(row["age"]),
                "y": float(row["chol"])
            }
            for _, row in df.iterrows()
        ],

        "age_bp": [
            {
                "x": float(row["age"]),
                "y": float(row["trestbps"])
            }
            for _, row in df.iterrows()
        ],

        "age_thalach": [
            {
                "x": float(row["age"]),
                "y": float(row["thalach"])
            }
            for _, row in df.iterrows()
        ],
    }
@app.get("/api/analytics/correlation")
def analytics_correlation():
    columns = [
        "age",
        "trestbps",
        "chol",
        "thalach",
        "oldpeak",
        "target"
    ]

    correlation = df[columns].corr().round(3)

    return {
        "columns": columns,
        "matrix": correlation.values.tolist()
    }
# ------------------------------------------------------------
# SERVE FRONTEND
# ------------------------------------------------------------

if PUBLIC_DIR.exists():

    app.mount(
        "/",
        StaticFiles(
            directory=str(PUBLIC_DIR),
            html=True
        ),
        name="public",
    )