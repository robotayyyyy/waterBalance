#!/usr/bin/env python3
"""
Truncate all 6 forecast tables (province/amphoe/tambon × 7days/6months).

Usage:  python3 scripts/truncate-forecast.py

Requires: psycopg2-binary  (pip install psycopg2-binary)
Run from project root with DB running (make db or make up).
"""

import os

try:
    import psycopg2
except ImportError:
    raise SystemExit("Missing dependency: pip install psycopg2-binary")

DB = {
    "host":     os.getenv("DATABASE_HOST",     "localhost"),
    "port":     int(os.getenv("DATABASE_PORT", "5432")),
    "user":     os.getenv("DATABASE_USER",     "postgres"),
    "password": os.getenv("DATABASE_PASSWORD", "postgres"),
    "dbname":   os.getenv("DATABASE_NAME",     "postgres"),
}

TABLES = [
    "forecast_province_7days",
    "forecast_province_6months",
    "forecast_amphoe_7days",
    "forecast_amphoe_6months",
    "forecast_tambon_7days",
    "forecast_tambon_6months",
]

def main():
    conn = psycopg2.connect(**DB)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        for table in TABLES:
            cur.execute(f"TRUNCATE {table} RESTART IDENTITY")
            print(f"  ✓ {table} truncated")
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
