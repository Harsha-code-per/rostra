from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# shortcut: in-memory counters are per-process, upgrade to a Redis storage_uri when running >1 instance
limiter = Limiter(key_func=get_remote_address, enabled=settings.RATE_LIMIT_ENABLED)
