"""Rejection helpers for names removed by the 0.2 product rename."""

from collections.abc import Mapping

_OLD_PREFIX = "D" + "SH"


def reject_legacy_environment(env: Mapping[str, str]) -> None:
    """Reject pre-0.2 environment variables with their Nomix replacements."""
    legacy = sorted(key for key in env if key.startswith(f"{_OLD_PREFIX}_"))
    if not legacy:
        return
    replacements = ", ".join(
        f"{key} -> NOMIX_{key[len(_OLD_PREFIX) + 1:]}" for key in legacy
    )
    raise RuntimeError(
        f"Nomix 0.2 does not accept legacy environment variables: {replacements}"
    )
