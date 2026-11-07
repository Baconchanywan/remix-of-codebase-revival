"""Shared dataset contract for the leakage-safe Solana creator model."""

from dataclasses import dataclass
from typing import Final

LABEL_RULES_VERSION: Final = "v1"
FEATURE_ORDER: Final[tuple[str, ...]] = (
    "creator_prev_token_count",
    "creator_prev_rug_rate",
    "creator_prev_rug_rate_missing",
    "creator_wallet_age_days",
    "creator_wallet_age_missing",
    "creator_tx_count_pre_launch",
    "funder_is_known_bad",
    "funder_rugged_creator_count",
    "funder_missing",
    "mint_authority_revoked_at_launch",
    "mint_authority_revoked_at_launch_missing",
    "freeze_authority_revoked_at_launch",
    "freeze_authority_revoked_at_launch_missing",
    "buyers_first_hour",
    "buyer_funder_overlap",
    "buyer_funder_overlap_missing",
)


@dataclass(frozen=True)
class CreatorFeatures:
    creator_prev_token_count: int
    creator_prev_rug_rate: float
    creator_prev_rug_rate_missing: int
    creator_wallet_age_days: float
    creator_wallet_age_missing: int
    creator_tx_count_pre_launch: int
    funder_is_known_bad: int
    funder_rugged_creator_count: int
    funder_missing: int
    mint_authority_revoked_at_launch: int
    mint_authority_revoked_at_launch_missing: int
    freeze_authority_revoked_at_launch: int
    freeze_authority_revoked_at_launch_missing: int
    buyers_first_hour: int
    buyer_funder_overlap: float
    buyer_funder_overlap_missing: int

    def as_vector(self) -> list[float]:
        return [float(getattr(self, name)) for name in FEATURE_ORDER]
