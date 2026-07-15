import json
from pathlib import Path

import pytest

from lottery_ml.experiments.config import ConfigError, load_experiment_config, load_feature_config

ROOT = Path(__file__).parents[2]


def test_feature_config_defines_versioned_progressive_sets() -> None:
    config = load_feature_config(ROOT / "configs/features/v1.json")

    assert config.version == "v1"
    assert config.rolling_windows == (3, 5, 10, 20, 50, 100, 200)
    assert config.ewm_halflives == (5, 10, 20, 50)
    assert tuple(config.feature_sets) == (
        "frequency",
        "frequency_gap",
        "temporal_context",
        "full",
    )


def test_experiment_config_separates_cv_and_holdout() -> None:
    config = load_experiment_config(ROOT / "configs/experiments/development-v1.json")

    assert config.mode == "development"
    assert config.cv_validation_years == (2018, 2019, 2020, 2021, 2022, 2023)
    assert config.holdout_start.year > max(config.cv_validation_years)
    assert config.seeds == (17, 42, 2026)
    assert set(config.hyperparameters) == {
        "logistic_regression",
        "random_forest",
        "lightgbm",
    }


def test_config_rejects_unknown_keys(tmp_path: Path) -> None:
    source = json.loads(
        (ROOT / "configs/experiments/development-v1.json").read_text(encoding="utf-8")
    )
    source["unknown"] = True
    path = tmp_path / "bad.json"
    path.write_text(json.dumps(source), encoding="utf-8")

    with pytest.raises(ConfigError, match="unexpected keys"):
        load_experiment_config(path)
