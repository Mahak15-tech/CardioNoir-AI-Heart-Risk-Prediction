# ♥ CardioNoir AI

**Intelligent cardiovascular risk analytics.** CardioNoir AI is a web app that estimates a patient's cardiovascular risk from 13 clinical indicators using machine learning, and lets you explore the dataset and compare the trained models through interactive charts.

> ⚠️ **Disclaimer:** CardioNoir AI is built for educational and analytical purposes. It is **not** a medical diagnosis tool and must not replace advice from a qualified healthcare professional.

---

## Features

- **Risk assessment form** – enter 13 clinical indicators and get an estimated risk percentage, a positive/negative result, a risk level and the model used.
- **Data intelligence dashboard**
  - Doughnut chart of cardiovascular outcomes
  - Scatter plots of age vs cholesterol, resting blood pressure and maximum heart rate
  - Correlation heatmap across all features and the outcome
- **Model lab** – grouped bar chart and individual cards comparing Accuracy, Precision, Recall, F1 Score and ROC-AUC for every trained model, with the best model highlighted.
- **Light and dark themes** – the choice is saved in the browser.
- **Responsive design** – works on desktop, tablet and mobile.
- **Built-in error banner** – if any API call fails, the page lists the exact endpoint and error.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python, FastAPI, Uvicorn |
| Machine learning | scikit-learn, pandas, NumPy |
| Frontend | HTML, CSS, vanilla JavaScript |
| Charts | Chart.js 4 (heatmap built as an HTML grid) |
| Fonts | DM Sans, Playfair Display (Google Fonts) |

---

## Project Structure

Adjust the names below to match your own project.

```
CardioNoir/
│
├── api/
│   └── index.py
│
├── public/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── assets/
│
├── data/
│   ├── heart.csv
│   └── cleaned_heart.csv
│
├── model/
│   ├── metadata.json
│   └── model.joblib
│
├── train.py
├── requirements.txt
├── vercel.json
└── README.md
```

---

## Getting Started

### 1. Prerequisites

- Python 3.9 or newer
- A modern browser (Chrome, Edge, Firefox, Safari)
- Internet access in the browser, to load Chart.js and Google Fonts from their CDNs

### 2. Clone and install

```bash
git clone <your-repo-url>
cd cardionoir-ai

pip install -r requirements.txt
```

### 3. Add the data

Place the cleaned dataset in the `data/` folder and make sure `CLEAN_PATH` in `main.py` points to it:

```python
BASE_DIR = Path(__file__).resolve().parent
CLEAN_PATH = BASE_DIR / "data" / "heart_clean.csv"
```

The CSV must contain these columns:

`age, sex, cp, trestbps, chol, fbs, restecg, thalach, exang, oldpeak, slope, ca, thal, target`

### 4. Run the app

```bash
uvicorn main:app --reload
```

Open **http://127.0.0.1:8000** in your browser.

> Open the app through the FastAPI server. Opening `index.html` directly or through an editor's Live Server will not work, because the page calls the `/api/...` routes.

---

## Serving the Frontend

Mount the `frontend` folder **after** all API routes in `main.py`:

```python
from fastapi.staticfiles import StaticFiles

# ... all @app.get / @app.post routes above ...

app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
```

If the mount comes before the API routes, the API will return 404.

---

## API Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/metadata` | Model results, best model and dataset size |
| `GET` | `/api/analytics` | Target distribution for the doughnut chart |
| `GET` | `/api/analytics/raw` | Scatter plot data (`age_chol`, `age_bp`, `age_thalach`) |
| `GET` | `/api/analytics/correlation` | Correlation matrix for the heatmap |
| `POST` | `/api/predict` | Risk prediction for one patient |

### Example responses

**`GET /api/metadata`**

```json
{
  "dataset_size": 1025,
  "best_model": "Random Forest",
  "results": {
    "Random Forest": {
      "accuracy": 0.98,
      "precision": 0.97,
      "recall": 0.99,
      "f1": 0.98,
      "roc_auc": 0.99
    }
  }
}
```

**`GET /api/analytics`**

```json
{ "target_distribution": { "0": 499, "1": 526 } }
```

**`GET /api/analytics/raw`**

```json
{
  "age_chol": [{ "x": 52, "y": 212 }],
  "age_bp": [{ "x": 52, "y": 125 }],
  "age_thalach": [{ "x": 52, "y": 168 }]
}
```

**`GET /api/analytics/correlation`**

```python
@app.get("/api/analytics/correlation")
def get_correlation():
    df = pd.read_csv(CLEAN_PATH)
    corr = df.select_dtypes("number").corr().round(3).fillna(0)
    return {
        "labels": corr.columns.tolist(),
        "matrix": corr.values.tolist(),
        "rows": len(df),
    }
```

**`POST /api/predict`**

Request body:

```json
{
  "age": 52, "sex": 1, "cp": 0, "trestbps": 125, "chol": 212,
  "fbs": 0, "restecg": 1, "thalach": 168, "exang": 0,
  "oldpeak": 1.0, "slope": 2, "ca": 2, "thal": 3
}
```

Response:

```json
{
  "prediction": 1,
  "risk_percentage": 82.4,
  "risk_level": "High",
  "model_name": "Random Forest"
}
```

The example numbers above are placeholders. Your real values come from your trained models.

The frontend accepts several response shapes, for example model results as a dictionary or a list, and metric names such as `ROC-AUC`, `roc_auc` or `rocauc`.

---

## Input Features

| Field | Description | Values |
|-------|-------------|--------|
| `age` | Age in years | 1 – 120 |
| `sex` | Sex | 0 = Female, 1 = Male |
| `cp` | Chest pain type | 0 Typical angina, 1 Atypical angina, 2 Non-anginal pain, 3 Asymptomatic |
| `trestbps` | Resting blood pressure (mmHg) | numeric |
| `chol` | Serum cholesterol (mg/dL) | numeric |
| `fbs` | Fasting blood sugar above 120 mg/dL | 0 = No, 1 = Yes |
| `restecg` | Resting ECG result | 0 Normal, 1 ST-T abnormality, 2 Left ventricular hypertrophy |
| `thalach` | Maximum heart rate achieved (bpm) | numeric |
| `exang` | Exercise-induced angina | 0 = No, 1 = Yes |
| `oldpeak` | ST depression induced by exercise | decimal |
| `slope` | Slope of the peak exercise ST segment | 0 Upsloping, 1 Flat, 2 Downsloping |
| `ca` | Major vessels coloured by fluoroscopy | 0 – 4 |
| `thal` | Thalassemia result | see note below |
| `target` | Outcome (analytics only) | 0 = No heart disease, 1 = Heart disease |

> **Check your encodings.** The numeric codes for `cp` and `thal` differ between versions of the heart disease dataset (for example UCI and Kaggle). Make sure the labels in the form match how your cleaned CSV encodes those columns, or predictions will be silently wrong.

---

## Troubleshooting

| Problem | Likely cause and fix |
|---------|----------------------|
| Red banner under the navbar | It names the failing endpoint. Check that the route exists and returns JSON. |
| Page looks unstyled or scripts do not run | The frontend is not being served. Check the `StaticFiles` mount and that it is the **last** line. |
| `/api/...` returns 404 | The static mount is placed before the API routes, or the route name differs. |
| Charts are empty | Open the browser console (F12) and check for errors. Also check that Chart.js loaded from the CDN. |
| Heatmap stays on "Loading…" | `/api/analytics/correlation` failed. Check the CSV path and that all columns are numeric. |
| Prediction returns 422 | The request body is missing a field or has the wrong type. The form shows the field name. |
| Theme does not persist | The browser is blocking `localStorage`. The app still works, but the choice is not saved. |

---

## Roadmap Ideas

- Feature importance chart
- Confusion matrix and ROC curves per model
- Downloadable PDF report of a prediction
- Explainability with SHAP values

---

## Author

**Mahak** – Data Science student
GitHub: [github.com/Mahak15-tech](https://github.com/Mahak15-tech)

---

## License

Add your preferred license here (for example MIT).