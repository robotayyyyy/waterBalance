#!/usr/bin/env python3
"""
Import forecast CSVs (6months model) into DB.

Model: 6months  →  Swat_Results/Month/<Basin>/result/
Basins: Ping, Yom

Sources → Tables:
  Month/<Basin>/result/Province_Aggregated.csv  → forecast_province_6months
  Month/<Basin>/result/Amphoe_Aggregated.csv    → forecast_amphoe_6months
  Month/<Basin>/result/Tambol_Aggregated.csv    → forecast_tambon_6months

Date conversion: YEAR + MON columns → YYYY-MM-01

Requires: psycopg2-binary  (pip install psycopg2-binary)
Run from project root with DB running (make db or make up).
"""

import csv
import io
import os
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

ROOT      = Path(__file__).parent.parent
BASINS    = ["Ping", "Yom"]
BASIN_MB  = {"Ping": "06", "Yom": "08"}

# ── Helpers ───────────────────────────────────────────────────────────────────

def read_csv(path: Path):
    text = path.read_text(encoding="utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    headers = [h.strip() for h in next(reader)]
    rows = [row for row in reader if any(c.strip() for c in row)]
    return headers, rows

def year_mon_to_date(year: str, mon: str) -> str:
    """Convert YEAR + MON integers → YYYY-MM-01."""
    return f"{int(year):04d}-{int(mon):02d}-01"

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
    print("\n[1/3] Province_Aggregated.csv → forecast_province_6months")
    columns = ["date_sim", "mb_code", "province_id", "province",
               "rainfall", "reservoir", "watersupply",
               "water_demand", "water_balance", "drought_index", "runoff_index"]
    all_rows = []

    for basin in BASINS:
        path = ROOT / f"Swat_Results/Month/{basin}/result/Province_Aggregated.csv"
        if not path.exists():
            print(f"  SKIP {basin}: {path} not found")
            continue
        headers, raw = read_csv(path)
        mb_code = BASIN_MB[basin]
        for r in raw:
            row = dict(zip(headers, r))
            all_rows.append([
                year_mon_to_date(row["YEAR"], row["MON"]),
                mb_code,
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

    cur.execute("TRUNCATE forecast_province_6months RESTART IDENTITY")
    copy_insert(cur, "forecast_province_6months", columns, all_rows)
    print(f"  ✓ {len(all_rows)} total rows inserted")


def import_amphoe(cur):
    print("\n[2/3] Amphoe_Aggregated.csv → forecast_amphoe_6months")
    columns = ["date_sim", "mb_code", "amphoe_id", "amphoe", "province_id", "province",
               "rainfall", "reservoir", "watersupply",
               "water_demand", "water_balance", "drought_index", "runoff_index"]
    all_rows = []

    for basin in BASINS:
        path = ROOT / f"Swat_Results/Month/{basin}/result/Amphoe_Aggregated.csv"
        if not path.exists():
            print(f"  SKIP {basin}: {path} not found")
            continue
        headers, raw = read_csv(path)
        mb_code = BASIN_MB[basin]
        for r in raw:
            row = dict(zip(headers, r))
            all_rows.append([
                year_mon_to_date(row["YEAR"], row["MON"]),
                mb_code,
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

    cur.execute("TRUNCATE forecast_amphoe_6months RESTART IDENTITY")
    copy_insert(cur, "forecast_amphoe_6months", columns, all_rows)
    print(f"  ✓ {len(all_rows)} total rows inserted")


def import_tambon(cur):
    print("\n[3/3] Tambol_Aggregated.csv → forecast_tambon_6months")
    columns = ["date_sim", "mb_code", "tambon_id", "tambon", "amphoe_id", "amphoe",
               "province_id", "province",
               "rainfall", "reservoir", "watersupply",
               "water_demand", "water_balance", "drought_index", "runoff_index"]
    all_rows = []

    for basin in BASINS:
        path = ROOT / f"Swat_Results/Month/{basin}/result/Tambol_Aggregated.csv"
        if not path.exists():
            print(f"  SKIP {basin}: {path} not found")
            continue
        headers, raw = read_csv(path)
        mb_code = BASIN_MB[basin]
        for r in raw:
            row = dict(zip(headers, r))
            all_rows.append([
                year_mon_to_date(row["YEAR"], row["MON"]),
                mb_code,
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

    cur.execute("TRUNCATE forecast_tambon_6months RESTART IDENTITY")
    copy_insert(cur, "forecast_tambon_6months", columns, all_rows)
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
