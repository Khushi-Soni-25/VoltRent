# Voltride AI Modules

This folder contains isolated AI/ML code for additive Voltride features.

The existing PHP/XAMPP/MySQL application remains the source of truth. These
modules do not modify production data and do not require database migrations.

## Modules

- `recommendation/battery_recommender.py` provides an explainable dealer-level
  battery/service recommendation engine.
- `training/train_health_model.py` trains a battery health classifier from a
  clearly labelled development dataset.
- `training/train_demand_model.py` trains a demand prediction regressor from a
  clearly labelled development dataset.
- `prediction/health_predictor.py` loads a saved health model for inference.
- `prediction/demand_predictor.py` loads a saved demand model for inference.

## Data Safety

The CSV files in `datasets/` are synthetic development samples. They must not
be inserted into the production MySQL/MariaDB database.

Train models offline with:

```bash
python ml/training/train_health_model.py
python ml/training/train_demand_model.py
```

