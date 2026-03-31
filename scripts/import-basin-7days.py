#!/usr/bin/env python3
"""
Import basin forecast CSVs (7days model) into DB.

Model: 7days  →  Swat_Results/Week/<Basin>/result/
Basins: Ping, Yom

Sources → Tables:
  Week/<Basin>/result/Bonwr_Aggregated.csv    → basin_watershed_7days
  Week/<Basin>/result/Sbonwr_Aggregated.csv   → basin_subbasin_l1_7days
  Week/<Basin>/result/Analysis_Sbswat.csv     → basin_subbasin_l2_7days

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

def zero_pad_mb(mb_code: str) -> str:
    """Normalize MB_CODE to 2-digit zero-padded string: '8' → '08'."""
    return mb_code.strip().zfill(2)

def zero_pad_sb(sb_code: str) -> str:
    """Normalize SB_CODE to 4-digit zero-padded string: '801' → '0801'."""
    return sb_code.strip().zfill(4)

def to_int(v: str):
    """Convert index value to int, handling float strings like '2.0'."""
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

def import_watershed(cur):
    print("\n[1/3] Bonwr_Aggregated.csv → basin_watershed_7days")
    columns = ["date_sim", "mb_code", "mb_name_t",
               "rainfall", "reservoir", "watersupply",
               "water_demand", "water_balance", "drought_index", "runoff_index"]
    all_rows = []

    for basin in BASINS:
        path = ROOT / f"Swat_Results/Week/{basin}/result/Bonwr_Aggregated.csv"
        if not path.exists():
            print(f"  SKIP {basin}: {path} not found")
            continue
        headers, raw = read_csv(path)
        for r in raw:
            row = dict(zip(headers, r))
            all_rows.append([
                parse_date(row["DateSim"]),
                zero_pad_mb(row["MB_CODE"]),
                row.get("MB_NAME_T")    or None,
                row.get("Rainfall")     or None,
                row.get("Reservoir")    or None,
                row.get("WaterSupply")  or None,
                row.get("WaterDemand")  or None,
                row.get("WaterBalance") or None,
                to_int(row.get("DroughtIndex", "")),
                to_int(row.get("RunoffIndex", "")),
            ])
        print(f"  {basin}: {len(raw)} rows")

    cur.execute("TRUNCATE basin_watershed_7days RESTART IDENTITY")
    copy_insert(cur, "basin_watershed_7days", columns, all_rows)
    print(f"  ✓ {len(all_rows)} total rows inserted")


def import_subbasin_l1(cur):
    print("\n[2/3] Sbonwr_Aggregated.csv → basin_subbasin_l1_7days")
    columns = ["date_sim", "sb_code", "sb_name_t", "mb_code", "mb_name_t",
               "rainfall", "reservoir", "watersupply",
               "water_demand", "water_balance", "drought_index", "runoff_index"]
    all_rows = []

    for basin in BASINS:
        path = ROOT / f"Swat_Results/Week/{basin}/result/Sbonwr_Aggregated.csv"
        if not path.exists():
            print(f"  SKIP {basin}: {path} not found")
            continue
        headers, raw = read_csv(path)
        if not raw:
            print(f"  SKIP {basin}: file is empty")
            continue
        for r in raw:
            row = dict(zip(headers, r))
            all_rows.append([
                parse_date(row["DateSim"]),
                zero_pad_sb(row["SB_CODE"]),
                row.get("SB_NAME_T")    or None,
                zero_pad_mb(row["MB_CODE"]),
                row.get("MB_NAME_T")    or None,
                row.get("Rainfall")     or None,
                row.get("Reservoir")    or None,
                row.get("WaterSupply")  or None,
                row.get("WaterDemand")  or None,
                row.get("WaterBalance") or None,
                to_int(row.get("DroughtIndex", "")),
                to_int(row.get("RunoffIndex", "")),
            ])
        print(f"  {basin}: {len(raw)} rows")

    cur.execute("TRUNCATE basin_subbasin_l1_7days RESTART IDENTITY")
    copy_insert(cur, "basin_subbasin_l1_7days", columns, all_rows)
    print(f"  ✓ {len(all_rows)} total rows inserted")


def import_subbasin_l2(cur):
    print("\n[3/3] Analysis_Sbswat.csv → basin_subbasin_l2_7days")
    columns = ["date_sim", "sbswat", "mb_code", "mb_name_t",
               "rainfall", "reservoir", "watersupply",
               "water_demand", "water_balance", "drought_index", "runoff_index"]
    all_rows = []

    for basin in BASINS:
        path = ROOT / f"Swat_Results/Week/{basin}/result/Analysis_Sbswat.csv"
        if not path.exists():
            print(f"  SKIP {basin}: {path} not found")
            continue
        headers, raw = read_csv(path)
        for r in raw:
            row = dict(zip(headers, r))
            all_rows.append([
                parse_date(row["DateSim"]),
                int(row["Sbswat"]),
                zero_pad_mb(row["MB_CODE"]),
                row.get("MB_NAME_T")    or None,
                row.get("Rainfall")     or None,
                row.get("Reservoir")    or None,
                row.get("WaterSupply")  or None,
                row.get("WaterDemand")  or None,
                row.get("WaterBalance") or None,
                to_int(row.get("DroughtIndex", "")),
                to_int(row.get("RunoffIndex", "")),
            ])
        print(f"  {basin}: {len(raw)} rows")

    cur.execute("TRUNCATE basin_subbasin_l2_7days RESTART IDENTITY")
    copy_insert(cur, "basin_subbasin_l2_7days", columns, all_rows)
    print(f"  ✓ {len(all_rows)} total rows inserted")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    conn = psycopg2.connect(**DB)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        import_watershed(cur)
        import_subbasin_l1(cur)
        import_subbasin_l2(cur)
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
