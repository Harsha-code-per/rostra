from typing import Any, Dict, Tuple
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# libpq-style parameters that asyncpg does not accept as URL query options.
_LIBPQ_ONLY = {"sslmode", "channel_binding", "options"}


def prepare_database_url(url: str) -> Tuple[str, Dict[str, Any]]:
    """Return (async SQLAlchemy URL, connect_args). Handles Render/Neon style URLs."""
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]

    connect_args: Dict[str, Any] = {}
    if url.startswith("postgresql+asyncpg://"):
        parts = urlsplit(url)
        query = parse_qsl(parts.query, keep_blank_values=True)
        if any(k == "sslmode" and v in ("require", "verify-ca", "verify-full") for k, v in query):
            connect_args["ssl"] = True
        url = urlunsplit(parts._replace(query=urlencode([(k, v) for k, v in query if k not in _LIBPQ_ONLY])))
    elif url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    return url, connect_args
