# Photoshop PSD Layer Engine

TOAD features a native binary Photoshop PSD encoder that exports layouts as rich, non-destructive, fully editable `.psd` documents compatible with Adobe Photoshop CC, Affinity Photo, and Photopea.

---

## 1. The Anatomy of a Photoshop PSD File

A standard `.psd` file is organized into five mandatory binary sections:

```
┌────────────────────────────────────────────────────────┐
│ 1. File Header (26 bytes)                              │
│    - Signature '8BPS', Version 1, Channels, W, H, Depth│
├────────────────────────────────────────────────────────┤
│ 2. Color Mode Data Section                             │
│    - Indexed color table (empty for RGB/CMYK)          │
├────────────────────────────────────────────────────────┤
│ 3. Image Resources Section                             │
│    - Resolution info (72/300 DPI), Slices, Grid guides │
├────────────────────────────────────────────────────────┤
│ 4. Layer and Mask Information Section                  │
│    - Layer count, layer records, extra data blocks     │
│    - Vector masks, TypeTool EngineData, Layer effects  │
├────────────────────────────────────────────────────────┤
│ 5. Composite Image Data Section                        │
│    - Flattened RLE-compressed raster for quick preview │
└────────────────────────────────────────────────────────┘
```

---

## 2. Layer Representation & Translation

Unlike naive PSD exporters that rasterize every element into flattened bitmaps, TOAD maps each DSL node into its native Photoshop counterpart:

| TOAD DSL Primitive | Photoshop Layer Type | Additional Layer Information (Tagged Blocks) |
|:---|:---|:---|
| `text` | Native Type Layer (`TySh`) | `TySh` (Type Tool Object), `Txt2` (EngineData), `luni` |
| `rect`, `circle`, `path` | Vector Shape Layer | `vmsk` (Vector Mask), `vsms` (Vector Stroke), `SoCo`/`GdFl` |
| `image` | Raster / Smart Object Layer | Bitonal/RGBA Channel image data, optional clipping mask |
| `stack`, `group` | Layer Group (Folder) | `lsct` (Section Divider: Open/Close folder), `luni` |

---

## 3. Native Editable Text Layers (`TySh`)

TOAD writes fully editable text layers that can be double-clicked and edited directly in Photoshop.

### The `EngineData` Stream
Photoshop stores typography styling in a serialized dictionary format known as `EngineData`. TOAD constructs these data structures with:
- **Font Set**: Registered PostScript font name (e.g. `Inter-Bold`, `HelveticaNeue-Medium`).
- **Run Array**: Character formatting runs specifying `FontSize`, `FillColor` (as RGB components in $[0.0, 1.0]$), and `Tracking`.
- **Paragraph Array**: Paragraph formatting specifying `Justification` (`Left`, `Center`, `Right`, `Justify`), `FirstLineIndent`, and `Leading`.
- **Text Rect**: The bounding box within which Photoshop wraps the text.

```
/EngineDict <<
  /Editor <<
    /Text (Hello World)
  >>
  /StyleRun <<
    /RunArray [
      <<
        /StyleSheet <<
          /StyleSheetData <<
            /FontSize 32.0
            /FillColor << /Values [ 1.0 0.2 0.4 1.0 ] >>
          >>
        >>
      >>
    ]
  >>
>>
```

---

## 4. Vector Shape Layers (`vmsk` & `SoCo`)

Shapes defined in TOAD maintain infinite scalability in Photoshop through native vector paths:

1. **Path Record Construction**:
   - Closed subpath length records.
   - Initial knot records containing cubic Bézier control points (`Preceding`, `Anchor`, `Leaving`).
   - Standard rectangles and rounded rectangles are converted into exact 4-segment or 8-segment cubic Bézier splines.
2. **Solid Color Fill (`SoCo`)**:
   - Defines the color fill descriptor (`Rd  `, `Grn `, `Bl  `) independent of pixel resolution.
3. **Gradient Fill (`GdFl`)**:
   - Encodes multi-stop linear and radial gradients with angle, scale, and midpoint data.

---

## 5. Layer Groups and Nesting (`lsct`)

Nested layouts (`stack`, `group`, `card`) are mapped to Photoshop layer groups using paired `lsct` (Layer Section Divider) records:

- **Group Open**: A layer record with `lsct` type 1 or 2 (Open folder or Closed folder) and blend mode `pass-through`.
- **Children**: Subsequent layer records in bottom-to-top rendering order.
- **Group Close**: A bounding marker layer with `lsct` type 3 (`</Layer group>`).

```
[Record] Group "Card Container" (lsct = 1)
  ├── [Record] "Background" (Shape)
  ├── [Record] "Avatar" (Raster)
  └── [Record] "Username" (Type Layer)
[Record] "</Layer group>" (lsct = 3)
```

---

## 6. Layer Effects and Blending (`lrFX`)

Visual effects defined in TOAD map directly to Photoshop layer styles:

- **Drop Shadow**: Mapped to native PSD drop shadow descriptors with distance, angle, size (blur), and opacity.
- **Inner Shadow**: Mapped to inner shadow descriptors.
- **Color Overlay**: Provides non-destructive color tinting.
- **Blend Modes**: TOAD translates CSS blend modes to Photoshop 4-character signatures (`norm`, `mul `, `scrn`, `over`, `lddg`, etc.).

---

## 7. RLE Compression and Preview Composite

Photoshop requires a flattened composite image in Section 5 so operating systems (Windows Explorer thumbnails, macOS QuickLook) can render previews without parsing the entire layer tree:

- TOAD uses headless Skia to render the final canvas composite.
- The composite channels (R, G, B, and Alpha) are compressed using **PackBits RLE (Run-Length Encoding)**.
- Each scanline is compressed individually, with line byte counts written to the channel header.

---

## 8. Export Command

To export a `.psd` file:
```bash
toad compile design.toad -o output.psd
```

The resulting file opens immediately in Photoshop with pristine vector shapes, live text layers, and organized layer folders.
