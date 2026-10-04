# NETRA sentiment evaluation

Model version: `netra-nlp-2026-10-v1`

Samples evaluated: 0

## Polarity

| Label | Precision | Recall | F1 | Support |
| --- | ---: | ---: | ---: | ---: |

## Emotion

| Label | Precision | Recall | F1 | Support |
| --- | ---: | ---: | ---: | ---: |

## Stance

| Label | Precision | Recall | F1 | Support |
| --- | ---: | ---: | ---: | ---: |

## Sarcasm

| Label | Precision | Recall | F1 | Support |
| --- | ---: | ---: | ---: | ---: |

No labelled set was found. Add `data/eval/hand_labels.csv` or run with `--huggingface`.

## Trend forecast rolling-origin backtest

The trend engine evaluates forecasts against the collected timeline using
rolling origins (six-hour windows, one-hour forecast horizon). The smoke
history used by the automated backtest is `[1, 2, 2, 3, 5, 8, 13, 21]`.

| Series | Origins | MAE | sMAPE |
| --- | ---: | ---: | ---: |
| Synthetic growth smoke history | 4 | 3.232 | 31.182% |

Production runs calculate the same metrics against each topic's imported
history; no wall-clock timestamps are used to make historical replay appear live.
