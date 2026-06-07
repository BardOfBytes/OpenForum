#!/usr/bin/env python3
"""Apply the OpenForum Supabase public schema using local credentials."""

from __future__ import annotations

from pathlib import Path
import re
import sys

import psycopg


ROOT = Path(__file__).resolve().parents[1]
CREDS_PATH = ROOT / "supabase_creds.txt"
SQL_PATH = ROOT / "supabase" / "migrations" / "002_create_openforum_public_schema.sql"
PUBLIC_TABLES = ("profiles", "articles", "bookmarks", "likes", "comments", "follows")
COMMENT_MODERATION_COLUMNS = ("is_hidden", "hidden_at", "hidden_by")
COMMENT_MODERATION_INDEX = "idx_comments_visible_article_id"
PROFILE_HEADLINE_COLUMN = "headline"


def read_creds() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in CREDS_PATH.read_text().splitlines():
        line = raw_line.strip()
        if not line or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip().lower()] = value.strip()
    return values


def conninfo_from_creds(creds: dict[str, str], use_pooler: bool = False) -> str:
    project_url = creds.get("project url", "")
    password = creds.get("db pass", "")
    match = re.search(r"https://([a-z0-9]+)\.supabase\.co/?$", project_url)
    if not match or not password:
        raise RuntimeError("supabase_creds.txt is missing Project URL or DB pass")
    project_ref = match.group(1)

    if use_pooler:
        pooler = creds.get("pooler connection string", "")
        pooler_match = re.search(r"@([^:/]+):(\d+)/([^?\s]+)", pooler)
        if not pooler_match:
            raise RuntimeError("supabase_creds.txt is missing a valid Pooler Connection string")
        return psycopg.conninfo.make_conninfo(
            "",
            host=pooler_match.group(1),
            port=int(pooler_match.group(2)),
            dbname=pooler_match.group(3),
            user=f"postgres.{project_ref}",
            password=password,
            sslmode="require",
            connect_timeout=10,
        )

    return psycopg.conninfo.make_conninfo(
        "",
        host=f"db.{project_ref}.supabase.co",
        port=5432,
        dbname="postgres",
        user="postgres",
        password=password,
        sslmode="require",
        connect_timeout=10,
    )


def main() -> int:
    if not CREDS_PATH.exists():
        raise RuntimeError(f"Missing credentials file: {CREDS_PATH}")
    if not SQL_PATH.exists():
        raise RuntimeError(f"Missing SQL migration file: {SQL_PATH}")

    creds = read_creds()
    sql = SQL_PATH.read_text()

    print("Connecting to Supabase Postgres...")
    try:
        conn = psycopg.connect(conninfo_from_creds(creds), autocommit=False)
    except psycopg.OperationalError as direct_error:
        print("Direct host connection failed; retrying via Supabase pooler...")
        try:
            conn = psycopg.connect(conninfo_from_creds(creds, use_pooler=True), autocommit=False)
        except psycopg.OperationalError:
            raise direct_error

    with conn:
        with conn.cursor() as cur:
            print("Applying OpenForum public schema...")
            cur.execute(sql)
            conn.commit()

            cur.execute(
                """
                select table_name
                from information_schema.tables
                where table_schema = 'public'
                  and table_name = any(%s)
                order by table_name
                """,
                (list(PUBLIC_TABLES),),
            )
            tables = [row[0] for row in cur.fetchall()]

            cur.execute(
                """
                select tablename, count(*)::int
                from pg_policies
                where schemaname = 'public'
                  and tablename = any(%s)
                group by tablename
                order by tablename
                """,
                (list(PUBLIC_TABLES),),
            )
            policies = dict(cur.fetchall())

            cur.execute(
                """
                select column_name
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'comments'
                  and column_name = any(%s)
                order by column_name
                """,
                (list(COMMENT_MODERATION_COLUMNS),),
            )
            moderation_columns = [row[0] for row in cur.fetchall()]

            cur.execute(
                """
                select exists (
                  select 1
                  from information_schema.columns
                  where table_schema = 'public'
                    and table_name = 'articles'
                    and column_name = 'subtitle'
                )
                """
            )
            has_article_subtitle = bool(cur.fetchone()[0])

            cur.execute(
                """
                select exists (
                  select 1
                  from information_schema.columns
                  where table_schema = 'public'
                    and table_name = 'profiles'
                    and column_name = %s
                )
                """,
                (PROFILE_HEADLINE_COLUMN,),
            )
            has_profile_headline = bool(cur.fetchone()[0])

            cur.execute(
                """
                select exists (
                  select 1
                  from pg_indexes
                  where schemaname = 'public'
                    and tablename = 'comments'
                    and indexname = %s
                )
                """,
                (COMMENT_MODERATION_INDEX,),
            )
            has_moderation_index = bool(cur.fetchone()[0])

            cur.execute(
                """
                SELECT
                  a.id,
                  a.slug,
                  a.title,
                  a.excerpt,
                  a.body,
                  a.content_gdoc_id,
                  a.tags,
                  a.status,
                  a.created_at,
                  a.updated_at,
                  a.views,
                  a.cover_image_url,
                  a.category_name,
                  a.author_id,
                  coalesce(
                    nullif(trim(p.display_name), ''),
                    nullif(trim(p.username), ''),
                    nullif(split_part(p.email, '@', 1), ''),
                    'Unknown Author'
                  ) as author_name,
                  p.avatar_url as author_avatar_url
                FROM articles a
                LEFT JOIN profiles p ON p.id = a.author_id
                WHERE lower(a.status) IN ('published', 'draft')
                ORDER BY a.created_at DESC
                LIMIT 1
                """
            )
            article_contract_rows = len(cur.fetchall())

    print("Created/verified tables: " + ", ".join(tables))
    print(
        "RLS policies: "
        + ", ".join(f"{table}={policies.get(table, 0)}" for table in PUBLIC_TABLES)
    )
    print("Comment moderation columns: " + ", ".join(moderation_columns))
    print(f"Profile headline column: profiles.{PROFILE_HEADLINE_COLUMN}={has_profile_headline}")
    print(f"Article subtitle column: articles.subtitle={has_article_subtitle}")
    print(f"Comment moderation index: {COMMENT_MODERATION_INDEX}={has_moderation_index}")
    print(f"Article list contract query: ok rows={article_contract_rows}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
