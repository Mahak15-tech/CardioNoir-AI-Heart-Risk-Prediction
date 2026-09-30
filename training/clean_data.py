import pandas as pd
import numpy as np
from pathlib import Path

# ============================================================
# CARDIONOIR AI - DATA CLEANING
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
INPUT_FILE = BASE_DIR / "data" / "heart.csv"
OUTPUT_FILE = BASE_DIR / "data" / "cleaned_heart.csv"

print("=" * 60)
print("CARDIONOIR AI - DATA CLEANING")
print("=" * 60)

# ------------------------------------------------------------
# 1. LOAD DATA
# ------------------------------------------------------------

df = pd.read_csv(INPUT_FILE)

print("\nOriginal dataset shape:")
print(df.shape)

print("\nOriginal columns:")
print(df.columns.tolist())

# ------------------------------------------------------------
# 2. STANDARDIZE COLUMN NAMES
# ------------------------------------------------------------

df.columns = (
    df.columns
    .str.strip()
    .str.lower()
    .str.replace(" ", "_")
    .str.replace("-", "_")
)

print("\nStandardized columns:")
print(df.columns.tolist())

# ------------------------------------------------------------
# 3. REMOVE COMPLETELY EMPTY ROWS/COLUMNS
# ------------------------------------------------------------

df = df.dropna(axis=0, how="all")
df = df.dropna(axis=1, how="all")

# ------------------------------------------------------------
# 4. REMOVE DUPLICATES
# ------------------------------------------------------------

duplicates = df.duplicated().sum()

print(f"\nDuplicate rows found: {duplicates}")

if duplicates > 0:
    df = df.drop_duplicates()

print(f"Shape after duplicate removal: {df.shape}")

# ------------------------------------------------------------
# 5. CONVERT EXPECTED NUMERIC COLUMNS
# ------------------------------------------------------------

numeric_columns = [
    "age",
    "sex",
    "cp",
    "trestbps",
    "chol",
    "fbs",
    "restecg",
    "thalach",
    "exang",
    "oldpeak",
    "slope",
    "ca",
    "thal",
    "target"
]

for col in numeric_columns:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")

# ------------------------------------------------------------
# 6. CHECK MISSING VALUES
# ------------------------------------------------------------

print("\nMissing values before cleaning:")

missing = df.isnull().sum()

print(missing[missing > 0])

# ------------------------------------------------------------
# 7. HANDLE MISSING VALUES
# ------------------------------------------------------------

for col in numeric_columns:

    if col not in df.columns:
        continue

    if df[col].isnull().sum() > 0:

        median_value = df[col].median()

        df[col] = df[col].fillna(median_value)

        print(
            f"Filled missing values in {col} "
            f"with median: {median_value}"
        )

# ------------------------------------------------------------
# 8. CONVERT SEX FOR DATA INTERPRETATION
# ------------------------------------------------------------

# Keep numeric representation for ML:
# 0 = Female
# 1 = Male

if "sex" in df.columns:

    valid_sex = df["sex"].isin([0, 1])

    invalid_sex = (~valid_sex).sum()

    if invalid_sex > 0:
        print(f"\nRemoving {invalid_sex} invalid sex values.")
        df = df[valid_sex]

# ------------------------------------------------------------
# 9. REMOVE INVALID TARGET VALUES
# ------------------------------------------------------------

if "target" in df.columns:

    valid_target = df["target"].isin([0, 1])

    invalid_target = (~valid_target).sum()

    if invalid_target > 0:
        print(f"\nRemoving {invalid_target} invalid target values.")
        df = df[valid_target]

# ------------------------------------------------------------
# 10. REMOVE INVALID MEDICAL VALUES
# ------------------------------------------------------------

print("\nChecking invalid medical values...")

# These values cannot realistically be zero or negative.
positive_columns = [
    "age",
    "trestbps",
    "thalach"
]

for col in positive_columns:

    if col in df.columns:

        invalid = (df[col] <= 0).sum()

        if invalid > 0:

            print(
                f"{col}: removing {invalid} invalid rows"
            )

            df = df[df[col] > 0]

# Cholesterol = 0 is generally treated as invalid/missing
if "chol" in df.columns:

    invalid = (df["chol"] <= 0).sum()

    if invalid > 0:

        print(
            f"chol: removing {invalid} invalid rows"
        )

        df = df[df["chol"] > 0]

# ------------------------------------------------------------
# 11. REMOVE OUTLIERS USING IQR
# ------------------------------------------------------------

print("\n" + "=" * 60)
print("OUTLIER REMOVAL")
print("=" * 60)

outlier_columns = [
    "age",
    "trestbps",
    "chol",
    "thalach",
    "oldpeak"
]

before_outlier_removal = len(df)

for col in outlier_columns:

    if col not in df.columns:
        continue

    Q1 = df[col].quantile(0.25)
    Q3 = df[col].quantile(0.75)

    IQR = Q3 - Q1

    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR

    outliers = (
        (df[col] < lower_bound) |
        (df[col] > upper_bound)
    )

    count = outliers.sum()

    print(f"\n{col}")
    print(f"Q1: {Q1:.2f}")
    print(f"Q3: {Q3:.2f}")
    print(f"IQR: {IQR:.2f}")
    print(f"Lower bound: {lower_bound:.2f}")
    print(f"Upper bound: {upper_bound:.2f}")
    print(f"Outliers found: {count}")

    if count > 0:
        df = df[~outliers]

after_outlier_removal = len(df)

print(
    f"\nTotal rows removed as outliers: "
    f"{before_outlier_removal - after_outlier_removal}"
)

# ------------------------------------------------------------
# 12. FINAL CHECK
# ------------------------------------------------------------

print("\n" + "=" * 60)
print("FINAL DATASET CHECK")
print("=" * 60)

print("\nFinal shape:")
print(df.shape)

print("\nFinal columns:")
print(df.columns.tolist())

print("\nMissing values:")
print(df.isnull().sum())

print("\nDuplicates:")
print(df.duplicated().sum())

print("\nTarget distribution:")
print(df["target"].value_counts().sort_index())

# ------------------------------------------------------------
# 13. SEX DISTRIBUTION
# ------------------------------------------------------------

if "sex" in df.columns:

    print("\nSex distribution:")

    sex_counts = df["sex"].value_counts().sort_index()

    for value, count in sex_counts.items():

        label = "Female" if value == 0 else "Male"

        print(f"{label} ({value}): {count}")

# ------------------------------------------------------------
# 14. SAVE CLEANED DATASET
# ------------------------------------------------------------

OUTPUT_FILE.parent.mkdir(
    parents=True,
    exist_ok=True
)

df.to_csv(
    OUTPUT_FILE,
    index=False
)

print("\n" + "=" * 60)
print("CLEANING COMPLETED")
print("=" * 60)

print(f"\nCleaned dataset saved to:")

print(OUTPUT_FILE)

print("\nFinal dataset preview:")
print(df.head())

print("\nFinal dataset shape:")
print(df.shape)