import { describe, expect, it } from "vitest";
import { JOURNAL_SIZE, Model, ROOT } from "../src/kernel/model";
import { buildReport, reportFileName } from "../src/report";
import { newModel } from "./helpers";

describe("Problem report", () => {
  it("carries the operation names in order, the error and a loadable model", () => {
    const m = newModel();
    m.transact("Line", () => m.addLine(ROOT, [0, 0, 0], [10, 0, 0]));
    m.transact("Push/Pull", () => m.addLine(ROOT, [10, 0, 0], [10, 10, 0]));
    const r = buildReport(m, "shed.builder", new Error("boom"));
    expect(r.version).toBe(1);
    expect(r.operations).toEqual(["Line", "Push/Pull"]);
    expect(r.error).toBe("Boom");
    expect(r.fileName).toBe("shed.builder");
    expect(Number.isNaN(Date.parse(r.when))).toBe(false);
    expect(Model.fromJson(r.model).stats().edges).toBe(2);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });

  it("names the file after the model's", () => {
    expect(reportFileName("shed.builder")).toBe("shed-report.json");
    expect(reportFileName("model")).toBe("model-report.json");
    expect(reportFileName(".builder")).toBe("model-report.json");
  });

  it("keeps only the last transactions, including aborted ones", () => {
    const m = newModel();
    for (let i = 0; i < JOURNAL_SIZE + 5; i++) {
      try {
        m.transact(`Op ${i}`, () => {
          if (i % 2) throw new Error("no");
        });
      } catch {
        // an aborted transaction is still a recorded attempt
      }
    }
    expect(m.journal.length).toBe(JOURNAL_SIZE);
    expect(m.journal[0]).toBe("Op 5");
    expect(m.journal[JOURNAL_SIZE - 1]).toBe(`Op ${JOURNAL_SIZE + 4}`);
  });
});
