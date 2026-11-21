# Voltride AI Data Strategy

## Current

The live Voltride application data is limited. It is useful for testing
read-only integration and dealer-level recommendation, but it is not enough to
validate production machine learning models.

## Current AI

Smart Recommendation uses live dealer and inventory data when MySQL is
available. It is an explainable scoring engine, not a trained prediction model.
It can work with very small datasets because it ranks existing dealers using
available stock, location, service type, and request priority.

## Prototype Models

Battery Health and Demand Prediction currently use synthetic development data.
They are prototypes only and are not production-validated. Their metrics should
not be interpreted as real-world Voltride accuracy.

Synthetic prototype data must not be inserted into the production MySQL
database.

## Future

As real Voltride usage accumulates, the future production ML path is:

```text
MySQL
  |
  v
Historical dataset
  |
  v
Data cleaning
  |
  v
Feature engineering
  |
  v
Train/test split
  |
  v
Model comparison
  |
  v
Evaluation
  |
  v
Production model
```

Useful future demand features already present in the existing schema include:

- Request timestamp: `requests.created_at`
- Service type: `requests.stype`
- Request priority: `requests.priority`
- Request status and outcome: `requests.status`
- Request location: `requests.location`, `requests.lat`, `requests.lng`
- Dealer assignment: `requests.dealer_id`
- Agent assignment: `requests.agent_id`
- Timeline events when populated: `request_timeline.done_at`
- Dealer stock: `dealers.bat_stock`, `dealers.chg_stock`
- Inventory history when populated: `inventory_log.logged_at`, `inventory_log.delta`

Battery health production modeling will require real battery-level telemetry
that is not currently present in the live schema, such as battery identifiers,
age, charging cycles, temperature, voltage, capacity, usage hours, and
maintenance history.

