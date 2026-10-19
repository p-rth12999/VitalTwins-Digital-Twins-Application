import os
import numpy as np
import pandas as pd

np.random.seed(42)

DATA_DIR = os.path.dirname(os.path.abspath(__file__))

def generate_ehr_data(num_patients=500):
    patient_ids = [f"PAT_{i:03d}" for i in range(1, num_patients + 1)]
    ages = np.random.randint(28, 78, size=num_patients)
    genders = np.random.choice(["M", "F"], size=num_patients)
    bmi = np.round(np.random.normal(26.5, 4.2, size=num_patients), 1)
    
    # Correlate blood pressure and cholesterol slightly with age and BMI
    systolic_bp = np.round(100 + 0.5 * ages + 0.6 * bmi + np.random.normal(0, 12, num_patients)).astype(int)
    diastolic_bp = np.round(65 + 0.2 * ages + 0.3 * bmi + np.random.normal(0, 8, num_patients)).astype(int)
    cholesterol = np.round(150 + 0.8 * ages + np.random.normal(0, 30, num_patients)).astype(int)
    
    hypertension = ((systolic_bp > 140) | (diastolic_bp > 90)).astype(int)
    diabetes = ((bmi > 29) & (ages > 45) | (np.random.rand(num_patients) < 0.18)).astype(int)
    smoker = (np.random.rand(num_patients) < 0.22).astype(int)

    # Calculate ground-truth baseline risk probability for training
    risk_logit = (
        -6.5
        + 0.05 * ages
        + 0.08 * (bmi - 25)
        + 0.03 * (systolic_bp - 120)
        + 0.01 * (cholesterol - 180)
        + 1.1 * hypertension
        + 0.9 * diabetes
        + 0.7 * smoker
    )
    risk_prob = 1 / (1 + np.exp(-risk_logit))
    high_risk_label = (risk_prob > 0.5).astype(int)

    df_ehr = pd.DataFrame({
        "patient_id": patient_ids,
        "name": [f"Patient {i}" for i in range(1, num_patients + 1)],
        "age": ages,
        "gender": genders,
        "bmi": bmi,
        "systolic_bp": systolic_bp,
        "diastolic_bp": diastolic_bp,
        "cholesterol_mg_dl": cholesterol,
        "hypertension_history": hypertension,
        "diabetes_history": diabetes,
        "smoker": smoker,
        "high_baseline_risk": high_risk_label
    })

    # Force PAT_001 to be a realistic high-risk profile and PAT_002 to be low-risk for live demos
    df_ehr.loc[0] = ["PAT_001", "Rajesh Sharma", 61, "M", 29.4, 152, 94, 238, 1, 1, 0, 1]
    df_ehr.loc[1] = ["PAT_002", "Ananya Deshmukh", 34, "F", 22.8, 116, 76, 172, 0, 0, 0, 0]

    ehr_path = os.path.join(DATA_DIR, "synthetic_ehr.csv")
    df_ehr.to_csv(ehr_path, index=False)
    print(f"[+] Generated Static EHR dataset: {ehr_path} ({len(df_ehr)} patients)")


def generate_wearable_stream(hours=48):
    records = []

    # 1. PAT_001: Anomaly trajectory (Degrades starting at hour 28)
    for h in range(hours):
        if h < 28:
            rhr = np.random.normal(74, 2.5)
            hrv = np.random.normal(52, 3.0)
            spo2 = np.random.normal(97.5, 0.5)
        else:
            # Progressive autonomic nervous system stress before arrhythmia
            progression = (h - 27) / (hours - 27)
            rhr = 74 + (32 * progression) + np.random.normal(0, 3.5)
            hrv = 52 - (26 * progression) + np.random.normal(0, 2.0)
            spo2 = 97.5 - (3.2 * progression) + np.random.normal(0, 0.4)

        records.append({
            "patient_id": "PAT_001",
            "hour_offset": h,
            "heart_rate_bpm": round(max(55, min(145, rhr)), 1),
            "hrv_ms": round(max(15, min(90, hrv)), 1),
            "spo2_pct": round(max(88, min(100, spo2)), 1),
            "step_count": int(np.random.choice([0, 120, 340, 50], p=[0.4, 0.3, 0.2, 0.1]))
        })

    # 2. PAT_002: Stable healthy trajectory
    for h in range(hours):
        rhr = np.random.normal(66, 2.0)
        hrv = np.random.normal(68, 3.5)
        spo2 = np.random.normal(98.5, 0.4)

        records.append({
            "patient_id": "PAT_002",
            "hour_offset": h,
            "heart_rate_bpm": round(rhr, 1),
            "hrv_ms": round(hrv, 1),
            "spo2_pct": round(min(100, spo2), 1),
            "step_count": int(np.random.choice([0, 250, 600, 110], p=[0.3, 0.3, 0.3, 0.1]))
        })

    df_stream = pd.DataFrame(records)
    stream_path = os.path.join(DATA_DIR, "wearable_stream.csv")
    df_stream.to_csv(stream_path, index=False)
    print(f"[+] Generated Dynamic Wearable dataset: {stream_path} ({len(df_stream)} hourly records)")


if __name__ == "__main__":
    generate_ehr_data()
    generate_wearable_stream()