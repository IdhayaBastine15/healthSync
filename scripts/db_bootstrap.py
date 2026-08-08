"""One-off DB setup against a live (e.g. Render) Postgres instance.

There's no /auth/register endpoint yet (see top-level README), so this is
how the schema gets created and the first user gets seeded on a fresh
deploy. Run with a venv that has asyncpg + bcrypt (any service's .venv
works, e.g. services/patient-service/.venv).

Usage:
    DATABASE_URL=postgresql://user:pass@host/db \
      .venv/bin/python scripts/db_bootstrap.py init-schema

    DATABASE_URL=postgresql://user:pass@host/db \
      .venv/bin/python scripts/db_bootstrap.py seed-user \
      --email doctor@healthsync.ie --password 'change-me' \
      --given-name Ada --family-name Byrne --roles DOCTOR,ADMIN
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

import asyncpg
import bcrypt

REPO_ROOT = Path(__file__).resolve().parents[1]
INIT_SQL = REPO_ROOT / "shared" / "sql" / "001_init.sql"


async def init_schema(dsn: str) -> None:
    sql = INIT_SQL.read_text()
    conn = await asyncpg.connect(dsn)
    try:
        await conn.execute(sql)
    finally:
        await conn.close()
    print(f"Schema applied from {INIT_SQL}")


async def seed_user(dsn: str, email: str, password: str, given_name: str, family_name: str, roles: list[str]) -> None:
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
    conn = await asyncpg.connect(dsn)
    try:
        row = await conn.fetchrow(
            """
            INSERT INTO patient.users (email, password_hash, given_name, family_name, roles, is_active)
            VALUES ($1, $2, $3, $4, $5, true)
            ON CONFLICT (email) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                given_name = EXCLUDED.given_name,
                family_name = EXCLUDED.family_name,
                roles = EXCLUDED.roles
            RETURNING id
            """,
            email, password_hash, given_name, family_name, roles,
        )
    finally:
        await conn.close()
    print(f"Seeded user {email} (id={row['id']}, roles={roles})")


def to_pg_dsn(url: str) -> str:
    # asyncpg wants postgresql:// not postgresql+asyncpg://
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init-schema")

    seed = sub.add_parser("seed-user")
    seed.add_argument("--email", required=True)
    seed.add_argument("--password", required=True)
    seed.add_argument("--given-name", required=True)
    seed.add_argument("--family-name", required=True)
    seed.add_argument("--roles", required=True, help="comma-separated, e.g. DOCTOR,ADMIN")

    args = parser.parse_args()
    dsn = to_pg_dsn(os.environ.get("DATABASE_URL", ""))
    if not dsn:
        print("DATABASE_URL is not set", file=sys.stderr)
        sys.exit(1)

    if args.command == "init-schema":
        asyncio.run(init_schema(dsn))
    elif args.command == "seed-user":
        roles = [r.strip() for r in args.roles.split(",") if r.strip()]
        asyncio.run(seed_user(dsn, args.email, args.password, args.given_name, args.family_name, roles))


if __name__ == "__main__":
    main()
