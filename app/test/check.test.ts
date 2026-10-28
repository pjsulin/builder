import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { describeFinding } from "../src/app";
import { Model, ROOT } from "../src/kernel/model";
import { newModel } from "./helpers";

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../kernel/tests/fixtures/${name}`, import.meta.url)), "utf8");

describe("Model check", () => {
  it("is clean for geometry the kernel drew", () => {
    const m = newModel();
    m.transact("Line", () => m.addLine(ROOT, [0, 0, 0], [10, 0, 0]));
    // A loose edge borders no face: the one finding the kernel itself can make.
    expect(m.checkModel().map((f) => f.kind)).toEqual(["faceless_edge"]);
    m.transact("Lines", () => {
      m.addLine(ROOT, [10, 0, 0], [10, 10, 0]);
      m.addLine(ROOT, [10, 10, 0], [0, 0, 0]);
    });
    expect(m.checkModel()).toEqual([]);
  });

  it("reports the bad fixture's problems with their kinds and ids", () => {
    newModel();
    const m = Model.fromJson(fixture("bad.builder"));
    const findings = m.checkModel();
    expect(findings.map((f) => f.kind)).toEqual(["faceless_edge", "faceless_edge", "overlapping_edges", "duplicate_vertices"]);
    const dup = findings[3];
    expect(dup.owner).toBe(ROOT);
    expect(dup.vertices.length).toBe(2);
    expect(dup.position).toEqual([10, 10, 0]);
    expect(describeFinding(dup)).toBe(`duplicate vertices in definition 0 at (10, 10, 0): vertices ${dup.vertices.join(", ")}`);
    expect(Model.fromJson(fixture("clean.builder")).checkModel()).toEqual([]);
  });
});
