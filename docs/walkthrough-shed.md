# Walkthrough: the 10' × 8' shed

The Milestone 1 test project, done start to finish in the browser: a 10' × 8' box with 8' walls, a gable roof lifted with Move and grouped, the roof lowered through the walls and intersected with them, a door and a window cut in, the model check clean, then the tab closed and the work recovered. The counts in Results come from the same operations run through the kernel headlessly (`app/test/` drives the real WebAssembly kernel the same way); Patrick repeats the steps in the browser and checks that the flashes and the perf line match.

## Prerequisites

- The hosted build at https://pjsulin.github.io/builder/ (every push to `main` deploys there), or `make start` from a checkout and the URL it prints.
- Units left at feet and inches (the `Feet & inches` button in the header). Typed values go into the Measurements box at the bottom right: type, then Enter.
- The perf line at the bottom right reads `<draw time> ms draw · <N> faces`; it counts every face in the model, groups included.

## Steps

Each step names the tool (its key), what to click, the value typed into the Measurements box, and the expected result.

1. **New.** Click `New` and confirm discarding the sample. The header reads `model.builder`; the viewport is empty but for the axes.
2. **Rectangle (R), floor.** Click the origin where the axes cross, move the cursor toward +red/+green, type `10', 8'`. One face on the ground; the perf line reads `1 faces`.
3. **Push/Pull (P), walls.** Click the rectangle, move the cursor up, type `8'`. A closed box: `6 faces`.
4. **Line (L), ridge.** Hover the top edge of the left gable wall (the 8' wall at the red axis' origin end) until the `Midpoint` snap shows, click; hover the top edge of the right gable wall until `Midpoint` shows, click; Esc. The top splits into two halves: `7 faces`.
5. **Move (M), lift the ridge.** Select (Space), click the ridge line. Move (M), click a point on the ridge, press the Up arrow to lock the blue axis, move the cursor up, type `3'`. The two top halves tilt into roof planes and the gable walls become pentagons; still `7 faces`, nothing bends (each half keeps two vertices in place and lifts two).
6. **Make group, the roof.** Select, click one roof plane, Shift-click the other, press G. Flash `Grouped`; the group outline shows around the roof; `7 faces` (five loose, two in the group).
7. **Move (M), lower the roof through the walls.** With the group selected, Move, click a corner of the roof, press the Up arrow (blue lock), move the cursor down, type `1'`. The roof planes now pass through all four walls: the eaves sit 7' up the long walls and the ridge at 10' inside the gable walls.
8. **Intersect with model.** Ctrl+A (select all), click `Intersect with model`. Flash `Intersect: 6 edges drawn`: a horizontal line 7' up each long wall and two roof lines meeting at 10' on each gable wall. The walls are split along them: `11 faces`. The roof group is unchanged (its faces are read, not cut).
9. **Erase the wall parts above the roof.** Select, single-click the strip above the roof line on one long wall, press Delete; repeat for the other long wall and the two gable tops (the pentagon above the roof lines). `7 faces`. Single-click only: a double-click selects the face with its edges, and deleting those takes the wall below with them.
10. **Check model, before cleaning up.** Click `Check model`. The dialog lists 10 `faceless edge` findings: the old wall tops at 8', the four gable slopes, and the four short verticals between 7' and 8'. They bound nothing now. Close the dialog.
11. **Eraser (E), the leftover edges.** Click each of those 10 edges (they are the ones not touching any face; the roof lines and the walls' own edges stay). Click `Check model`: flash `Model check: clean`.
12. **Rectangle (R), door.** On the front wall (the long wall nearest the default camera), hover its bottom edge about 3' 6" from the left corner until `On Edge` shows, click, move up and right along the wall, type `3', 6' 8"`. The door outline splits the wall: `8 faces`.
13. **Push/Pull (P), door reveal.** Click the door face, move the cursor into the shed, type `4"`. A 4" pocket: `11 faces`. Select, single-click the back of the pocket, Delete: an opening with 4" jambs, `10 faces`.
14. **Window.** Orbit (O, or right-drag) to the back wall. Rectangle: hover the wall until `On Face` shows about 2' 6" from the left corner and 3' 4" up, click, type `3', 2'`. Push/Pull the window face in, type `4"`; select its back, Delete. `14 faces`. `Check model`: `Model check: clean`.
15. **Save.** Ctrl+S. The browser downloads `model.builder`; the header's `unsaved` marker clears.
16. **Close the tab and recover.** Make one more change so there is something to recover: Line (L), draw a short line on the floor, Esc. Wait 3 seconds (autosave debounces commits by 3 s), then close the tab, or kill the browser. Open https://pjsulin.github.io/builder/ again: the prompt `Restore model.builder autosaved <time> after Line?` appears. OK: flash `Restored model.builder as of <time>`, the shed is back with the extra line, the header shows `unsaved`. `Versions` lists the autosaved versions, newest first.

## Results

From the kernel run of steps 2–14 (the browser steps apply the same operations):

| After step | Faces | Edges | Groups | Check model |
| --- | --- | --- | --- | --- |
| 3 box | 6 | 12 | 0 | clean |
| 5 ridge lifted | 7 | 15 | 0 | clean |
| 8 intersected | 11 | 31 | 1 | clean |
| 9 wall tops erased | 7 | 31 | 1 | 10 faceless edges |
| 11 leftover edges erased | 7 | 21 | 1 | clean |
| 14 door and window | 14 | 45 | 1 | clean |

- Saved file: `model.builder`, 14 faces, 1 group. Opening it again (`Open`) gives the same counts; `cargo run -p builder-kernel --example validate -- model.builder` prints `2 definitions, 1 instances, 0 tags: ok`.
- After step 16 the restored model has the shed plus the extra line, and `Check model` reports that line as one `faceless edge`.

## Known gaps

- Intersect writes into the open context only. The roof group's own faces are not cut by the walls; to cut them, double-click the group and run `Intersect with model` inside it (the walls are then read as the model around it).
- The walls have no thickness, so the door and window are reveals cut into a single face, not openings through a solid; the Push/Pull step then erases the back face by hand.
- Erasing a face keeps its edges, as in SketchUp when only the face is selected; step 11 erases them one by one. A face selected with its edges (double-click) erases neighbouring faces along those edges too.
- The walkthrough was executed through the kernel in this sprint; the browser run (flashes, snaps, the restore prompt) is Patrick's check, recorded in the sprint's close.
