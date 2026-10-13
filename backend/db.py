"""
db.py — Direct PostgreSQL connection via psycopg2 (Neon-compatible)
Provides simple async-compatible helpers for User, Session, and Report operations.
"""
import os
import json
import logging
import uuid
from datetime import datetime, timezone
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "")

# ── Connection pool (3–10 connections) ──────────────────────────────────────
_pool: ThreadedConnectionPool | None = None


def _get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(
            minconn=2,
            maxconn=10,
            dsn=DATABASE_URL,
            connect_timeout=10,
        )
        logger.info("[db] Neon PostgreSQL connection pool created.")
    return _pool


@contextmanager
def get_cursor():
    """Context manager that yields a psycopg2 cursor and auto-commits/rolls back."""
    pool = _get_pool()
    conn = pool.getconn()
    try:
        conn.autocommit = False
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        yield cur
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"[db] Transaction rolled back: {e}")
        raise
    finally:
        pool.putconn(conn)


# ─────────────────────────────────────────────────────────────────────────────
# USER OPERATIONS
# ─────────────────────────────────────────────────────────────────────────────

def upsert_user(google_id: str, email: str, name: str, avatar: str | None = None) -> dict:
    """Creates or updates a user by google_id. Returns the user row as dict."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO users (id, google_id, email, name, avatar, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (google_id) DO UPDATE
              SET name       = EXCLUDED.name,
                  avatar     = EXCLUDED.avatar,
                  updated_at = NOW()
            RETURNING id, google_id, email, name, avatar, created_at
        """, (str(uuid.uuid4()), google_id, email, name, avatar))
        return dict(cur.fetchone())


def get_user_by_id(user_id: str) -> dict | None:
    with get_cursor() as cur:
        cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None


# ─────────────────────────────────────────────────────────────────────────────
# SESSION OPERATIONS
# ─────────────────────────────────────────────────────────────────────────────

def create_session(
    user_id: str,
    duration_seconds: int,
    transcript: str,
    fusion_log: str = "",
    masking_detection: str = "",
    voice_emotion: str = "",
    blink_count: int = 0,
    eye_contact: str = "",
) -> dict:
    """Inserts a new session row. Returns the created session as dict."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO sessions
              (id, user_id, duration_seconds, transcript, fusion_log,
               masking_detection, voice_emotion, blink_count, eye_contact, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            RETURNING *
        """, (
            str(uuid.uuid4()), user_id, duration_seconds, transcript,
            fusion_log, masking_detection, voice_emotion, blink_count, eye_contact,
        ))
        return dict(cur.fetchone())


def get_sessions_for_user(user_id: str, limit: int = 20) -> list[dict]:
    """Returns the last N sessions for a user, including their report."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT s.*, r.full_report_text, r.face_emotions, r.generated_at as report_date
            FROM sessions s
            LEFT JOIN reports r ON r.session_id = s.id
            WHERE s.user_id = %s
            ORDER BY s.created_at DESC
            LIMIT %s
        """, (user_id, limit))
        return [dict(row) for row in cur.fetchall()]


# ─────────────────────────────────────────────────────────────────────────────
# REPORT OPERATIONS
# ─────────────────────────────────────────────────────────────────────────────

def create_report(
    session_id: str,
    full_report_text: str,
    face_emotions: dict | None = None,
    deep_face_emotions: dict | None = None,
    temporal_segments: list | None = None,
) -> dict:
    """Inserts a new report row linked to a session."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO reports
              (id, session_id, full_report_text, face_emotions,
               deep_face_emotions, temporal_segments, generated_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (session_id) DO UPDATE
              SET full_report_text  = EXCLUDED.full_report_text,
                  face_emotions     = EXCLUDED.face_emotions,
                  deep_face_emotions = EXCLUDED.deep_face_emotions,
                  temporal_segments = EXCLUDED.temporal_segments,
                  generated_at      = NOW()
            RETURNING *
        """, (
            str(uuid.uuid4()),
            session_id,
            full_report_text,
            json.dumps(face_emotions or {}),
            json.dumps(deep_face_emotions or {}),
            json.dumps(temporal_segments or []),
        ))
        return dict(cur.fetchone())


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────

def db_health_check() -> bool:
    """Returns True if the database is reachable."""
    try:
        with get_cursor() as cur:
            cur.execute("SELECT 1")
            return True
    except Exception as e:
        logger.error(f"[db] Health check failed: {e}")
        return False
