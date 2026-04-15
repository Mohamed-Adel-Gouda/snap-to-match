

# Drag-and-Drop Images from Gallery

## Problem
Currently the only way to get all images out is via ZIP download. The user wants to drag images directly into chat apps or file explorers.

## Options Considered

1. **Clipboard Copy** — Use the Clipboard API to copy image(s) to clipboard for pasting. Limited: only supports one image at a time in most browsers, and only PNG format.

2. **Native HTML5 Drag** — Make each image in the gallery individually draggable so you can drag it into WhatsApp Web, Telegram, file explorer, etc. This works natively in browsers. However, dragging *multiple* images at once from a webpage is not reliably supported by browsers.

3. **"Open all in new tabs"** — Open each image in its own browser tab, then the user can drag from tabs or save individually. Clunky but works.

4. **Generate a temporary folder link** — Not feasible without a backend file-serving layer.

## Recommended Approach

**Option 2: Native draggable images** — the most natural UX. Each image in the gallery gets `draggable="true"` with a proper `dragstart` handler that sets the image URL as drag data. Users can drag any image directly into a chat app or desktop. Combined with a "Copy image" button on each image for clipboard pasting.

### Implementation

**File: `src/pages/PersonProfile.tsx`**

In the gallery dialog, for each screenshot card:
- Add `draggable="true"` to each `<img>` element
- Add an `onDragStart` handler that sets `dataTransfer` with the image URL and filename
- Add a small "Copy" icon button overlay on each image that copies it to clipboard via `fetch` + `navigator.clipboard.write`
- Add a brief tooltip/instruction at the top of the gallery: *"Drag any image to a chat or click the copy icon"*

### Limitations (noted in UI)
- Dragging multiple images at once is a browser limitation — users drag one at a time
- Clipboard copy works best with PNG; some browsers may not support it for JPEG

### Single file change
| Action | File |
|--------|------|
| Edit | `src/pages/PersonProfile.tsx` — add drag handlers and copy buttons to gallery images |

