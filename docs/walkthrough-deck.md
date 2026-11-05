# Walkthrough: the 12' × 10' deck

The Milestone 2 test project as far as the tools go today: a 12' × 10' rim built as a hollow frame with Offset and Push/Pull, a mid-span post laid out with Tape Measure guides and drawn by snapping, four 4 × 4 corner posts by Copy, nine joists at 16" centres by `8x`, a stair stringer pitched to 37° with Rotate, and a railing built flat (Offset for the frame, `/5` for the balusters) and stood up with Rotate. The counts in Results come from the same operations run headlessly against the real kernel (`app/test/offset.test.ts`, "Deck walkthrough"); Patrick repeats the steps in the browser and checks that the flashes and the perf line match. The round posts wait for the curves sprint.

## Prerequisites

- The hosted build at https://pjsulin.github.io/builder/ (every push to `main` deploys there), or `make start` from a checkout and the URL it prints.
- Units left at feet and inches. Typed values go into the Measurements box at the bottom right: type, then Enter.
- "Move with Ctrl" below means: press M, tap Ctrl (Option on a Mac) so the cursor reads *copy*, then click. Holding Ctrl while you click does the same; the mode ends with the operation.
- The perf line at the bottom right reads `<draw time> ms draw · <N> faces`; it counts every face in the model, groups included.
- A **box selection** is Select (Space) dragged from left to right around the part: only entities fully inside the box are taken, so a post under the frame can be boxed without the frame.

## Steps

Each step names the tool (its key), what to click, the value typed into the Measurements box, and the expected result.

1. **New.** Click `New` and confirm discarding the sample.
2. **Rectangle (R), the rim.** Click the origin, move toward +red/+green, type `12', 10'`. `1 faces`.
3. **Push/Pull (P).** Click the rectangle, move up, type `9 1/4"`. A 2 × 10 slab: `6 faces`.
4. **Offset (F), the rim's inside.** Click the top face near its front edge, move toward the middle of the face, type `1 1/2"`. The top splits into a 1 1/2" ring and an inner face: `7 faces`.
5. **Push/Pull (P), hollow it out.** Click the inner face, move down, type `9 1/4"`. The face pushes through the slab and leaves a hollow rim of 1 1/2" joists: `10 faces`.
6. **Make group, the frame.** Ctrl+A, G. Flash `Grouped`.
7. **Tape Measure (T), lay out a mid-span post.** With the frame still on the ground, hover the middle of the rim's front bottom edge until `Midpoint` shows and click; move into the deck (the cursor stays on the ground, `From Point` along green) and type `4'`: a dashed guide line runs across the deck 4' in from the front. Click the middle of the left bottom edge, move into the deck, type `4'`: a second guide 4' in from the left. Hover where they cross: `Intersection`.
8. **Move (M), raise the frame.** Select the frame (click it), click one of its corners, press the Up arrow (blue lock), move up, type `3'`. The guides stay on the ground: they belong to the model, not the group.
9. **Rectangle (R) and Push/Pull (P), the mid-span post.** Hover the guides' crossing until `Intersection` shows, click, type `3 1/2", 3 1/2"`: a 4 × 4 footprint whose corner is exactly 4' from both edges, nothing typed for its position. Push/Pull it up, type `3'`. `16 faces`. Box-select the post, G: 2 groups.
10. **Rectangle (R) and Push/Pull (P), a corner post.** Click the origin, type `3 1/2", 3 1/2"`; Push/Pull it up, type `3'`. `22 faces`. Box-select the post (the frame above is not fully inside the box), press G: 3 groups.
11. **Move (M) with Ctrl, the other corner posts.** Click the post's corner at the origin, press the Right arrow (red lock), type `11' 8 1/2"`; the cursor reads *copy* and the copy sits under the far corner. Select (Space), Shift-click the first corner post so both are selected; Move with Ctrl, Left arrow (green lock), type `9' 8 1/2"`. Four posts under the corners and one mid-span: `40 faces`, 6 groups.
12. **Joists.** Rectangle (R): hover the rim's inner top corner nearest the origin until `Endpoint` shows, click, type `1 1/2", 9' 9"` (a 2 × 10 spanning the frame); Push/Pull it down `9 1/4"`; box-select it, G. Move with Ctrl, Right arrow, type `16"`, then type `8x`: nine joists at 16" centres, the last bay narrower. `94 faces`, 15 groups.
13. **Stair stringer.** Rectangle (R) on the ground in front of the deck, starting about 3' along red and 6' out from the front edge, type `11 1/4", 6'` so the far end meets the deck's front edge; Push/Pull `1 1/2"`; box-select, G. Rotate (Q): press the Right arrow (the protractor locks to red), click the stringer's bottom corner at its outer end, click a point along the stringer toward the deck for the start direction, type `37`. The deck end rises about 3' 7". `100 faces`, 16 groups.
14. **Railing**, built flat on the ground to the left of the deck, then stood up:
    1. Rectangle (R): start about 5' to the left of the origin along red, type `3', 10'`. `101 faces`.
    2. Offset (F): click the rectangle near its left edge, move inward, type `1 1/2"`. A ring and a panel: `102 faces`.
    3. Select (Space) the panel with one click, press Delete. `101 faces`.
    4. Push/Pull (P) the ring up, type `1 1/2"`. A 1 1/2"-thick rail frame: `110 faces`.
    5. Rectangle (R), a baluster, on empty ground further left: type `2' 8", 1 1/2"`; Push/Pull `1 1/2"`; box-select, G. `116 faces`, 17 groups.
    6. Move (M) it into the frame: click the baluster's corner nearest the deck's end of the frame, then click the frame opening's matching inner corner (`Endpoint`). Move again with the Right arrow, type `1/2"`, and once more with the Left arrow, type `3"`: the baluster sits 1/2" clear of the rails and 3" from the end post.
    7. Move with Ctrl, Left arrow, type `9' 1 1/2"`, then type `/5`: six balusters evenly spaced. `146 faces`, 22 groups.
    8. Box-select the whole railing (frame and balusters). Rotate (Q): press the Left arrow (green lock), click the frame's bottom corner on the deck side, click its far bottom corner for the start direction, type `90` (or `-90` if it swings down). The railing stands 3' tall; the frame's opening stays open: still `146 faces`.
    9. Move (M) with the railing still selected: Up arrow, type `3' 9 1/4"`; then Right arrow, type `2'`. It stands on the left rim of the deck.
15. **Check model.** Flash `Model check: clean`. The two guides are still there; **Delete guides** removes them, or **Hide guides** keeps them for later and saves that with the model.
16. **Save.** Ctrl+S. The file carries the posts' guides under `guides`, and `guides_visible: false` if you hid them.

## Results

From the kernel run of steps 2–14 (the browser steps apply the same operations):

| After step | Faces | Groups | Check model |
| --- | --- | --- | --- |
| 5 hollow rim | 10 | 0 | clean |
| 7 two guides | 10 | 1 | clean |
| 9 mid-span post at the intersection | 16 | 2 | clean |
| 11 five posts | 40 | 6 | clean |
| 12 nine joists | 94 | 15 | clean |
| 13 stringer at 37° | 100 | 16 | clean |
| 14.4 rail frame | 110 | 16 | clean |
| 14.7 six balusters | 146 | 22 | clean |
| 14.9 railing on the rim | 146 | 22 | clean |

- The mid-span post's footprint corner is at exactly (4', 4', 0): the Rectangle started on the guides' `Intersection` snap, with no position typed.

- The model's top is at 6' 9 1/4" (the rim top at 3' 9 1/4" plus the 3' railing); the stringer's deck end is at 3' 7 5/16" (72" × sin 37°).
- The railing's opening survives the rotation: a committed move or rotation of a ring keeps its hole (`kernel/tests/move.rs`).

## Known gaps

- Round posts (circles) wait for the curves sprint; the posts here are 4 × 4s.
- The stringer is pitched, not cut: no treads or risers, and its deck end meets the rim only roughly.
- A baluster drawn directly inside the frame's opening snaps to the opening's corner and welds to the frame; it is built on empty ground and moved in instead, which is also what keeps it a separate group.
- Nine joists at 16" centres from one copy and `8x` leave a narrower last bay, as a real 12' frame does; `/8` would spread them evenly instead.
- The walkthrough was executed through the kernel in this sprint; the browser run (flashes, snaps, the protractor, the guides' dashed layer) is Patrick's check, recorded in the sprint's close.
