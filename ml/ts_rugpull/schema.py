"""Feature contract for the TS-RugPull project model (EVM, project-level)."""
from typing import Final

LABEL_RULES_VERSION: Final = "ts-rugpull-manual-v1"
FEATURE_ORDER: Final[tuple[str, ...]] = (
    "chain_eth",
    "chain_bsc",
    "log_holder_count",
)
