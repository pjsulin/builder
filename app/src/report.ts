// A problem report: the model and the names of the last operations, saved as a
// file when an operation fails so the model can be sent along with the bug. No
// network; the user downloads it and sends it by hand.

import type { Model } from "./kernel/model";
import { errorMessage } from "./tools/tool";

export interface ProblemReport {
  version: 1;
  /** ISO date. */
  when: string;
  fileName: string;
  error: string;
  /** `Model.journal`, oldest first: transaction names, not replayable operations. */
  operations: string[];
  /** `Model.toJson()`. */
  model: string;
}

export function buildReport(model: Model, fileName: string, error: unknown): ProblemReport {
  return {
    version: 1,
    when: new Date().toISOString(),
    fileName,
    error: errorMessage(error),
    operations: [...model.journal],
    model: model.toJson(),
  };
}

/** `shed.builder` → `shed-report.json`. */
export function reportFileName(fileName: string): string {
  const stem = fileName.replace(/\.[^.]*$/, "") || "model";
  return `${stem}-report.json`;
}
