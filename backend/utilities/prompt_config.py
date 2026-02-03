
import json
import logging
import os
from functools import lru_cache

logger = logging.getLogger(__name__)

DEFAULT_PROMPTS_PATH = os.path.join("configs", "prompts.json")


@lru_cache(maxsize=1)
def _load_prompts(path: str = DEFAULT_PROMPTS_PATH) -> dict:
    """
    Load prompts JSON once and cache it.
    Falls back to {} if file is missing or invalid.
    """
    try:
        if not os.path.exists(path):
            logger.warning(f"Prompts file not found at {path}; using built-in defaults.")
            return {}
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            logger.warning("Prompts file did not contain a top-level object; using defaults.")
            return {}
        return data
    except Exception as e:
        logger.error(f"Failed to load prompts from {path}: {e}")
        return {}


def get_system_prompt(mode: str, default: str = "") -> str:
    """
    Return system prompt string for a given mode (e.g. 'chat', 'vibe_coding', 'image', 'web').
    Falls back to `default` if not configured or invalid.
    """
    prompts = _load_prompts()
    try:
        value = prompts.get(mode, {}).get("system_prompt")
        if isinstance(value, str) and value.strip():
            return value
    except Exception:
        pass
    return default
