"""Evaluate NETRA NLP against local labels, with optional capped HF datasets."""
from __future__ import annotations
import argparse, csv, json, sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.nlp.infer import infer_batch, MODEL_VERSION  # noqa: E402

def _metric(rows, field):
    labels = sorted({str(r.get(field, "")) for r in rows if r.get(field, "") != ""} | {str(r["pred"].get(field, "")) for r in rows})
    result = {}
    for label in labels:
        tp = sum(r.get(field) == label and r["pred"].get(field) == label for r in rows)
        fp = sum(r.get(field) != label and r["pred"].get(field) == label for r in rows)
        fn = sum(r.get(field) == label and r["pred"].get(field) != label for r in rows)
        precision, recall = tp / (tp + fp) if tp + fp else 0, tp / (tp + fn) if tp + fn else 0
        result[label] = {"precision": round(precision, 3), "recall": round(recall, 3), "f1": round(2*precision*recall/(precision+recall), 3) if precision+recall else 0, "support": tp + fn}
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cap", type=int, default=500)
    parser.add_argument("--huggingface", action="store_true", help="Fetch capped public datasets (requires datasets and network).")
    args = parser.parse_args()
    rows = []
    label_file = ROOT / "data" / "eval" / "hand_labels.csv"
    if label_file.exists():
        with label_file.open(encoding="utf-8", newline="") as handle:
            rows.extend(dict(row) for row in csv.DictReader(handle))
    if args.huggingface:
        try:
            from datasets import load_dataset
            dataset = load_dataset("tweet_eval", "sentiment", split=f"test[:{args.cap}]")
            mapping = {0: "negative", 1: "neutral", 2: "positive"}
            rows.extend({"text": item["text"], "polarity": mapping[item["label"]]} for item in dataset)
        except Exception as exc:
            print(f"Hugging Face evaluation skipped: {exc}")
    predictions = infer_batch(rows)
    evaluated = []
    for row, prediction in zip(rows, predictions):
        evaluated.append({**row, "pred": {"polarity": prediction["sentiment"]["label"], "emotion": prediction["emotions"]["label"], "stance": prediction["stance"]["label"], "sarcasm": "true" if prediction["sarcasm"]["prob"] >= .5 else "false"}})
    report = {"generated_at": datetime.now(timezone.utc).isoformat(), "model_version": MODEL_VERSION, "samples": len(evaluated), "metrics": {field: _metric(evaluated, field) for field in ("polarity", "emotion", "stance", "sarcasm")}}
    (ROOT / "docs" / "EVALUATION.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    lines = ["# NETRA sentiment evaluation", "", f"Model version: `{MODEL_VERSION}`", "", f"Samples evaluated: {len(evaluated)}", ""]
    for task, table in report["metrics"].items():
        lines += [f"## {task.title()}", "", "| Label | Precision | Recall | F1 | Support |", "| --- | ---: | ---: | ---: | ---: |"]
        lines += [f"| {label} | {values['precision']:.3f} | {values['recall']:.3f} | {values['f1']:.3f} | {values['support']} |" for label, values in table.items()]
        lines.append("")
    if not evaluated: lines.append("No labelled set was found. Add `data/eval/hand_labels.csv` or run with `--huggingface`.")
    (ROOT / "docs" / "EVALUATION.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps(report, indent=2))

if __name__ == "__main__": main()
