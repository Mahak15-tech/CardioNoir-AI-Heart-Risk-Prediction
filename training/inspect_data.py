import pandas as pd
from pathlib import Path

# Dataset path
DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "heart.csv"

print("=" * 60)
print("CARDIONOIR AI - DATASET INSPECTION")
print("=" * 60)

# Check whether dataset exists
if not DATA_PATH.exists():
    print(f"\nERROR: Dataset not found at:")
    print(DATA_PATH)
    raise SystemExit(1)

# Load dataset
df = pd.read_csv(DATA_PATH)

print("\n1. DATASET LOCATION")
print(DATA_PATH)

print("\n2. DATASET SHAPE")
print(f"Rows    : {df.shape[0]}")
print(f"Columns : {df.shape[1]}")

print("\n3. COLUMN NAMES")
for i, column in enumerate(df.columns, start=1):
    print(f"{i}. {column}")

print("\n4. DATA TYPES")
print(df.dtypes)

print("\n5. MISSING VALUES")
missing = df.isnull().sum()
print(missing)

print("\n6. DUPLICATE ROWS")
print(df.duplicated().sum())

print("\n7. FIRST 5 ROWS")
print(df.head())

print("\n8. STATISTICAL SUMMARY")
print(df.describe())

print("\n9. UNIQUE VALUES")
for column in df.columns:
    print(f"\n{column}:")
    print(df[column].unique()[:20])

print("\n10. POSSIBLE TARGET COLUMNS")
for column in df.columns:
    unique_count = df[column].nunique()

    if unique_count <= 5:
        print(
            f"{column} -> "
            f"{unique_count} unique values: "
            f"{df[column].unique()}"
        )

print("\n" + "=" * 60)
print("INSPECTION COMPLETE")
print("=" * 60)