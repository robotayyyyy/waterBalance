#!/usr/bin/env python3
"""
Import forecast CSVs (7days model) into DB.

Model: 7days  →  Swat_Results/Week/<Basin>/result/
Basins: Ping, Yom

Sources → Tables:
  Week/<Basin>/result/Province_Aggregated.csv  → forecast_province_7days
  Week/<Basin>/result/Amphoe_Aggregated.csv    → forecast_amphoe_7days
  Week/<Basin>/result/Tambol_Aggregated.csv    → forecast_tambon_7days

Date conversion: DateSim column (d/m/yyyy) → YYYY-MM-DD

Requires: psycopg2-binary  (pip install psycopg2-binary)
Run from project root with DB running (make db or make up).
"""

import csv
import io
import os
from datetime import datetime
from pathlib import Path

try:
    import psycopg2
except ImportError:
    raise SystemExit("Missing dependency: pip install psycopg2-binary")

# ── Config ────────────────────────────────────────────────────────────────────

DB = {
    "host":     os.getenv("DATABASE_HOST",     "localhost"),
    "port":     int(os.getenv("DATABASE_PORT", "5432")),
    "user":     os.getenv("DATABASE_USER",     "postgres"),
    "password": os.getenv("DATABASE_PASSWORD", "postgres"),
    "dbname":   os.getenv("DATABASE_NAME",     "postgres"),
}

ROOT   = Path(__file__).parent.parent
BASINS = ["Ping", "Yom"]

# ── Helpers ───────────────────────────────────────────────────────────────────

def read_csv(path: Path):
    text = path.read_text(encoding="utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    headers = [h.strip() for h in next(reader)]
    rows = [row for row in reader if any(c.strip() for c in row)]
    return headers, rows

def parse_date(s: str) -> str:
    """Convert d/m/yyyy → YYYY-MM-DD."""
    return datetime.strptime(s.strip(), "%d/%m/%Y").strftime("%Y-%m-%d")

def to_num(v: str):
    v = v.strip()
    return v if v else None

def to_int(v: str):
    v = v.strip()
    return int(float(v)) if v else None

def copy_insert(cur, table: str, columns, rows):
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter='\t', quoting=csv.QUOTE_MINIMAL)
    for row in rows:
        writer.writerow(['' if v is None else v for v in row])
    buf.seek(0)
    cur.copy_from(buf, table, columns=columns, sep='\t', null='')

# ── Import functions ──────────────────────────────────────────────────────────

def import_province(cur):
    print("\n[1/3] Province_Aggregated.csv → forecast_province_7days")
    columns = ["date_sim", "province_id", "province",
               "rainfall", "reservoir", "watersupply",
               "water_demand", "water_balance", "drought_index", "runoff_index"]
    all_rows = []

    for basin in BASINS:
        path = ROOT / f"Swat_Results/Week/{basin}/result/Province_Aggregated.csv"
        if not path.exists():
            print(f"  SKIP {basin}: {path} not found")
            continue
        headers, raw = read_csv(path)
        for r in raw:
            row = dict(zip(headers, r))
            all_rows.append([
                parse_date(row["DateSim"]),
                str(row["Province_ID"]).strip(),
                row.get("Province") or None,
                to_num(row.get("Rainfall", "")),
                to_num(row.get("Reservoir", "")),
                to_num(row.get("WaterSupply", "")),
                to_num(row.get("WaterDemand", "")),
                to_num(row.get("WaterBalance", "")),
                to_int(row.get("DroughtIndex", "")),
                to_int(row.get("RunoffIndex", "")),
            ])
        print(f"  {basin}: {len(raw)} rows")

    cur.execute("TRUNCATE forecast_province_7days RESTART IDENTITY")
    copy_insert(cur, "forecast_province_7days", columns, all_rows)
    print(f"  ✓ {len(all_rows)} total rows inserted")


def import_amphoe(cur):
    print("\n[2/3] Amphoe_Aggregated.csv → forecast_amphoe_7days")
    columns = ["date_sim", "amphoe_id", "amphoe", "province_id", "province",
               "rainfall", "reservoir", "watersupply",
               "water_demand", "water_balance", "drought_index", "runoff_index"]
    all_rows = []

    for basin in BASINS:
        path = ROOT / f"Swat_Results/Week/{basin}/result/Amphoe_Aggregated.csv"
        if not path.exists():
            print(f"  SKIP {basin}: {path} not found")
            continue
        headers, raw = read_csv(path)
        for r in raw:
            row = dict(zip(headers, r))
            all_rows.append([
                parse_date(row["DateSim"]),
                str(row["Amphoe_ID"]).strip(),
                row.get("Amphoe") or None,
                str(row["Province_ID"]).strip(),
                row.get("Province") or None,
                to_num(row.get("Rainfall", "")),
                to_num(row.get("Reservoir", "")),
                to_num(row.get("WaterSupply", "")),
                to_num(row.get("WaterDemand", "")),
                to_num(row.get("WaterBalance", "")),
                to_int(row.get("DroughtIndex", "")),
                to_int(row.get("RunoffIndex", "")),
            ])
        print(f"  {basin}: {len(raw)} rows")

    cur.execute("TRUNCATE forecast_amphoe_7days RESTART IDENTITY")
    copy_insert(cur, "forecast_amphoe_7days", columns, all_rows)
    print(f"  ✓ {len(all_rows)} total rows inserted")


def import_tambon(cur):
    print("\n[3/3] Tambol_Aggregated.csv → forecast_tambon_7days")
    columns = ["date_sim", "tambon_id", "tambon", "amphoe_id", "amphoe",
               "province_id", "province",
               "rainfall", "reservoir", "watersupply",
               "water_demand", "water_balance", "drought_index", "runoff_index"]
    all_rows = []

    for basin in BASINS:
        path = ROOT / f"Swat_Results/Week/{basin}/result/Tambol_Aggregated.csv"
        if not path.exists():
            print(f"  SKIP {basin}: {path} not found")
            continue
        headers, raw = read_csv(path)
        for r in raw:
            row = dict(zip(headers, r))
            all_rows.append([
                parse_date(row["DateSim"]),
                str(row["Tambol_ID"]).strip(),
                row.get("Tambol") or None,
                str(row["Amphoe_ID"]).strip(),
                row.get("Amphoe") or None,
                str(row["Province_ID"]).strip(),
                row.get("Province") or None,
                to_num(row.get("Rainfall", "")),
                to_num(row.get("Reservoir", "")),
                to_num(row.get("WaterSupply", "")),
                to_num(row.get("WaterDemand", "")),
                to_num(row.get("WaterBalance", "")),
                to_int(row.get("DroughtIndex", "")),
                to_int(row.get("RunoffIndex", "")),
            ])
        print(f"  {basin}: {len(raw)} rows")

    cur.execute("TRUNCATE forecast_tambon_7days RESTART IDENTITY")
    copy_insert(cur, "forecast_tambon_7days", columns, all_rows)
    print(f"  ✓ {len(all_rows)} total rows inserted")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    conn = psycopg2.connect(**DB)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        import_province(cur)
        import_amphoe(cur)
        import_tambon(cur)
        conn.commit()
        print("\nDone.\n")
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
