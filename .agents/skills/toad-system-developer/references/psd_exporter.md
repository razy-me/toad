# PSD Exporter (`psdExporter.ts`)

The PSD Exporter uses `ag-psd` to synthesize native, layered Photoshop documents from the layout AST. It attempts to retain editability wherever possible.

## Synthesis Steps & PSD Structures
1. **Document Setup:** A `Psd` structure is initialized with global width, height, and channels (RGB, 8-bits). A composite background canvas layer is appended.
2. **Layer Translation:** The recursive function `buildPsdLayerInternal` processes each AST node and outputs an `ag-psd` `Layer`.
3. **Text Nodes:** Text is converted to a native, editable Photoshop text layer (`Layer.text`). Properties mapped include fonts, leading, tracking, faux bold/italic, alignment, and fill. Raster text canvases are simultaneously generated as a fallback (`canvas` property).
4. **Raster & Vector Base Layers:** For shapes and images, an isolated raster canvas is generated. Alongside the raster fallback, vector attributes (`vectorMask`, `vectorFill`, `vectorStroke`) are generated to preserve scalable vector paths.
5. **Clipping Masks & Groups:** Photoshop's clipping mask paradigm is strictly respected. When an element acts as a mask, it is designated as a base layer (`clipping: false`), and its target node is configured as the clipped layer (`clipping: true`). They are organized under a Mask Group folder. Sibling masking logic mirrors this setup.
6. **Effects & Adjustments:** 
   - Layer effects (`LayerEffectsInfo`) such as drop shadows and outer glows are translated to native PSD effects.
   - CSS filters (`blur`, `brightness`, `contrast`, `grayscale`, etc.) are translated into dedicated Photoshop **Adjustment Layers** appended as clipping targets to the base layer.
