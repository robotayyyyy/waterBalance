#!/usr/bin/env python3
"""
Import forecast CSVs into DB (6months tables only).

Usage:  python3 scripts/import-forecast-6months.py

Reads:  forecastdata/province_analyze.csv  → forecast_province_6months
        forecastdata/amphoe_analyze.csv    → forecast_amphoe_6months
        forecastdata/tambon_analyze.csv    → forecast_tambon_6months

Requires: psycopg2-binary  (pip install psycopg2-binary)
Run from project root with DB running (make db or make up).
"""

import os
import csv
import io
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

ROOT = Path(__file__).parent.parent

# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_date(s: str) -> str:
    """Convert DD/MM/YYYY → YYYY-MM-DD."""
    return datetime.strptime(s.strip(), "%d/%m/%Y").strftime("%Y-%m-%d")

def read_csv(path: Path):
    """Read CSV, strip BOM, return (headers, rows)."""
    text = path.read_text(encoding="utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    headers = [h.strip() for h in next(reader)]
    rows = [row for row in reader if any(c.strip() for c in row)]
    return headers, rows

def copy_insert(cur, table: str, columns, rows):
    """Use COPY for fast bulk insert via in-memory buffer."""
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter='\t', quoting=csv.QUOTE_MINIMAL)
    for row in rows:
        writer.writerow(['' if v is None else v for v in row])
    buf.seek(0)
    cur.copy_from(buf, table, columns=columns, sep='\t', null='')

# ── Import functions ──────────────────────────────────────────────────────────

def import_province(cur):
    print("\n[1/3] province_analyze.csv → forecast_province_6months")
    headers, raw = read_csv(ROOT / "forecastdata/province_analyze.csv")

    columns = ["date_sim","province_id","province","date_forecast",
                "rainfall","watersupply","reservoir","water_demand",
                "water_balance","drought_index","runoff_index"]
    rows = []
    for r in raw:
        row = dict(zip(headers, r))
        rows.append([
            parse_date(row["DateSim"]),
            row["Province_ID"],
            row["Province"],
            row["DateForecast"],
            row.get("Daily_Rainfall") or None,
            row.get("Watersupply")    or None,
            row.get("Reservoir")      or None,
            row.get("WaterDemand")    or None,
            row.get("WaterBalance")   or None,
            row.get("DroughtIndex")   or None,
            row.get("RunoffIndex")    or None,
        ])

    cur.execute("TRUNCATE forecast_province_6months RESTART IDENTITY")
    copy_insert(cur, "forecast_province_6months", columns, rows)
    print(f"  ✓ {len(rows)} rows inserted")

def import_amphoe(cur):
    print("\n[2/3] amphoe_analyze.csv → forecast_amphoe_6months")
    headers, raw = read_csv(ROOT / "forecastdata/amphoe_analyze.csv")

    columns = ["date_sim","amphoe_id","amphoe","province_id","province",
                "date_forecast","rainfall","watersupply","reservoir",
                "water_demand","water_balance","drought_index","runoff_index"]
    rows = []
    for r in raw:
        row = dict(zip(headers, r))
        rows.append([
            parse_date(row["DateSim"]),
            row["Amphoe_ID"],
            row["Amphoe"],
            row["Province_ID"],
            row["Province"],
            row["DateForecast"],
            row.get("Rainfall")    or None,
            row.get("Watersupply") or None,
            row.get("Reservoir")   or None,
            row.get("WaterDemand") or None,
            row.get("WaterBalance")or None,
            row.get("DroughtIndex")or None,
            row.get("RunoffIndex") or None,
        ])

    cur.execute("TRUNCATE forecast_amphoe_6months RESTART IDENTITY")
    copy_insert(cur, "forecast_amphoe_6months", columns, rows)
    print(f"  ✓ {len(rows)} rows inserted")

def import_tambon(cur):
    print("\n[3/3] tambon_analyze.csv → forecast_tambon_6months")
    headers, raw = read_csv(ROOT / "forecastdata/tambon_analyze.csv")

    columns = ["date_sim","tambon_id","tambon","amphoe_id","amphoe",
                "province_id","province","date_forecast","rainfall",
                "watersupply","reservoir","water_demand","water_balance",
                "drought_index","runoff_index"]
    rows = []
    for r in raw:
        row = dict(zip(headers, r))
        rows.append([
            parse_date(row["DateSim"]),
            row["Tambon_ID"],
            row["Tambon"],
            row["Amphoe_ID"],
            row["Amphoe"],
            row["Province_ID"],
            row["Province"],
            row["DateForecast"],
            row.get("Rainfall")    or None,
            row.get("Watersupply") or None,
            row.get("Reservoir")   or None,
            row.get("WaterDemand") or None,
            row.get("WaterBalance")or None,
            row.get("DroughtIndex")or None,
            row.get("RunoffIndex") or None,
        ])

    cur.execute("TRUNCATE forecast_tambon_6months RESTART IDENTITY")
    copy_insert(cur, "forecast_tambon_6months", columns, rows)
    print(f"  ✓ {len(rows)} rows inserted")

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
