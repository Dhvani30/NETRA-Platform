"""PostgreSQL storage helpers for NETRA's graph layer."""
from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / '.env')
from contextlib import contextmanager
from typing import Iterator
import psycopg2
from psycopg2.pool import ThreadedConnectionPool

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
_pool: ThreadedConnectionPool | None = None

def initialize_pool() -> None:
    global _pool
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL (or POSTGRES_URL) is required for PostgreSQL graph storage")
    if _pool is None:
        _pool = ThreadedConnectionPool(1, 12, DATABASE_URL, connect_timeout=10)
    initialize_schema()

@contextmanager
def get_connection() -> Iterator[psycopg2.extensions.connection]:
    if _pool is None:
        initialize_pool()
    assert _pool is not None
    connection = _pool.getconn()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        _pool.putconn(connection)

def initialize_schema() -> None:
    if _pool is None:
        return
    connection = _pool.getconn()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""CREATE TABLE IF NOT EXISTS graph_nodes (id TEXT PRIMARY KEY, label TEXT NOT NULL, node_type TEXT NOT NULL, properties JSONB NOT NULL DEFAULT '{}'::jsonb)""")
            cursor.execute("""CREATE TABLE IF NOT EXISTS graph_edges (source TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE, target TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE, edge_type TEXT NOT NULL, PRIMARY KEY (source, target, edge_type))""")
            cursor.execute("CREATE INDEX IF NOT EXISTS graph_edges_target_idx ON graph_edges (target)")
            cursor.execute("CREATE INDEX IF NOT EXISTS graph_nodes_type_idx ON graph_nodes (node_type)")
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        _pool.putconn(connection)

def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None