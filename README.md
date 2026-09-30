# FSM Designer

A local, browser-based Finite State Machine Designer for Automata Theory / Formal Languages.

## Run

No backend or database is required.

1. Extract the `fsm-designer` folder.
2. Open `index.html` in a modern browser.
3. Start with the included example DFA or create a new machine.

For best results, use a current Chrome, Edge, or Firefox version. If your browser blocks ES modules when opening `file://` directly, serve the folder with any simple local static server.

Example with Python:

```bash
cd fsm-designer
python -m http.server 5500
```

Then open `http://localhost:5500`.

## Included

- DFA, NFA, ε-NFA, Mealy and Moore modes
- Custom state names
- Custom input/output alphabets
- SVG state-machine canvas
- State dragging, selection, self-loops and curved parallel transitions
- Simulation and step trace
- ε-closure display
- Mealy/Moore output sequences
- Machine-specific validation
- PNG canvas export from the Save PNG button
- LocalStorage persistence
- Light/dark mode
- Undo/redo
- NFA/ε-NFA/Mealy/Moore conversions
- Responsive layout
- Keyboard shortcuts

## Shortcuts

- `S` — Add States (bulk state generator)
- `T` — Add Transition
- `Delete` — Delete selected
- `Ctrl+S` — Export the current FSM canvas as PNG
- `Ctrl+Z` — Undo
- `Ctrl+Y` — Redo

## Notes

The implementation intentionally keeps machine data separate from rendering, simulation, validation, storage and conversion logic. State names and alphabet symbols are not hard-coded to `q0/q1/q2` or `0/1`.


## Workspace behavior

Each machine type has its own workspace. Switching between DFA, NFA, ε-NFA, Mealy and Moore no longer destroys the machine you were editing in the previous type.

## Canvas controls

- Drag a state to move it.
- Drag an empty part of the canvas to pan the workspace.
- Middle-mouse drag or Space + drag also pans.
- Mouse wheel zooms around the cursor.
- Save PNG exports the current canvas view as a PNG image. Editable machine data is retained automatically in the browser via LocalStorage.

## Formal definitions

The interface shows the standard tuple notation for the active machine: 5-tuples for DFA/NFA/ε-NFA and 6-tuples for Mealy/Moore, with Q, Σ, Γ, δ, λ, q₀ and F labeled using their corresponding names.

## Transition views

Selecting a transition shows a readable definition such as Current State, Input Symbol and Next State. NFA displays Next States, ε-NFA displays ε transitions, and Mealy displays the Output. The Transition Table tab also provides a state-by-input matrix.
