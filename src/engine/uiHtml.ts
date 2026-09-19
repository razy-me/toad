/**
 * src/engine/uiHtml.ts
 *
 * Standalone Zero-Dependency Single Page Application for TOAD Studio.
 * Clean, disciplined architectural parameter control deck conforming to Anti-AI-Slop heuristics.
 * Modernized with FontAwesome 6 icon system and decluttered, collapsible expert controls.
 *
 * 5 Dedicated Workspaces:
 * 1. Grafik & Build (toad build) - Visual parameter control deck & Live Preview
 * 2. Animation (toad motion) - Frame & motion render controls with HTML5 player
 * 3. Freistellen (toad remove-bg) - AI background remover with presets & split-slider
 * 4. Konvertieren (toad convert) - Universal Image & PSD converter with decluttered drawers
 * 5. Qualitäts-Audit (toad report) - Design audit dashboard with 1-click fixes
 */

export function generateStudioHtml(initialFile?: string): string {
  const defaultFile = initialFile || '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TOAD Studio</title>
  
  <!-- FontAwesome 6 Free Vector Icons -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer" />

  <style>
    :root {
      --bg: #090D16;
      --bg-surface: #0F172A;
      --bg-card: #141F36;
      --bg-card-hover: #192744;
      --bg-hover: #1E293B;
      --border: #1E293B;
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-focus: #38BDF8;
      --accent: #10B981;
      --accent-hover: #059669;
      --accent-dim: rgba(16, 185, 129, 0.15);
      --accent-glow: rgba(16, 185, 129, 0.25);
      --cyan: #06B6D4;
      --cyan-dim: rgba(6, 182, 212, 0.15);
      --violet: #8B5CF6;
      --violet-dim: rgba(139, 92, 246, 0.15);
      --amber: #F59E0B;
      --amber-dim: rgba(245, 158, 11, 0.15);
      --rose: #F43F5E;
      --rose-dim: rgba(244, 63, 94, 0.15);
      --text: #F8FAFC;
      --text-muted: #94A3B8;
      --text-dim: #64748B;
      --success: #10B981;
      --warning: #F59E0B;
      --error: #F43F5E;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      --font-mono: ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --radius: 8px;
      --radius-sm: 5px;
      --radius-lg: 12px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-sans);
      background-color: var(--bg);
      color: var(--text);
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
    }

    /* Scrollbars */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #1E293B; border-radius: var(--radius-sm); }
    ::-webkit-scrollbar-thumb:hover { background: #334155; }

    /* Top Navigation Header */
    header {
      height: 54px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      user-select: none;
      z-index: 100;
      flex-shrink: 0;
      box-shadow: 0 1px 12px rgba(0, 0, 0, 0.35);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 15px;
      color: var(--text);
      letter-spacing: -0.02em;
    }

    .brand-icon {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      background: var(--accent-dim);
      border: 1px solid rgba(16, 185, 129, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent);
      font-size: 15px;
    }

    .brand-badge {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-dim);
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
    }

    nav {
      display: flex;
      gap: 5px;
      background: var(--bg);
      padding: 3px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
    }

    .nav-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 7px 14px;
      font-size: 12px;
      font-weight: 600;
      border-radius: var(--radius-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s ease;
    }

    .nav-btn i {
      font-size: 13px;
      color: var(--text-dim);
      transition: color 0.15s ease;
    }

    .nav-btn:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.04);
    }

    .nav-btn:hover i {
      color: var(--text-muted);
    }

    .nav-btn.active {
      background: var(--bg-card);
      color: var(--text);
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
      border: 1px solid var(--border-subtle);
    }

    .nav-btn.active i {
      color: var(--accent);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-header {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 12px;
      font-weight: 500;
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 7px;
      transition: all 0.15s;
    }

    .btn-header i {
      font-size: 12px;
      color: var(--text-muted);
    }

    .btn-header:hover {
      background: var(--bg-hover);
      border-color: #334155;
    }

    .btn-header:hover i {
      color: var(--text);
    }

    .btn-header.active {
      background: var(--accent-dim);
      border-color: rgba(16, 185, 129, 0.35);
      color: var(--accent);
    }

    .btn-header.active i {
      color: var(--accent);
    }

    .btn-header-danger {
      color: var(--rose);
      border-color: rgba(244, 63, 94, 0.3);
      background: rgba(244, 63, 94, 0.08);
    }

    .btn-header-danger i {
      color: var(--rose);
    }

    .btn-header-danger:hover {
      background: rgba(244, 63, 94, 0.18);
      border-color: var(--rose);
    }

    /* Main Container Layout */
    .app-body {
      display: flex;
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    /* Left Sidebar: Collapsible Directory & Subdirectory File Tree */
    aside.sidebar {
      width: 270px;
      background: var(--bg-surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow: hidden;
      transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    aside.sidebar.collapsed {
      width: 0 !important;
      border-right: none !important;
    }

    .sidebar-header {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .sidebar-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-dim);
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .sidebar-search {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      position: relative;
    }

    .sidebar-search i {
      position: absolute;
      left: 22px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 12px;
      color: var(--text-dim);
      pointer-events: none;
    }

    .sidebar-search input {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 6px 10px 6px 30px;
      font-size: 12px;
      color: var(--text);
      outline: none;
      font-family: var(--font-sans);
      transition: border-color 0.15s ease;
    }

    .sidebar-search input:focus {
      border-color: var(--accent);
    }

    .sidebar-tree {
      flex: 1;
      overflow-y: auto;
      padding: 6px 0;
    }

    /* Tree Folder & File Nodes */
    .tree-folder {
      margin-bottom: 2px;
    }

    .folder-header {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 6px 12px;
      cursor: pointer;
      user-select: none;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      transition: background 0.1s;
    }

    .folder-header:hover {
      background: rgba(255, 255, 255, 0.03);
      color: var(--text);
    }

    .folder-chevron {
      font-size: 10px;
      transition: transform 0.15s ease;
      color: var(--text-dim);
      width: 12px;
      text-align: center;
    }

    .folder-header.collapsed .folder-chevron {
      transform: rotate(-90deg);
    }

    .folder-icon {
      font-size: 12px;
      color: var(--amber);
    }

    .folder-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .folder-badge {
      font-family: var(--font-mono);
      font-size: 10px;
      background: var(--bg);
      padding: 1px 6px;
      border-radius: 3px;
      color: var(--text-dim);
      border: 1px solid var(--border);
    }

    .folder-children {
      padding-left: 12px;
    }

    .folder-header.collapsed + .folder-children {
      display: none;
    }

    .tree-file {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 12px 5px 22px;
      cursor: pointer;
      font-size: 12px;
      color: var(--text-muted);
      transition: all 0.1s;
      user-select: none;
    }

    .tree-file:hover {
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
    }

    .tree-file.active {
      background: var(--bg-card);
      color: var(--text);
      font-weight: 600;
      border-left: 3px solid var(--accent);
      padding-left: 19px;
    }

    .file-badge {
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: 700;
      padding: 2px 5px;
      border-radius: 3px;
      letter-spacing: 0.02em;
    }

    .file-badge.toad {
      background: var(--cyan-dim);
      color: var(--cyan);
      border: 1px solid rgba(6, 182, 212, 0.25);
    }

    .file-badge.toadm {
      background: var(--violet-dim);
      color: var(--violet);
      border: 1px solid rgba(139, 92, 246, 0.25);
    }

    .file-title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Workspace Content Panels */
    main.content {
      flex: 1;
      overflow-y: auto;
      background: var(--bg);
      display: flex;
      flex-direction: column;
    }

    .tab-view {
      display: none;
      flex: 1;
      height: 100%;
    }

    .tab-view.active {
      display: flex;
      flex-direction: column;
    }

    /* Graphic / Build Deck Layout */
    .deck-container {
      display: flex;
      flex: 1;
      height: 100%;
      overflow: hidden;
    }

    .deck-controls {
      width: 380px;
      background: var(--bg-surface);
      border-right: 1px solid var(--border);
      overflow-y: auto;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex-shrink: 0;
    }

    .deck-preview {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #060910;
      overflow: hidden;
    }

    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-dim);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .section-title i {
      margin-right: 6px;
      color: var(--text-dim);
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      transition: border-color 0.15s ease;
    }

    .card:hover {
      border-color: #2D3E5D;
    }

    .param-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 14px;
    }

    .param-group:last-child {
      margin-bottom: 0;
    }

    .param-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .param-sub {
      font-size: 11px;
      color: var(--text-dim);
      font-weight: normal;
    }

    /* Format Chips Grid */
    .format-chips-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .format-chip {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      background: var(--bg);
      border: 1px solid var(--border);
      padding: 9px 8px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
      font-family: var(--font-mono);
      color: var(--text-muted);
      user-select: none;
      transition: all 0.15s ease;
    }

    .format-chip i {
      font-size: 12px;
      color: var(--text-dim);
    }

    .format-chip:hover {
      border-color: #334155;
      color: var(--text);
    }

    .format-chip input[type="checkbox"] {
      display: none;
    }

    .format-chip.active {
      background: var(--accent-dim);
      color: var(--accent);
      border-color: rgba(16, 185, 129, 0.35);
      box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.2);
    }

    .format-chip.active i {
      color: var(--accent);
    }

    /* Checkbox & Radio Controls */
    .check-btn {
      display: flex;
      align-items: center;
      gap: 9px;
      background: var(--bg);
      border: 1px solid var(--border);
      padding: 9px 12px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      user-select: none;
      transition: all 0.15s;
    }

    .check-btn:hover {
      border-color: #334155;
      background: rgba(255, 255, 255, 0.02);
    }

    .check-btn input[type="checkbox"],
    .check-btn input[type="radio"] {
      accent-color: var(--accent);
      cursor: pointer;
    }

    /* Segmented Control Buttons */
    .segment-group {
      display: flex;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 3px;
      gap: 4px;
    }

    .segment-btn {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 600;
      padding: 6px 8px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s;
      text-align: center;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .segment-btn i {
      font-size: 11px;
    }

    .segment-btn:hover {
      color: var(--text);
    }

    .segment-btn.active {
      background: var(--bg-surface);
      color: var(--text);
      box-shadow: 0 1px 2px rgba(0,0,0,0.3);
      border: 1px solid var(--border-subtle);
    }

    /* Inputs and Selects */
    .input-control {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 8px 12px;
      font-size: 13px;
      color: var(--text);
      outline: none;
      font-family: var(--font-sans);
      transition: border-color 0.15s ease;
    }

    .input-control:focus {
      border-color: var(--accent);
    }

    .select-control {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 8px 12px;
      font-size: 13px;
      color: var(--text);
      outline: none;
      cursor: pointer;
      transition: border-color 0.15s ease;
    }

    .select-control:focus {
      border-color: var(--accent);
    }

    .slider-control {
      width: 100%;
      accent-color: var(--accent);
      cursor: pointer;
    }

    /* Action Buttons */
    .btn-primary {
      width: 100%;
      background: var(--accent);
      color: #042F2E;
      border: none;
      padding: 12px;
      border-radius: var(--radius);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      transition: all 0.15s ease;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
    }

    .btn-primary i {
      font-size: 14px;
    }

    .btn-primary:hover:not(:disabled) {
      background: #34D399;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
      transform: translateY(-1px);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
      transform: none;
    }

    .btn-secondary {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 7px 12px;
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }

    .btn-secondary i {
      font-size: 12px;
      color: var(--text-muted);
    }

    .btn-secondary:hover {
      background: var(--bg-hover);
      border-color: #334155;
    }

    .btn-secondary:hover i {
      color: var(--text);
    }

    /* CLI Preview Code Box */
    .cli-preview-box {
      background: #05080E;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 10px 12px;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--cyan);
      word-break: break-all;
      line-height: 1.4;
      user-select: text;
    }

    /* Preview Canvas Area */
    .preview-toolbar {
      height: 46px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
    }

    .preview-canvas-wrap {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: auto;
      padding: 24px;
      position: relative;
    }

    .preview-canvas-wrap img {
      max-width: 100%;
      max-height: 100%;
      box-shadow: 0 10px 30px rgba(0,0,0,0.6);
      border-radius: 3px;
      transition: transform 0.1s ease;
      object-fit: contain;
    }

    /* Dropzone */
    .dropzone {
      border: 2px dashed #334155;
      border-radius: var(--radius);
      padding: 28px 20px;
      text-align: center;
      background: var(--bg);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .dropzone i.dropzone-icon {
      font-size: 36px;
      color: var(--accent);
      margin-bottom: 4px;
      transition: transform 0.2s ease;
    }

    .dropzone:hover, .dropzone.dragover {
      border-color: var(--accent);
      background: var(--accent-dim);
    }

    .dropzone:hover i.dropzone-icon {
      transform: translateY(-2px);
    }

    /* Advanced Drawers / Collapsible Accordions (De-cluttering core!) */
    details.advanced-drawer {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--bg);
      overflow: hidden;
      transition: all 0.2s ease;
    }

    details.advanced-drawer summary {
      padding: 11px 14px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      list-style: none;
      background: rgba(255, 255, 255, 0.02);
      transition: background 0.15s;
    }

    details.advanced-drawer summary::-webkit-details-marker {
      display: none;
    }

    details.advanced-drawer summary:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.05);
    }

    .drawer-summary-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .drawer-summary-left i {
      font-size: 13px;
      color: var(--cyan);
    }

    .drawer-summary-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .drawer-badge {
      font-size: 10px;
      font-family: var(--font-mono);
      color: var(--text-dim);
      background: rgba(255, 255, 255, 0.04);
      padding: 2px 7px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
    }

    .drawer-chevron {
      font-size: 11px;
      transition: transform 0.2s ease;
      color: var(--text-dim);
    }

    details.advanced-drawer[open] .drawer-chevron {
      transform: rotate(180deg);
    }

    details.advanced-drawer .drawer-content {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      border-top: 1px solid var(--border);
      background: var(--bg-card);
    }

    /* Convert Workspace Design */
    .convert-mode-nav {
      display: flex;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 4px;
      gap: 6px;
    }

    .convert-mode-btn {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 600;
      padding: 10px 16px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      transition: all 0.15s ease;
    }

    .convert-mode-btn i {
      font-size: 14px;
    }

    .convert-mode-btn:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.04);
    }

    .convert-mode-btn.active {
      background: var(--bg-card);
      color: var(--text);
      border: 1px solid var(--border);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    }

    .convert-mode-btn.active i {
      color: var(--accent);
    }

    /* Primary Formats Grid (Top 4 Clean Selection) */
    .format-primary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }

    .format-btn {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 12px 10px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 700;
      font-family: var(--font-mono);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
      position: relative;
    }

    .format-btn i {
      font-size: 16px;
      color: var(--text-dim);
      transition: color 0.15s ease;
    }

    .format-btn span.format-title {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.03em;
    }

    .format-btn span.format-desc {
      font-size: 10px;
      font-weight: normal;
      color: var(--text-dim);
      font-family: var(--font-sans);
      text-align: center;
    }

    .format-btn:hover {
      border-color: #334155;
      color: var(--text);
      background: var(--bg-card-hover);
    }

    .format-btn:hover i {
      color: var(--text);
    }

    .format-btn.active {
      background: var(--bg-surface);
      border-color: var(--accent);
      color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent);
    }

    .format-btn.active i {
      color: var(--accent);
    }

    .format-btn.active span.format-desc {
      color: var(--text-muted);
    }

    /* Secondary Formats Pills Bar */
    .format-secondary-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--border);
    }

    .format-secondary-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-dim);
      white-space: nowrap;
    }

    .format-pill-btn {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 5px 12px;
      border-radius: var(--radius-sm);
      font-size: 11px;
      font-weight: 700;
      font-family: var(--font-mono);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }

    .format-pill-btn i {
      font-size: 10px;
      color: var(--text-dim);
    }

    .format-pill-btn:hover {
      border-color: #334155;
      color: var(--text);
    }

    .format-pill-btn.active {
      background: var(--accent-dim);
      color: var(--accent);
      border-color: rgba(16, 185, 129, 0.35);
    }

    .format-pill-btn.active i {
      color: var(--accent);
    }

    .dim-input-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .dim-lock-btn {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 7px;
      transition: all 0.15s;
    }

    .dim-lock-btn.locked {
      background: var(--accent-dim);
      color: var(--accent);
      border-color: rgba(16, 185, 129, 0.3);
    }

    .quick-scale-bar {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .quick-scale-btn {
      flex: 1;
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 6px 10px;
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
    }

    .quick-scale-btn:hover {
      background: var(--bg-hover);
      color: var(--text);
    }

    .preset-pill-bar {
      display: flex;
      gap: 6px;
    }

    .preset-pill-btn {
      flex: 1;
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 6px 8px;
      border-radius: var(--radius-sm);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
    }

    .preset-pill-btn:hover {
      border-color: #334155;
      color: var(--text);
    }

    .preset-pill-btn.active {
      background: var(--accent-dim);
      color: var(--accent);
      border-color: rgba(16, 185, 129, 0.3);
    }

    .result-stat-box {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .result-stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-dim);
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .result-stat-val {
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
      font-family: var(--font-mono);
    }

    .savings-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: var(--radius-sm);
    }

    .savings-badge.positive {
      background: var(--accent-dim);
      color: var(--accent);
      border: 1px solid rgba(16, 185, 129, 0.25);
    }

    .savings-badge.neutral {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      border: 1px solid var(--border);
    }

    /* Active File Compact Header Card */
    .active-file-header-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px 14px;
    }

    .deck-file-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--font-mono);
    }

    .deck-dim-badge {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--accent);
      background: var(--accent-dim);
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      border: 1px solid rgba(16, 185, 129, 0.25);
      flex-shrink: 0;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-dim);
      flex-shrink: 0;
      transition: all 0.2s ease;
    }

    .status-dot.online {
      background: var(--accent);
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
    }

    /* Quick Preset Profiles Bar */
    .quick-preset-bar {
      display: flex;
      gap: 6px;
    }

    .quick-preset-btn {
      flex: 1;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 8px 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      transition: all 0.15s ease;
      color: var(--text-muted);
    }

    .quick-preset-btn i {
      font-size: 14px;
      color: var(--text-dim);
    }

    .quick-preset-btn:hover {
      border-color: #334155;
      color: var(--text);
      background: rgba(255, 255, 255, 0.02);
    }

    .quick-preset-btn.active {
      background: var(--bg-surface);
      border-color: var(--accent);
      color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent);
    }

    .quick-preset-btn.active i {
      color: var(--accent);
    }

    .quick-preset-btn .qp-name {
      font-size: 11px;
      font-weight: 700;
    }

    .quick-preset-btn .qp-sub {
      font-size: 9px;
      color: var(--text-dim);
      font-family: var(--font-mono);
    }

    /* BG-Remover Workspace */
    .bgr-container {
      display: flex;
      flex: 1;
      height: 100%;
      overflow: hidden;
    }

    .bgr-sidebar {
      width: 380px;
      background: var(--bg-surface);
      border-right: 1px solid var(--border);
      padding: 18px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex-shrink: 0;
    }

    .bgr-view {
      flex: 1;
      background: #060910;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px;
      overflow: hidden;
      position: relative;
    }

    .bgr-image-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .bgr-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .bgr-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .bgr-card-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    .progress-bar-wrap {
      width: 100%;
      height: 6px;
      background: var(--bg);
      border-radius: 3px;
      overflow: hidden;
      border: 1px solid var(--border);
    }

    .progress-bar-fill {
      height: 100%;
      background: var(--accent);
      width: 0%;
      transition: width 0.2s ease;
    }

    .progress-status {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-dim);
      font-family: var(--font-mono);
    }

    /* Split-Slider */
    /* Split-Slider */
    .split-container {
      position: relative;
      width: 100%;
      max-width: 800px;
      height: 520px;
      border-radius: var(--radius);
      overflow: hidden;
      background-color: #0d1117;
      border: 1px solid var(--border);
      box-shadow: 0 16px 36px rgba(0,0,0,0.6);
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }

    .split-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .split-layer.bottom {
      background-color: #0d1117;
      z-index: 1;
    }

    .split-layer.top {
      background-color: #121824;
      background-image:
        linear-gradient(45deg, #1e2638 25%, transparent 25%),
        linear-gradient(-45deg, #1e2638 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #1e2638 75%),
        linear-gradient(-45deg, transparent 75%, #1e2638 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
      clip-path: polygon(50% 0, 100% 0, 100% 100%, 50% 100%);
      z-index: 2;
    }

    .split-layer img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      pointer-events: none !important;
      user-select: none !important;
      -webkit-user-drag: none !important;
      -webkit-user-select: none !important;
    }

    .split-handle {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 2px;
      background: #FFFFFF;
      z-index: 10;
      cursor: col-resize;
      touch-action: none;
    }

    .split-knob {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 32px;
      height: 32px;
      background: #FFFFFF;
      color: #090D16;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      cursor: col-resize;
      user-select: none;
    }

    .split-floating-tag {
      position: absolute;
      top: 14px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      border-radius: var(--radius-sm);
      background: rgba(9, 13, 22, 0.85);
      border: 1px solid var(--border);
      color: var(--text);
      z-index: 20;
      pointer-events: none;
      backdrop-filter: blur(4px);
    }
    .split-floating-tag.left { left: 14px; color: var(--text-muted); }
    .split-floating-tag.right { right: 14px; color: var(--accent); border-color: rgba(16, 185, 129, 0.3); }

    /* Report / Audit Hero & Cards */
    .audit-container {
      padding: 30px;
      overflow-y: auto;
      max-width: 1100px;
      margin: 0 auto;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .hero-score-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 30px;
    }

    .hero-score-num {
      font-size: 54px;
      font-weight: 900;
      font-family: var(--font-mono);
      line-height: 1;
    }

    .hero-score-num.high { color: var(--success); }
    .hero-score-num.med { color: var(--warning); }
    .hero-score-num.low { color: var(--error); }

    .dimension-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
    }

    .dim-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .dim-card-title {
      font-size: 11px;
      color: var(--text-dim);
      font-weight: 600;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .dim-card-score {
      font-size: 22px;
      font-weight: 800;
      font-family: var(--font-mono);
    }

    /* Issue List */
    .issues-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .issue-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .issue-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .issue-badge {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 3px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .issue-badge.fatal { background: rgba(244, 63, 94, 0.2); color: var(--error); }
    .issue-badge.warn { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
    .issue-badge.notice { background: rgba(6, 182, 212, 0.2); color: var(--cyan); }

    .issue-help {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
      line-height: 1.5;
    }

    /* Audit Filter Chips */
    .audit-filter-bar {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
    }

    .audit-filter-chip {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }

    .audit-filter-chip:hover {
      border-color: #334155;
      color: var(--text);
    }

    .audit-filter-chip.active {
      background: var(--accent-dim);
      color: var(--accent);
      border-color: rgba(16, 185, 129, 0.3);
    }

    /* Modals */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(3px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-backdrop.active {
      display: flex;
    }

    .modal {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      width: 480px;
      max-width: 90vw;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }

    .modal-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }

    /* Empty States */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      height: 100%;
      padding: 40px 20px;
      color: var(--text-dim);
      gap: 14px;
    }

    .empty-icon {
      font-size: 42px;
      color: var(--text-dim);
      margin-bottom: 4px;
      opacity: 0.8;
    }

    .empty-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
    }

    .empty-desc {
      font-size: 13px;
      color: var(--text-muted);
      max-width: 380px;
      line-height: 1.5;
    }

    /* Full-Height 5-Column Command Builder Hub */
    #tab-hub {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      z-index: 100;
      background: #060a14;
      display: none;
    }

    #tab-hub.active {
      display: flex;
    }

    .hub-fullscreen-columns {
      display: flex;
      flex-direction: row;
      width: 100vw;
      height: 100vh;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #060a14;
    }

    .hub-col {
      flex: 1;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 56px 36px 48px;
      position: relative;
      cursor: pointer;
      overflow: hidden;
      user-select: none;
      border-right: 1px solid rgba(255, 255, 255, 0.07);
      background: #080d1a;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .hub-col:last-child {
      border-right: none;
    }

    .hub-col:hover {
      flex: 1.4;
      z-index: 10;
    }

    .hub-col::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: transparent;
      transition: all 0.3s ease;
    }

    .hub-col.col-bgr:hover {
      background: radial-gradient(circle at 50% 25%, rgba(16, 185, 129, 0.18) 0%, #0a1424 100%);
      box-shadow: 0 0 60px rgba(16, 185, 129, 0.2);
    }
    .hub-col.col-bgr:hover::before { background: var(--accent); }

    .hub-col.col-build:hover {
      background: radial-gradient(circle at 50% 25%, rgba(6, 182, 212, 0.18) 0%, #0a1424 100%);
      box-shadow: 0 0 60px rgba(6, 182, 212, 0.2);
    }
    .hub-col.col-build:hover::before { background: var(--cyan); }

    .hub-col.col-motion:hover {
      background: radial-gradient(circle at 50% 25%, rgba(168, 85, 247, 0.18) 0%, #0a1424 100%);
      box-shadow: 0 0 60px rgba(168, 85, 247, 0.2);
    }
    .hub-col.col-motion:hover::before { background: var(--violet); }

    .hub-col.col-convert:hover {
      background: radial-gradient(circle at 50% 25%, rgba(245, 158, 11, 0.18) 0%, #0a1424 100%);
      box-shadow: 0 0 60px rgba(245, 158, 11, 0.2);
    }
    .hub-col.col-convert:hover::before { background: var(--amber); }

    .hub-col.col-report:hover {
      background: radial-gradient(circle at 50% 25%, rgba(244, 63, 94, 0.18) 0%, #0a1424 100%);
      box-shadow: 0 0 60px rgba(244, 63, 94, 0.2);
    }
    .hub-col.col-report:hover::before { background: var(--rose); }

    .hub-col-top {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .hub-col-idx {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--text-dim);
      font-family: var(--font-mono);
    }

    .hub-col-cmd {
      display: inline-block;
      align-self: flex-start;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: var(--text-dim);
      transition: all 0.2s;
    }

    .hub-col:hover .hub-col-cmd {
      color: var(--text);
      border-color: rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.09);
    }

    .hub-col-body {
      display: flex;
      flex-direction: column;
      margin: auto 0;
      padding: 24px 0;
    }

    .hub-col-icon {
      width: 68px;
      height: 68px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      margin-bottom: 24px;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .hub-col:hover .hub-col-icon {
      transform: scale(1.12) translateY(-4px);
    }

    .col-bgr .hub-col-icon { background: rgba(16, 185, 129, 0.14); color: var(--accent); border: 1px solid rgba(16, 185, 129, 0.3); }
    .col-build .hub-col-icon { background: rgba(6, 182, 212, 0.14); color: var(--cyan); border: 1px solid rgba(6, 182, 212, 0.3); }
    .col-motion .hub-col-icon { background: rgba(168, 85, 247, 0.14); color: var(--violet); border: 1px solid rgba(168, 85, 247, 0.3); }
    .col-convert .hub-col-icon { background: rgba(245, 158, 11, 0.14); color: var(--amber); border: 1px solid rgba(245, 158, 11, 0.3); }
    .col-report .hub-col-icon { background: rgba(244, 63, 94, 0.14); color: var(--rose); border: 1px solid rgba(244, 63, 94, 0.3); }

    .hub-col-title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--text);
      margin: 0 0 12px 0;
    }

    .hub-col-desc {
      font-size: 13px;
      line-height: 1.55;
      color: var(--text-muted);
      margin: 0 0 24px 0;
      min-height: 40px;
    }

    .hub-col-features {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .hub-col-features li {
      font-size: 12px;
      color: var(--text-dim);
      display: flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
    }

    .hub-col:hover .hub-col-features li {
      color: var(--text);
    }

    .hub-col-features li i {
      font-size: 11px;
      color: var(--text-dim);
    }

    .col-bgr:hover .hub-col-features li i { color: var(--accent); }
    .col-build:hover .hub-col-features li i { color: var(--cyan); }
    .col-motion:hover .hub-col-features li i { color: var(--violet); }
    .col-convert:hover .hub-col-features li i { color: var(--amber); }
    .col-report:hover .hub-col-features li i { color: var(--rose); }

    .hub-col-footer {
      margin-top: 16px;
    }

    .hub-col-action {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.09);
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
      transition: all 0.25s ease;
    }

    .col-bgr:hover .hub-col-action { background: var(--accent); color: #021a10; border-color: var(--accent); box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35); }
    .col-build:hover .hub-col-action { background: var(--cyan); color: #02151d; border-color: var(--cyan); box-shadow: 0 8px 24px rgba(6, 182, 212, 0.35); }
    .col-motion:hover .hub-col-action { background: var(--violet); color: #160424; border-color: var(--violet); box-shadow: 0 8px 24px rgba(168, 85, 247, 0.35); }
    .col-convert:hover .hub-col-action { background: var(--amber); color: #211300; border-color: var(--amber); box-shadow: 0 8px 24px rgba(245, 158, 11, 0.35); }
    .col-report:hover .hub-col-action { background: var(--rose); color: #220309; border-color: var(--rose); box-shadow: 0 8px 24px rgba(244, 63, 94, 0.35); }

    /* Wizard Container & Step Deck */
    .wizard-deck {
      display: none;
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      overflow-y: auto;
      padding: 40px 24px 80px;
      background: #060a14;
      z-index: 120;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    }

    .wizard-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
      max-width: 900px;
      width: 100%;
      margin: 0 auto 24px;
    }

    .btn-wizard-back {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 7px 14px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s;
    }

    .btn-wizard-back:hover {
      background: var(--bg-hover);
      color: var(--text);
      border-color: #334155;
    }

    .wizard-progress-bar {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .wizard-step-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-dim);
      border: 1px solid var(--border);
      transition: all 0.15s;
    }

    .wizard-step-badge.active {
      background: var(--accent-dim);
      color: var(--accent);
      border-color: rgba(16, 185, 129, 0.35);
    }

    .wizard-step-badge.completed {
      background: rgba(16, 185, 129, 0.1);
      color: var(--accent);
      border-color: rgba(16, 185, 129, 0.2);
    }

    .wizard-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }

    .wizard-step-header {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .wizard-step-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -0.02em;
    }

    .wizard-step-subtitle {
      font-size: 13px;
      color: var(--text-dim);
      line-height: 1.5;
    }

    .wizard-tiles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }

    .wizard-tile {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }

    .wizard-tile:hover {
      border-color: #334155;
      background: var(--bg-hover);
    }

    .wizard-tile.active {
      border-color: var(--accent);
      background: var(--accent-dim);
      box-shadow: 0 0 0 1px var(--accent);
    }

    .wizard-tile-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .wizard-tile-icon {
      font-size: 16px;
      color: var(--accent);
    }

    .wizard-tile-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
    }

    .wizard-tile-desc {
      font-size: 11px;
      color: var(--text-dim);
      line-height: 1.4;
    }

    .wizard-footer-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 10px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
    }

    /* Wizard Autocomplete Search Control */
    .wiz-search-wrap {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }

    .wiz-search-input-box {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      background: #040814;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      transition: all 0.2s ease;
    }

    .wiz-search-input-box:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
    }

    .wiz-search-input-box i.wiz-search-icon {
      position: absolute;
      left: 14px;
      color: var(--text-dim);
      font-size: 14px;
      pointer-events: none;
      z-index: 5;
    }

    .wiz-search-ghost {
      position: absolute;
      left: 38px;
      right: 14px;
      padding: 12px 0;
      color: rgba(255, 255, 255, 0.28);
      font-size: 14px;
      font-family: var(--font-mono);
      pointer-events: none;
      white-space: pre;
      overflow: hidden;
      z-index: 1;
      user-select: none;
      line-height: 1.5;
    }

    .wiz-search-input {
      position: relative;
      width: 100%;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      padding: 12px 14px 12px 38px;
      color: var(--text);
      font-size: 14px;
      font-family: var(--font-mono);
      outline: none;
      z-index: 2;
      line-height: 1.5;
    }

    .wiz-search-hints {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-dim);
      padding: 0 4px;
    }

    .wiz-search-hints kbd {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 3px;
      padding: 1px 5px;
      font-size: 10px;
      font-family: var(--font-mono);
      color: var(--text-muted);
    }

    .wiz-suggestions-menu {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      max-height: 280px;
      overflow-y: auto;
      background: #090f20;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: var(--radius-sm);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(16, 185, 129, 0.2);
      z-index: 9999;
      display: none;
      flex-direction: column;
      padding: 4px;
    }

    .wiz-suggestions-menu.open {
      display: flex;
    }

    .wiz-suggestion-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 9px 12px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.12s ease;
    }

    .wiz-suggestion-item:hover,
    .wiz-suggestion-item.active {
      background: rgba(16, 185, 129, 0.18);
    }

    .wiz-suggestion-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .wiz-suggestion-item.active .wiz-suggestion-name {
      color: var(--accent);
    }

    .wiz-suggestion-path {
      font-size: 11px;
      color: var(--text-dim);
      font-family: var(--font-mono);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .terminal-cmd-box {
      background: #020617;
      border: 1px solid rgba(16, 185, 129, 0.35);
      border-radius: var(--radius-sm);
      padding: 18px 20px;
      position: relative;
      font-family: var(--font-mono);
      font-size: 14px;
      color: #38bdf8;
      overflow-x: auto;
      line-height: 1.6;
      box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.6);
      word-break: break-all;
    }

    .terminal-cmd-prompt {
      color: var(--accent);
      user-select: none;
      margin-right: 10px;
      font-weight: 700;
    }

    .btn-run-cmd {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      padding: 12px 24px;
      border-radius: var(--radius-sm);
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
      transition: all 0.15s ease;
    }

    .btn-run-cmd:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6);
      background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
    }

    /* Toast Notification Banner */
    .studio-toast {
      position: fixed;
      bottom: 28px;
      right: 28px;
      background: #0f172a;
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #f8fafc;
      padding: 12px 20px;
      border-radius: var(--radius);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      font-weight: 600;
      z-index: 2000;
      opacity: 0;
      transform: translateY(20px);
      pointer-events: none;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .studio-toast.show {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
  </style>
</head>
<body>

  <!-- Top Header Deck (Visible only in sub-workspaces, hidden on Hub start page) -->
  <header id="studio-header" style="display: none;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <button class="btn-header" onclick="switchTab('hub')" title="Zurück zum Hauptmenü (5 Bereiche)">
        <i class="fa-solid fa-arrow-left"></i>
        <span>Hauptmenü</span>
      </button>

      <div class="brand">
        <div class="brand-icon"><i class="fa-solid fa-frog"></i></div>
        <span>TOAD Studio</span>
        <span class="brand-badge">v1.2</span>
      </div>

      <button class="btn-header" id="btn-toggle-sidebar" onclick="toggleSidebar()" title="Dateibaum ein-/ausblenden">
        <i class="fa-solid fa-folder-tree" id="sidebar-toggle-icon"></i>
        <span>Dateibaum</span>
      </button>
    </div>

    <div class="header-actions">
      <button class="btn-header" onclick="openInitModal()" title="Neues .toad Design anlegen">
        <i class="fa-solid fa-plus"></i>
        <span>Neu</span>
      </button>
      <button class="btn-header" onclick="openBundleModal()" title="Projekt-Assets bündeln">
        <i class="fa-solid fa-box-archive"></i>
        <span>Bundle</span>
      </button>
      <button class="btn-header" onclick="openWorkspacesModal()" title="Aktive Workspaces verwalten">
        <i class="fa-solid fa-layer-group"></i>
        <span>Workspaces</span>
      </button>
      <button class="btn-header btn-header-danger" onclick="shutdownServer()" title="TOAD Studio Server stoppen">
        <i class="fa-solid fa-power-off"></i>
        <span>Beenden</span>
      </button>
    </div>
  </header>

  <!-- Main Workspaces Container -->
  <div class="app-body">

    <!-- Unified Collapsible Left Sidebar (Available in Graphic, Animation, Report) -->
    <aside class="sidebar" id="global-sidebar" style="display: none;">
      <div class="sidebar-header">
        <span class="sidebar-title"><i class="fa-solid fa-folder-tree"></i> Dateibaum</span>
        <button class="btn-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="loadFiles()">
          <i class="fa-solid fa-rotate-right"></i> Neu laden
        </button>
      </div>
      <div class="sidebar-search">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" id="file-filter" placeholder="Dateien oder Ordner filtern..." oninput="filterFiles()">
      </div>
      <div class="sidebar-tree" id="file-tree">
        <div style="padding: 20px; font-size: 12px; color: var(--text-dim); text-align: center;">
          <i class="fa-solid fa-circle-notch fa-spin" style="margin-right: 6px;"></i> Lade Dateien...
        </div>
      </div>
    </aside>

    <main class="content" style="padding: 0; margin: 0; width: 100vw; height: 100vh; overflow: hidden;">

      <!-- Tab 0: Command Builder Hub (5 Full-Height Vertical Columns) -->
      <div class="tab-view active" id="tab-hub">
        <!-- MAIN MENU: 5 Full-Height Vertical Columns -->
        <div id="hub-main-menu" class="hub-fullscreen-columns">
          <!-- Column 1: Freistellen -->
          <div class="hub-col col-bgr" onclick="openWizard('bgr')">
            <div class="hub-col-top">
              <span class="hub-col-idx">01 // TOAD KI</span>
              <span class="hub-col-cmd">toad remove-bg</span>
            </div>
            <div class="hub-col-body">
              <div class="hub-col-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
              <h2 class="hub-col-title">Freistellen</h2>
              <p class="hub-col-desc">Lokale KI-Hintergrundentfernung für Bilder &amp; Bilderserien ohne Cloud.</p>
              <ul class="hub-col-features">
                <li><i class="fa-solid fa-check"></i> Schnell, Standard &amp; DYB</li>
                <li><i class="fa-solid fa-check"></i> Einzelne Bilder &amp; ganze Ordner</li>
                <li><i class="fa-solid fa-check"></i> Verlustfreies PNG oder WebP</li>
                <li><i class="fa-solid fa-check"></i> Automatisches Speichern</li>
              </ul>
            </div>
            <div class="hub-col-footer">
              <div class="hub-col-action">
                <span>Assistent starten</span>
                <i class="fa-solid fa-arrow-right"></i>
              </div>
            </div>
          </div>

          <!-- Column 2: Grafik & Build -->
          <div class="hub-col col-build" onclick="openWizard('build')">
            <div class="hub-col-top">
              <span class="hub-col-idx">02 // ENGINE</span>
              <span class="hub-col-cmd">toad build</span>
            </div>
            <div class="hub-col-body">
              <div class="hub-col-icon"><i class="fa-solid fa-image"></i></div>
              <h2 class="hub-col-title">Grafik &amp; Build</h2>
              <p class="hub-col-desc">Kompiliere deklarative .toad Layouts in gestochen scharfe Grafiken.</p>
              <ul class="hub-col-features">
                <li><i class="fa-solid fa-check"></i> PNG, WebP, JPG, PSD</li>
                <li><i class="fa-solid fa-check"></i> Alle Formate synchron (-f all)</li>
                <li><i class="fa-solid fa-check"></i> Skalierung 1x, 2x, 4x Retina</li>
                <li><i class="fa-solid fa-check"></i> Millisekunden-schnell</li>
              </ul>
            </div>
            <div class="hub-col-footer">
              <div class="hub-col-action">
                <span>Assistent starten</span>
                <i class="fa-solid fa-arrow-right"></i>
              </div>
            </div>
          </div>

          <!-- Column 3: Animation -->
          <div class="hub-col col-motion" onclick="openWizard('motion')">
            <div class="hub-col-top">
              <span class="hub-col-idx">03 // MOTION</span>
              <span class="hub-col-cmd">toad motion</span>
            </div>
            <div class="hub-col-body">
              <div class="hub-col-icon"><i class="fa-solid fa-film"></i></div>
              <h2 class="hub-col-title">Animation</h2>
              <p class="hub-col-desc">Rendere flüssige Keyframe-Animationen aus .toadm Dateien.</p>
              <ul class="hub-col-features">
                <li><i class="fa-solid fa-check"></i> MP4, WebM, GIF, Frames</li>
                <li><i class="fa-solid fa-check"></i> 30, 60 oder 120 FPS</li>
                <li><i class="fa-solid fa-check"></i> Hardware-Encoding &amp; Easing</li>
                <li><i class="fa-solid fa-check"></i> Live-Player Vorschau</li>
              </ul>
            </div>
            <div class="hub-col-footer">
              <div class="hub-col-action">
                <span>Assistent starten</span>
                <i class="fa-solid fa-arrow-right"></i>
              </div>
            </div>
          </div>

          <!-- Column 4: Konvertieren -->
          <div class="hub-col col-convert" onclick="openWizard('convert')">
            <div class="hub-col-top">
              <span class="hub-col-idx">04 // MEDIA</span>
              <span class="hub-col-cmd">toad convert</span>
            </div>
            <div class="hub-col-body">
              <div class="hub-col-icon"><i class="fa-solid fa-arrows-rotate"></i></div>
              <h2 class="hub-col-title">Konvertieren</h2>
              <p class="hub-col-desc">Universeller Bildkonverter, Skalierer und Photoshop-Importer.</p>
              <ul class="hub-col-features">
                <li><i class="fa-solid fa-check"></i> WebP, AVIF, PNG, SVG, PDF</li>
                <li><i class="fa-solid fa-check"></i> PSD zu .toad Code &amp; Assets</li>
                <li><i class="fa-solid fa-check"></i> Freie Zielskalierung (px / mult)</li>
                <li><i class="fa-solid fa-check"></i> Intelligente Web-Kompression</li>
              </ul>
            </div>
            <div class="hub-col-footer">
              <div class="hub-col-action">
                <span>Assistent starten</span>
                <i class="fa-solid fa-arrow-right"></i>
              </div>
            </div>
          </div>

          <!-- Column 5: Qualitäts-Audit -->
          <div class="hub-col col-report" onclick="openWizard('report')">
            <div class="hub-col-top">
              <span class="hub-col-idx">05 // AUDIT</span>
              <span class="hub-col-cmd">toad report</span>
            </div>
            <div class="hub-col-body">
              <div class="hub-col-icon"><i class="fa-solid fa-chart-simple"></i></div>
              <h2 class="hub-col-title">Qualitäts-Audit</h2>
              <p class="hub-col-desc">Tiefenanalyse für Barrierefreiheit, Kontraste &amp; Anti-AI-Slop.</p>
              <ul class="hub-col-features">
                <li><i class="fa-solid fa-check"></i> WCAG 2.2 Farbkontraste</li>
                <li><i class="fa-solid fa-check"></i> 13 TOAD-Syntaxregeln Check</li>
                <li><i class="fa-solid fa-check"></i> Anti-AI-Slop Heuristiken</li>
                <li><i class="fa-solid fa-check"></i> 1-Klick Auto-Reparatur (--fixes)</li>
              </ul>
            </div>
            <div class="hub-col-footer">
              <div class="hub-col-action">
                <span>Assistent starten</span>
                <i class="fa-solid fa-arrow-right"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- INTERACTIVE WIZARD DECK -->
        <div id="hub-wizard-deck" class="wizard-deck">
          <div class="wizard-topbar">
            <button type="button" class="btn-wizard-back" onclick="closeWizard()">
              <i class="fa-solid fa-arrow-left"></i>
              <span>Zurück zur Übersicht</span>
            </button>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span id="wizard-title-badge" class="hub-col-cmd" style="margin: 0;">Assistent</span>
              <span id="wizard-header-title" style="font-weight: 700; font-size: 15px; color: var(--text);">Freistellen</span>
            </div>
            <div class="wizard-progress-bar" id="wizard-step-indicators"></div>
          </div>

          <!-- Wizard Dynamic Card Content -->
          <div class="wizard-card" id="wizard-card-body" style="max-width: 900px; width: 100%; margin: 0 auto;"></div>
        </div>
      </div>

      <!-- Tab 1: Grafik & Build Deck -->
      <div class="tab-view" id="tab-graphic">
        <div class="deck-container">
          <!-- Parameter Control Deck -->
          <div class="deck-controls">
            
            <!-- Compact Active File Header Card -->
            <div class="active-file-header-card">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                  <span class="status-dot" id="deck-status-dot"></span>
                  <span id="deck-filename" class="deck-file-title">Keine Datei gewählt</span>
                </div>
                <span id="deck-dimensions" class="deck-dim-badge">-</span>
              </div>
              <div style="display: flex; gap: 6px; margin-top: 10px;">
                <button type="button" class="btn-secondary" id="btn-open-folder" style="flex: 1; padding: 5px 8px; font-size: 11px;" onclick="openActiveFolder()" title="Ordner im Datei-Explorer öffnen">
                  <i class="fa-solid fa-folder-open"></i> Ordner
                </button>
                <button type="button" class="btn-secondary" style="padding: 5px 8px; font-size: 11px;" onclick="switchTab('report')" title="Design-Qualitätsaudit für aktive Datei öffnen">
                  <i class="fa-solid fa-chart-simple"></i> Audit
                </button>
              </div>
            </div>

            <!-- Schnell-Profile / Presets -->
            <div class="param-group">
              <div class="param-label">
                <span><i class="fa-solid fa-wand-magic-sparkles" style="color: var(--accent); margin-right: 6px;"></i> 1-Klick Presets</span>
                <span class="param-sub">Schnellkonfiguration</span>
              </div>
              <div class="quick-preset-bar">
                <button type="button" class="quick-preset-btn active" id="btn-preset-web" onclick="applyBuildPreset('web')">
                  <i class="fa-solid fa-globe"></i>
                  <span class="qp-name">Web</span>
                  <span class="qp-sub">1x &bull; 72 DPI</span>
                </button>
                <button type="button" class="quick-preset-btn" id="btn-preset-print" onclick="applyBuildPreset('print')">
                  <i class="fa-solid fa-print"></i>
                  <span class="qp-name">Druck</span>
                  <span class="qp-sub">300 DPI &bull; 2x</span>
                </button>
                <button type="button" class="quick-preset-btn" id="btn-preset-social" onclick="applyBuildPreset('social')">
                  <i class="fa-solid fa-share-nodes"></i>
                  <span class="qp-name">Social</span>
                  <span class="qp-sub">2x &bull; WebP/PNG</span>
                </button>
              </div>
            </div>

            <!-- Export-Formate als moderne Chips -->
            <div class="param-group">
              <div class="param-label">
                <span><i class="fa-solid fa-file-export" style="color: var(--cyan); margin-right: 6px;"></i> Export-Formate</span>
                <span class="param-sub">(-f / --format)</span>
              </div>
              <div class="format-chips-grid">
                <label class="format-chip active" id="chip-png">
                  <input type="checkbox" name="fmt" value="png" checked onchange="onFormatChipChange(this)">
                  <i class="fa-solid fa-file-image"></i>
                  <span>PNG</span>
                </label>
                <label class="format-chip" id="chip-jpg">
                  <input type="checkbox" name="fmt" value="jpg" onchange="onFormatChipChange(this)">
                  <i class="fa-solid fa-file-image"></i>
                  <span>JPG</span>
                </label>
                <label class="format-chip active" id="chip-webp">
                  <input type="checkbox" name="fmt" value="webp" checked onchange="onFormatChipChange(this)">
                  <i class="fa-solid fa-bolt"></i>
                  <span>WebP</span>
                </label>
                <label class="format-chip" id="chip-pdf">
                  <input type="checkbox" name="fmt" value="pdf" onchange="onFormatChipChange(this)">
                  <i class="fa-solid fa-file-pdf"></i>
                  <span>PDF</span>
                </label>
                <label class="format-chip" id="chip-svg">
                  <input type="checkbox" name="fmt" value="svg" onchange="onFormatChipChange(this)">
                  <i class="fa-solid fa-bezier-curve"></i>
                  <span>SVG</span>
                </label>
                <label class="format-chip" id="chip-psd">
                  <input type="checkbox" name="fmt" value="psd" onchange="onFormatChipChange(this)">
                  <i class="fa-solid fa-layer-group"></i>
                  <span>PSD</span>
                </label>
              </div>
            </div>

            <!-- Skalierung & DPI in einer Zeile -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="param-group" style="margin-bottom: 0;">
                <div class="param-label"><span>Skalierung</span><span class="param-sub">(-s)</span></div>
                <div class="segment-group" id="scale-group">
                  <button type="button" class="segment-btn active" onclick="setScale(1)">1x</button>
                  <button type="button" class="segment-btn" onclick="setScale(2)">2x</button>
                  <button type="button" class="segment-btn" onclick="setScale(4)">4x</button>
                </div>
              </div>

              <div class="param-group" style="margin-bottom: 0;">
                <div class="param-label"><span>Auflösung</span><span class="param-sub">(-d)</span></div>
                <select class="select-control" id="dpi-select" onchange="updateCliPreview()">
                  <option value="72" selected>72 DPI (Web)</option>
                  <option value="150">150 DPI</option>
                  <option value="300">300 DPI (Druck)</option>
                </select>
              </div>
            </div>

            <!-- Qualität -->
            <div class="param-group" style="margin-bottom: 0;">
              <div class="param-label">
                <span>Qualität: <span id="quality-val" style="color: var(--accent); font-family: var(--font-mono); font-weight: 700;">85</span>%</span>
                <span class="param-sub">(-q)</span>
              </div>
              <input type="range" class="slider-control" id="quality-slider" min="1" max="100" value="85" oninput="document.getElementById('quality-val').textContent = this.value; updateCliPreview();">
            </div>

            <!-- Erweiterte Prepress & Build-Optionen (Standardmäßig aufgeräumt eingeklappt!) -->
            <details class="advanced-drawer">
              <summary>
                <div class="drawer-summary-left">
                  <i class="fa-solid fa-sliders"></i>
                  <span>Erweiterte Optionen (Prepress, CMYK, Bleed)</span>
                </div>
                <i class="fa-solid fa-chevron-down drawer-chevron"></i>
              </summary>
              <div class="drawer-content">
                <div class="param-group" style="margin-bottom: 0;">
                  <div class="param-label"><span>Druck-Beschnitt (Bleed in mm)</span><span class="param-sub">(--bleed)</span></div>
                  <input type="number" class="input-control" id="bleed-input" placeholder="0" min="0" step="0.5" oninput="updateCliPreview()">
                </div>

                <div class="param-group" style="margin-bottom: 0;">
                  <div class="param-label">Zusatzoptionen</div>
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label class="check-btn"><input type="checkbox" id="opt-marks" onchange="updateCliPreview()"> Passermarken &amp; Schnittmarken (--marks)</label>
                    <label class="check-btn"><input type="checkbox" id="opt-cmyk" onchange="updateCliPreview()"> Prepress CMYK Farbraum (--cmyk)</label>
                    <label class="check-btn"><input type="checkbox" id="opt-dryrun" onchange="updateCliPreview()"> Dry-Run (Nur validieren ohne Speichern)</label>
                  </div>
                </div>

                <div class="param-group" style="margin-bottom: 0;">
                  <div class="param-label"><span>Ausgabe-Ordner</span><span class="param-sub">(-o / --out)</span></div>
                  <input type="text" class="input-control" id="outdir-input" placeholder="Standard: Neben Quelldatei" oninput="updateCliPreview()">
                </div>
              </div>
            </details>

            <!-- CLI-Befehl Drawer (Aufgeräumt eingeklappt mit 1-Klick-Kopieren) -->
            <details class="advanced-drawer">
              <summary>
                <div class="drawer-summary-left">
                  <i class="fa-solid fa-terminal"></i>
                  <span>Terminal-Befehl anzeigen</span>
                </div>
                <div class="drawer-summary-right">
                  <span class="drawer-badge" id="cli-summary-snippet">toad build...</span>
                  <i class="fa-solid fa-chevron-down drawer-chevron"></i>
                </div>
              </summary>
              <div class="drawer-content">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 11px; color: var(--text-dim);">Live generierter Befehl:</span>
                  <button type="button" class="btn-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="copyCliCommand()">
                    <i class="fa-solid fa-copy"></i> Kopieren
                  </button>
                </div>
                <div class="cli-preview-box" id="cli-preview-text">toad build "..."</div>
              </div>
            </details>

            <!-- Primary Action Button -->
            <button class="btn-primary" id="btn-run-build" onclick="executeBuild()" style="padding: 14px; font-size: 14px;">
              <i class="fa-solid fa-rocket"></i>
              <span>Build ausführen</span>
            </button>
          </div>

          <!-- Visual Canvas View -->
          <div class="deck-preview">
            <div class="preview-toolbar">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="status-dot online"></span>
                <span id="preview-status-badge" style="font-family: var(--font-mono); font-size: 12px; color: var(--accent); font-weight: 600;">Bereit</span>
                <span id="preview-dim-indicator" style="font-size: 11px; color: var(--text-dim); font-family: var(--font-mono);">-</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <button type="button" class="btn-secondary" style="padding: 5px 10px; font-size: 11px;" onclick="refreshPreview()">
                  <i class="fa-solid fa-rotate-right"></i> Neu rendern
                </button>
                <div class="segment-group">
                  <button type="button" class="segment-btn active" id="zoom-fit" onclick="setZoom('fit')">Fit</button>
                  <button type="button" class="segment-btn" id="zoom-100" onclick="setZoom(1)">100%</button>
                  <button type="button" class="segment-btn" id="zoom-200" onclick="setZoom(2)">200%</button>
                </div>
              </div>
            </div>

            <div class="preview-canvas-wrap" id="canvas-container">
              <div class="empty-state" id="canvas-empty-state" style="display: flex;">
                <div class="empty-icon"><i class="fa-solid fa-image"></i></div>
                <div class="empty-title">Kein Design ausgewählt</div>
                <div class="empty-desc">Wähle eine .toad Datei im Dateibaum links aus oder erstelle ein neues Design mit "Neu".</div>
                <button type="button" class="btn-secondary" onclick="openInitModal()">
                  <i class="fa-solid fa-plus"></i> Neues Design erstellen
                </button>
              </div>
              <img id="preview-img" src="/image" alt="Design Vorschau" draggable="false" style="display: none;">
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 2: Animation Deck (toad motion) -->
      <div class="tab-view" id="tab-animation">
        <div class="deck-container">
          <div class="deck-controls">
            
            <!-- Compact Active Animation File Header Card -->
            <div class="active-file-header-card">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                  <span class="status-dot" id="motion-status-dot"></span>
                  <span id="motion-filename" class="deck-file-title">Keine .toadm Datei gewählt</span>
                </div>
                <span class="file-badge toadm">MOTION</span>
              </div>
            </div>

            <!-- Ausgabe-Format -->
            <div class="param-group">
              <div class="param-label">
                <span><i class="fa-solid fa-film" style="color: var(--violet); margin-right: 6px;"></i> Ausgabe-Format</span>
                <span class="param-sub">(-f / --format)</span>
              </div>
              <div class="segment-group" id="motion-fmt-group">
                <button type="button" class="segment-btn active" onclick="setMotionFmt('mp4')">MP4</button>
                <button type="button" class="segment-btn" onclick="setMotionFmt('webm')">WebM</button>
                <button type="button" class="segment-btn" onclick="setMotionFmt('gif')">GIF</button>
                <button type="button" class="segment-btn" onclick="setMotionFmt('frames')">Frames</button>
              </div>
            </div>

            <!-- Framerate & Skalierung -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="param-group" style="margin-bottom: 0;">
                <div class="param-label"><span>Framerate</span><span class="param-sub">(--fps)</span></div>
                <select class="select-control" id="motion-fps" onchange="updateMotionCliPreview()">
                  <option value="30">30 FPS</option>
                  <option value="60" selected>60 FPS</option>
                  <option value="120">120 FPS</option>
                </select>
              </div>

              <div class="param-group" style="margin-bottom: 0;">
                <div class="param-label"><span>Skalierung</span><span class="param-sub">(--scale)</span></div>
                <select class="select-control" id="motion-scale" onchange="updateMotionCliPreview()">
                  <option value="1" selected>1x</option>
                  <option value="2">2x</option>
                </select>
              </div>
            </div>

            <!-- Videoqualität & CLI Drawer (Aufgeräumt eingeklappt!) -->
            <details class="advanced-drawer">
              <summary>
                <div class="drawer-summary-left">
                  <i class="fa-solid fa-sliders"></i>
                  <span>Erweiterte Video-Optionen (CRF & CLI)</span>
                </div>
                <i class="fa-solid fa-chevron-down drawer-chevron"></i>
              </summary>
              <div class="drawer-content">
                <div class="param-group" style="margin-bottom: 0;">
                  <div class="param-label">
                    <span>Videoqualität / CRF: <span id="motion-crf-val" style="color: var(--accent); font-family: var(--font-mono); font-weight: 700;">18</span></span>
                    <span class="param-sub">(-q, niedriger = besser)</span>
                  </div>
                  <input type="range" class="slider-control" id="motion-crf" min="1" max="51" value="18" oninput="document.getElementById('motion-crf-val').textContent = this.value; updateMotionCliPreview();">
                </div>

                <div class="param-group" style="margin-bottom: 0;">
                  <div class="param-label"><span>Terminal-Befehl</span></div>
                  <div class="cli-preview-box" id="motion-cli-preview">toad motion "..." -f mp4 --fps 60</div>
                </div>
              </div>
            </details>

            <button class="btn-primary" id="btn-render-motion" onclick="renderMotion()" style="padding: 14px; font-size: 14px;">
              <i class="fa-solid fa-clapperboard"></i>
              <span>Animation rendern</span>
            </button>
          </div>

          <div class="deck-preview" style="align-items: center; justify-content: center; padding: 30px;">
            <div id="motion-player-wrap" style="max-width: 800px; width: 100%; text-align: center;">
              <video id="motion-video" controls autoplay loop style="max-width: 100%; border-radius: var(--radius); border: 1px solid var(--border); display: none;"></video>
              <div class="empty-state" id="motion-placeholder">
                <div class="empty-icon"><i class="fa-solid fa-film"></i></div>
                <div class="empty-title">Keine Animation gerendert</div>
                <div class="empty-desc">Wähle eine <span style="color: var(--violet); font-family: var(--font-mono);">.toadm</span> Datei aus dem Dateibaum links und klicke auf "Animation rendern".</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 3: Freistellen / BG-Remover (toad remove-bg) -->
      <div class="tab-view" id="tab-bg-remover">
        <div class="bgr-container">
          <div class="bgr-sidebar">
            <div class="section-title">
              <span><i class="fa-solid fa-wand-magic-sparkles" style="color: var(--accent);"></i> Lokale KI-Freistellung (toad remove-bg)</span>
            </div>

            <!-- Dropzone (Images & Folders) -->
            <div class="dropzone" id="bgr-dropzone" onclick="onBgrDropzoneClick(event)">
              <input type="file" id="bgr-file-input" style="display: none;" accept="image/*" multiple onchange="handleBgFiles(this.files)">
              <input type="file" id="bgr-folder-input" style="display: none;" webkitdirectory mozdirectory directory multiple onchange="handleBgFiles(this.files)">
              <i class="fa-solid fa-cloud-arrow-up dropzone-icon"></i>
              <div style="font-size: 14px; font-weight: 700; color: var(--text);">Bilder oder Ordner hier ablegen</div>
              <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">Unterstützt einzelne Bilder, Bilderserien &amp; ganze Ordner (PNG, JPG, WebP)</div>
              <div style="display: flex; gap: 8px; margin-top: 8px;">
                <button type="button" class="btn-secondary" style="padding: 5px 12px; font-size: 11px;" onclick="triggerBgrFilePicker(event)">
                  <i class="fa-solid fa-images"></i> Bilder wählen
                </button>
                <button type="button" class="btn-secondary" style="padding: 5px 12px; font-size: 11px;" onclick="triggerBgrFolderPicker(event)">
                  <i class="fa-solid fa-folder-open"></i> Ordner wählen
                </button>
              </div>
            </div>

            <!-- Quality Presets -->
            <div class="param-group">
              <div class="param-label">
                <span><i class="fa-solid fa-bullseye" style="color: var(--cyan); margin-right: 6px;"></i> Qualitäts-Preset</span>
                <span class="param-sub">(--preset)</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 6px;" id="bgr-presets">
                <label class="check-btn" style="flex-direction: column; align-items: flex-start;">
                  <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                    <input type="radio" name="bgr-preset" value="fast" onchange="updateBgrPreset()">
                    <span style="font-weight: 700;"><i class="fa-solid fa-bolt" style="color: var(--amber); margin-right: 4px;"></i> Schnell</span>
                    <span style="font-size: 10px; color: var(--cyan); margin-left: auto;">BiRefNet Lite</span>
                  </div>
                  <div style="font-size: 11px; color: var(--text-dim); margin-left: 24px;">Ultra-schnelle Vorschau für schnelle Layouts.</div>
                </label>

                <label class="check-btn" style="flex-direction: column; align-items: flex-start;">
                  <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                    <input type="radio" name="bgr-preset" value="standard" checked onchange="updateBgrPreset()">
                    <span style="font-weight: 700;"><i class="fa-solid fa-crosshairs" style="color: var(--accent); margin-right: 4px;"></i> Standard</span>
                    <span style="font-size: 10px; color: var(--accent); margin-left: auto;">BiRefNet High-Res</span>
                  </div>
                  <div style="font-size: 11px; color: var(--text-dim); margin-left: 24px;">Ausgewogene Randschärfe für die meisten Motive.</div>
                </label>

                <label class="check-btn" style="flex-direction: column; align-items: flex-start;">
                  <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                    <input type="radio" name="bgr-preset" value="dyb" onchange="updateBgrPreset()">
                    <span style="font-weight: 700;"><i class="fa-solid fa-gem" style="color: var(--violet); margin-right: 4px;"></i> Höchste Präzision</span>
                    <span style="font-size: 10px; color: var(--violet); margin-left: auto;">Ensemble + Guided Matting</span>
                  </div>
                  <div style="font-size: 11px; color: var(--text-dim); margin-left: 24px;">Multi-Modell Ensemble für feinste Haare & komplexe Kanten.</div>
                </label>
              </div>
            </div>

            <!-- Format -->
            <div class="param-group">
              <div class="param-label">Ausgabe-Format</div>
              <div class="segment-group">
                <button class="segment-btn active" id="bgr-fmt-png" onclick="setBgrFormat('png')">PNG (Verlustfrei)</button>
                <button class="segment-btn" id="bgr-fmt-webp" onclick="setBgrFormat('webp')">WebP (Kompakt)</button>
              </div>
            </div>

            <!-- Zielverzeichnis & Auto-Save -->
            <div class="param-group">
              <div class="param-label" style="display: flex; align-items: center; justify-content: space-between;">
                <span><i class="fa-solid fa-folder-arrow-down" style="color: var(--accent); margin-right: 6px;"></i> Zielordner</span>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 500; cursor: pointer; color: var(--text-dim); text-transform: none; letter-spacing: normal;">
                  <input type="checkbox" id="bgr-auto-save" checked style="accent-color: var(--accent);"> Auto-Speichern
                </label>
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <input type="text" class="text-input" id="bgr-out-dir" value="./freigestellt" placeholder="./freigestellt" style="flex: 1; font-family: var(--font-mono); font-size: 12px; padding: 7px 10px;">
                <button type="button" class="btn-secondary" style="padding: 7px 10px; font-size: 11px;" title="Zielordner im Explorer öffnen" onclick="openBgrTargetFolder()">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </button>
              </div>
              <div style="font-size: 10px; color: var(--text-dim); margin-top: 4px;">
                Freigestellte Motive werden direkt als <code>[Name]-freigestellt.[ext]</code> gespeichert.
              </div>
            </div>


            <!-- Warteschlange -->
            <div class="section-title" style="margin-top: 10px;">
              <span><i class="fa-solid fa-list-check"></i> Bilder-Warteschlange</span>
            </div>
            <div class="bgr-image-list" id="bgr-queue-list">
              <div style="font-size: 12px; color: var(--text-dim); text-align: center; padding: 12px;">Keine Bilder geladen.</div>
            </div>
          </div>

          <!-- Split-Slider Comparison View -->
          <div class="bgr-view">
            <div class="split-container" id="split-box">
              <div class="split-floating-tag left">Original</div>
              <div class="split-floating-tag right"><i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 4px;"></i> Freigestellt (KI)</div>
              <!-- Bottom Layer: Original -->
              <div class="split-layer bottom">
                <img id="split-img-orig" src="" alt="Original" draggable="false">
              </div>
              <!-- Top Layer: Processed Alpha Isolated Image -->
              <div class="split-layer top" id="split-top-layer">
                <img id="split-img-proc" src="" alt="Freigestellt" draggable="false">
              </div>
              <!-- Drag Divider Handle -->
              <div class="split-handle" id="split-divider">
                <div class="split-knob"><i class="fa-solid fa-arrows-left-right"></i></div>
              </div>
            </div>

            <div style="margin-top: 16px; display: flex; gap: 12px; align-items: center;">
              <span style="font-size: 12px; color: var(--text-dim);">
                <i class="fa-solid fa-hand-pointer" style="margin-right: 4px;"></i> Ziehe den Slider nach links/rechts zum Vergleichen
              </span>
              <button class="btn-secondary" id="btn-bgr-download" style="display: none;" onclick="downloadBgrResult()">
                <i class="fa-solid fa-download"></i> Freigestelltes Bild herunterladen
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 4: Konvertieren (toad convert) - DECLUTTERED & ORGANIZED -->
      <div class="tab-view" id="tab-convert" style="overflow-y: auto; padding: 30px 20px 80px 20px;">
        <div style="max-width: 860px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 18px;">
          
          <!-- Mode Switcher Navigation -->
          <div class="convert-mode-nav">
            <button class="convert-mode-btn active" id="btn-mode-img" onclick="switchConvertMode('img')">
              <i class="fa-solid fa-image"></i>
              <span>Bild konvertieren, skalieren &amp; komprimieren</span>
            </button>
            <button class="convert-mode-btn" id="btn-mode-psd" onclick="switchConvertMode('psd')">
              <i class="fa-solid fa-layer-group"></i>
              <span>Photoshop PSD zu TOAD DSL</span>
            </button>
          </div>

          <!-- SUBTAB 1: Universal Image Converter, Scaler & Compressor -->
          <div id="convert-view-img" style="display: flex; flex-direction: column; gap: 18px;">
            
            <!-- Universal Image Dropzone -->
            <div class="dropzone" id="img-dropzone" onclick="document.getElementById('img-file-input').click()">
              <input type="file" id="img-file-input" style="display: none;" accept="image/*,.psd,.svg,.ico,.pdf,.avif,.webp" onchange="handleImageConvertFile(this.files[0])">
              <i class="fa-solid fa-cloud-arrow-up dropzone-icon"></i>
              <div style="font-size: 15px; font-weight: 700; color: var(--text);">Beliebiges Bild hier ablegen oder durchsuchen</div>
              <div style="font-size: 12px; color: var(--text-dim); margin-top: 2px;">Unterstützt WebP, PNG, JPG/JPEG, AVIF, SVG, PSD, GIF, ICO &amp; PDF</div>
            </div>

            <!-- Source Image Info Card (visible once a file is selected) -->
            <div class="card" id="img-source-card" style="display: none;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px;">
                <div style="display: flex; align-items: center; gap: 14px; overflow: hidden;">
                  <img id="img-source-thumb" src="" style="width: 52px; height: 52px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--border); background: #000; flex-shrink: 0;" />
                  <div style="overflow: hidden;">
                    <div id="img-source-name" style="font-weight: 700; font-size: 14px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span>Format: <strong id="img-source-format" style="font-family: var(--font-mono); color: var(--cyan);"></strong></span>
                      <span>&bull;</span>
                      <span>Größe: <strong id="img-source-size" style="font-family: var(--font-mono);"></strong></span>
                      <span>&bull;</span>
                      <span>Auflösung: <strong id="img-source-res" style="font-family: var(--font-mono); color: var(--accent);"></strong></span>
                    </div>
                  </div>
                </div>
                <button class="btn-secondary" style="flex-shrink: 0;" onclick="document.getElementById('img-file-input').click()">
                  <i class="fa-solid fa-arrows-rotate"></i> Anderes Bild
                </button>
              </div>
            </div>

            <!-- Main Conversion Controls -->
            <div id="img-config-deck" style="display: flex; flex-direction: column; gap: 16px;">
              
              <!-- 1. Zielformat auswählen (Intuitiv, aufgeräumt!) -->
              <div class="card">
                <div class="param-label" style="margin-bottom: 12px;">
                  <span><i class="fa-solid fa-circle-check" style="color: var(--accent); margin-right: 6px;"></i> 1. Zielformat auswählen</span>
                  <span class="param-sub">Klicke auf das gewünschte Ausgabeformat</span>
                </div>

                <!-- 4 populärste Hauptformate (Groß & Übersichtlich) -->
                <div class="format-primary-grid">
                  <button type="button" class="format-btn active" id="fmt-webp" onclick="selectConvertFormat('webp')">
                    <i class="fa-solid fa-bolt"></i>
                    <span class="format-title">WEBP</span>
                    <span class="format-desc">Standard Web &bull; Klein &amp; Scharf</span>
                  </button>
                  <button type="button" class="format-btn" id="fmt-png" onclick="selectConvertFormat('png')">
                    <i class="fa-solid fa-file-image"></i>
                    <span class="format-title">PNG</span>
                    <span class="format-desc">Verlustfrei mit Alpha-Kanal</span>
                  </button>
                  <button type="button" class="format-btn" id="fmt-jpeg" onclick="selectConvertFormat('jpeg')">
                    <i class="fa-solid fa-camera"></i>
                    <span class="format-title">JPG</span>
                    <span class="format-desc">Universell für Fotos</span>
                  </button>
                  <button type="button" class="format-btn" id="fmt-avif" onclick="selectConvertFormat('avif')">
                    <i class="fa-solid fa-sparkles"></i>
                    <span class="format-title">AVIF</span>
                    <span class="format-desc">Next-Gen Ultra-Kompression</span>
                  </button>
                </div>

                <!-- Sekundäre Spezialformate als elegante Schnell-Pills -->
                <div class="format-secondary-bar">
                  <span class="format-secondary-label">Weitere Formate:</span>
                  <button type="button" class="format-pill-btn" id="fmt-svg" onclick="selectConvertFormat('svg')">
                    <i class="fa-solid fa-bezier-curve"></i> SVG (Vektor)
                  </button>
                  <button type="button" class="format-pill-btn" id="fmt-pdf" onclick="selectConvertFormat('pdf')">
                    <i class="fa-solid fa-file-pdf"></i> PDF (Dokument)
                  </button>
                  <button type="button" class="format-pill-btn" id="fmt-ico" onclick="selectConvertFormat('ico')">
                    <i class="fa-solid fa-icons"></i> Favicon (ICO)
                  </button>
                  <button type="button" class="format-pill-btn" id="fmt-gif" onclick="selectConvertFormat('gif')">
                    <i class="fa-solid fa-play"></i> GIF
                  </button>
                </div>

                <!-- Transparenz-Hintergrundfarbe (nur bei JPEG / PDF sichtbar) -->
                <div id="img-bg-group" style="margin-top: 14px; display: none; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid var(--border);">
                  <div style="font-size: 12px; color: var(--text-muted);">
                    <i class="fa-solid fa-palette" style="margin-right: 6px;"></i> Hintergrundfarbe (bei transparentem Quellbild):
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <select class="select-control" id="img-bg-color" style="width: 170px;">
                      <option value="#FFFFFF" selected>Weiß (#FFFFFF)</option>
                      <option value="#000000">Schwarz (#000000)</option>
                      <option value="#090D16">Dunkelgrau (TOAD)</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Collapsible Section 1: 📐 Skalierung & Maße (EINGEKLAPPT für sauberen Look!) -->
              <details class="advanced-drawer" id="drawer-scale">
                <summary>
                  <div class="drawer-summary-left">
                    <i class="fa-solid fa-up-right-and-down-left-from-center" style="color: var(--cyan);"></i>
                    <span>Erweiterte Skalierung &amp; Maße (optional)</span>
                  </div>
                  <div class="drawer-summary-right">
                    <span class="drawer-badge" id="scale-summary-badge">Original (100%)</span>
                    <i class="fa-solid fa-chevron-down drawer-chevron"></i>
                  </div>
                </summary>
                <div class="drawer-content">
                  <!-- Schnellskalierungs-Multiplikatoren -->
                  <div class="param-group">
                    <div class="param-label" style="font-size: 11px; color: var(--text-muted);">Schnellskalierung:</div>
                    <div class="quick-scale-bar">
                      <button type="button" class="quick-scale-btn" onclick="applyQuickScale(0.25)">0.25x</button>
                      <button type="button" class="quick-scale-btn" onclick="applyQuickScale(0.5)">0.5x</button>
                      <button type="button" class="quick-scale-btn" onclick="applyQuickScale(0.75)">0.75x</button>
                      <button type="button" class="quick-scale-btn" onclick="applyQuickScale(1.0)">1.0x (100%)</button>
                      <button type="button" class="quick-scale-btn" onclick="applyQuickScale(1.5)">1.5x</button>
                      <button type="button" class="quick-scale-btn" onclick="applyQuickScale(2.0)">2.0x</button>
                      <button type="button" class="quick-scale-btn" onclick="applyQuickScale(4.0)">4.0x</button>
                    </div>
                  </div>

                  <!-- Exakte Pixel-Eingabe mit Schloss-Kopplung -->
                  <div class="param-group">
                    <div class="param-label" style="font-size: 11px; color: var(--text-muted);">Exakte Pixelmaße (Breite × Höhe):</div>
                    <div class="dim-input-group">
                      <input type="number" id="img-scale-w" class="input-control" style="width: 130px; font-family: var(--font-mono);" placeholder="Breite (px)" min="1" max="16000" oninput="onWidthInputChange()">
                      <span style="color: var(--text-dim); font-weight: 700;">×</span>
                      <input type="number" id="img-scale-h" class="input-control" style="width: 130px; font-family: var(--font-mono);" placeholder="Höhe (px)" min="1" max="16000" oninput="onHeightInputChange()">
                      
                      <button type="button" class="dim-lock-btn locked" id="btn-aspect-lock" onclick="toggleAspectLock()" title="Seitenverhältnis proportional sperren">
                        <i class="fa-solid fa-lock" id="aspect-lock-icon"></i>
                        <span id="aspect-lock-text">Gesperrt</span>
                      </button>
                      
                      <button type="button" class="btn-secondary" onclick="resetDimensions()" title="Auf Originalgröße zurücksetzen">
                        <i class="fa-solid fa-rotate-left"></i> Original
                      </button>
                    </div>
                  </div>

                  <!-- Filter & Einpassung -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                      <div class="param-label" style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">Resampling-Filter (Interpolation):</div>
                      <select class="select-control" id="img-filter-select">
                        <option value="high" selected>Glatt (Bicubic / Lanczos) – Höchste Qualität</option>
                        <option value="medium">Standard (Bilinear) – Schnell</option>
                        <option value="nearest">Pixel-Art / Scharf (Nearest-Neighbor)</option>
                      </select>
                    </div>
                    <div>
                      <div class="param-label" style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">Einpassungs-Modus (Fit):</div>
                      <select class="select-control" id="img-fit-select">
                        <option value="contain" selected>Proportional einpassen (Contain)</option>
                        <option value="cover">Zuschneiden &amp; Füllen (Cover)</option>
                        <option value="stretch">Exakt strecken (Stretch)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </details>

              <!-- Collapsible Section 2: 🎚️ Qualität & Komprimierung (EINGEKLAPPT für sauberen Look!) -->
              <details class="advanced-drawer" id="drawer-quality">
                <summary>
                  <div class="drawer-summary-left">
                    <i class="fa-solid fa-sliders" style="color: var(--accent);"></i>
                    <span>Erweiterte Qualität &amp; Komprimierung (optional)</span>
                  </div>
                  <div class="drawer-summary-right">
                    <span class="drawer-badge" id="quality-summary-badge">Web-Standard (80%)</span>
                    <i class="fa-solid fa-chevron-down drawer-chevron"></i>
                  </div>
                </summary>
                <div class="drawer-content" id="img-quality-card">
                  <div class="param-label" style="margin-bottom: 4px;">
                    <span>Kompressions-Qualität</span>
                    <span id="img-quality-badge" style="font-family: var(--font-mono); font-size: 13px; color: var(--accent); font-weight: 700;">80%</span>
                  </div>

                  <div class="param-group">
                    <input type="range" class="slider-control" id="img-quality-slider" min="1" max="100" value="80" oninput="onQualitySliderChange(this.value)">
                  </div>

                  <!-- Presets -->
                  <div class="param-group">
                    <div class="preset-pill-bar">
                      <button type="button" class="preset-pill-btn" id="qp-60" onclick="applyQualityPreset(60)">Kompakt (60%)</button>
                      <button type="button" class="preset-pill-btn active" id="qp-80" onclick="applyQualityPreset(80)">Web-Standard (80%)</button>
                      <button type="button" class="preset-pill-btn" id="qp-92" onclick="applyQualityPreset(92)">Hohe Qualität (92%)</button>
                      <button type="button" class="preset-pill-btn" id="qp-100" onclick="applyQualityPreset(100)">Maximal (100%)</button>
                    </div>
                  </div>

                  <div style="margin-top: 6px; padding-top: 10px; border-top: 1px solid var(--border);">
                    <label class="check-btn" style="cursor: pointer;">
                      <input type="checkbox" id="img-opt-compress" checked>
                      <span><strong>Intelligente Web-Komprimierung</strong> (entfernt unbenötigte Metadaten/EXIF und optimiert Farbtabellen)</span>
                    </label>
                  </div>
                </div>
              </details>

              <!-- Konvertierungs-Button (Groß, klar & prominent!) -->
              <button class="btn-primary" id="btn-convert-img" onclick="executeImageConvert()" disabled style="padding: 14px; font-size: 15px;">
                <i class="fa-solid fa-rocket"></i>
                <span>Bild jetzt konvertieren &amp; skalieren</span>
              </button>
            </div>

            <!-- RESULT CARD -->
            <div class="card" id="img-result-card" style="display: none; border-color: rgba(16, 185, 129, 0.4);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <i class="fa-solid fa-circle-check" style="font-size: 18px; color: var(--success);"></i>
                  <span style="font-weight: 700; color: var(--success); font-size: 15px;">Erfolgreich konvertiert!</span>
                </div>
                <div id="res-savings-badge" class="savings-badge positive"></div>
              </div>

              <div style="display: grid; grid-template-columns: 240px 1fr; gap: 20px; align-items: center;">
                <div style="text-align: center;">
                  <img id="img-result-preview" src="" style="max-width: 100%; max-height: 200px; object-fit: contain; border-radius: var(--radius-sm); border: 1px solid var(--border); background: repeating-conic-gradient(#1e293b 0% 25%, transparent 0% 50%) 50% / 16px 16px;" />
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="result-stat-box">
                      <span class="result-stat-label"><i class="fa-solid fa-file"></i> Original</span>
                      <span class="result-stat-val" id="res-orig-stat">-</span>
                    </div>
                    <div class="result-stat-box">
                      <span class="result-stat-label"><i class="fa-solid fa-file-export"></i> Ergebnis (<span id="res-out-fmt">WEBP</span>)</span>
                      <span class="result-stat-val" id="res-out-stat" style="color: var(--accent);">-</span>
                    </div>
                  </div>
                  <div style="font-size: 12px; color: var(--text-dim);">
                    Verarbeitungsdauer: <strong id="res-duration" style="color: var(--text-muted);">-</strong>
                  </div>
                  <div style="display: flex; gap: 10px; margin-top: 6px;">
                    <button class="btn-primary" id="btn-download-result" onclick="downloadConvertedImage()" style="flex: 1;">
                      <i class="fa-solid fa-download"></i>
                      <span>Herunterladen</span>
                    </button>
                    <button class="btn-secondary" onclick="saveResultToWorkspace()">
                      <i class="fa-solid fa-folder-plus"></i>
                      <span>Im Projekt speichern</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- SUBTAB 2: Photoshop PSD zu TOAD DSL -->
          <div id="convert-view-psd" style="display: none; flex-direction: column; gap: 18px;">
            <div class="section-title">
              <span><i class="fa-solid fa-layer-group" style="color: var(--cyan);"></i> Photoshop PSD in TOAD DSL konvertieren (toad convert)</span>
            </div>

            <div class="dropzone" id="psd-dropzone" onclick="document.getElementById('psd-file-input').click()">
              <input type="file" id="psd-file-input" style="display: none;" accept=".psd" onchange="handlePsdFile(this.files[0])">
              <i class="fa-solid fa-file-invoice dropzone-icon" style="color: var(--cyan);"></i>
              <div style="font-size: 15px; font-weight: 700; color: var(--text);">Photoshop .psd Datei hier ablegen</div>
              <div style="font-size: 12px; color: var(--text-dim); margin-top: 2px;">Konvertiert Ebenen, Stile, Texte und Vektoren in nativen TOAD-Code</div>
            </div>

            <div class="card" id="psd-options-card">
              <!-- Collapsible PSD Options Drawer -->
              <details class="advanced-drawer" style="margin-bottom: 16px;" open>
                <summary>
                  <div class="drawer-summary-left">
                    <i class="fa-solid fa-sliders"></i>
                    <span>Konvertierungs-Optionen &amp; DPI</span>
                  </div>
                  <i class="fa-solid fa-chevron-down drawer-chevron"></i>
                </summary>
                <div class="drawer-content">
                  <div class="param-group">
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                      <label class="check-btn"><input type="checkbox" id="psd-opt-assets" checked> Raster-Ebenen als PNG-Bilder extrahieren</label>
                      <label class="check-btn"><input type="checkbox" id="psd-opt-hidden"> Ausgeblendete Photoshop-Ebenen einbeziehen</label>
                      <label class="check-btn"><input type="checkbox" id="psd-opt-format" checked> Generierten TOAD-Code automatisch formatieren</label>
                    </div>
                  </div>

                  <div class="param-group" style="margin-bottom: 0;">
                    <div class="param-label">Auflösung (DPI) für Schriftgrößen-Umrechnung</div>
                    <select class="select-control" id="psd-dpi">
                      <option value="72" selected>72 DPI (Standard Web)</option>
                      <option value="150">150 DPI</option>
                      <option value="300">300 DPI (Druck)</option>
                    </select>
                  </div>
                </div>
              </details>

              <button class="btn-primary" id="btn-convert-psd" onclick="executePsdConvert()" disabled>
                <i class="fa-solid fa-arrows-rotate"></i>
                <span>PSD in TOAD konvertieren</span>
              </button>
            </div>

            <div class="card" id="psd-result-card" style="display: none; border-color: rgba(16, 185, 129, 0.4);">
              <div style="font-weight: 700; color: var(--success); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-circle-check"></i> PSD erfolgreich konvertiert!
              </div>
              <div id="psd-result-path" style="font-family: var(--font-mono); font-size: 12px; color: var(--cyan); margin-bottom: 12px;"></div>
              <div id="psd-result-stats" style="font-size: 12px; color: var(--text-muted); line-height: 1.6; margin-bottom: 16px;"></div>
              <button class="btn-primary" onclick="openConvertedInGraphic()">
                <i class="fa-solid fa-arrow-right"></i>
                <span>Direkt in Grafik &amp; Build öffnen</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      <!-- Tab 5: Qualitäts-Audit (toad report / audit) -->
      <div class="tab-view" id="tab-report">
        <div class="audit-container">
          <div class="section-title">
            <span><i class="fa-solid fa-shield-halved" style="color: var(--accent);"></i> Design-Qualitäts- &amp; Anti-Slop Audit (toad report)</span>
            <button class="btn-secondary" onclick="runAuditForActiveFile()">
              <i class="fa-solid fa-rotate-right"></i> Audit aktualisieren
            </button>
          </div>

          <!-- Hero Score Card -->
          <div class="hero-score-card">
            <div>
              <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--text-dim); letter-spacing: 0.08em;">Gesamt-Audit Score</div>
              <div style="font-size: 14px; color: var(--text-muted); margin-top: 4px;" id="audit-file-label">-</div>
            </div>
            <div style="display: flex; align-items: baseline; gap: 10px;">
              <div class="hero-score-num high" id="audit-score-num">--%</div>
              <div style="font-size: 20px; font-weight: 700; color: var(--text-muted);" id="audit-grade">--</div>
            </div>
            <button class="btn-primary" style="width: auto; padding: 10px 18px;" onclick="applyAuditFixes()">
              <i class="fa-solid fa-wand-magic-sparkles"></i>
              <span>Automatische Korrekturen anwenden (--fixes)</span>
            </button>
          </div>

          <!-- 5 Dimension Cards -->
          <div class="dimension-grid">
            <div class="dim-card">
              <span class="dim-card-title"><i class="fa-solid fa-table-cells-large"></i> Layout &amp; Whitespace</span>
              <span class="dim-card-score" id="dim-layout" style="color: var(--accent);">--%</span>
            </div>
            <div class="dim-card">
              <span class="dim-card-title"><i class="fa-solid fa-font"></i> Typografie</span>
              <span class="dim-card-score" id="dim-typo" style="color: var(--accent);">--%</span>
            </div>
            <div class="dim-card">
              <span class="dim-card-title"><i class="fa-solid fa-circle-half-stroke"></i> Kontrast (WCAG 2.2)</span>
              <span class="dim-card-score" id="dim-contrast" style="color: var(--accent);">--%</span>
            </div>
            <div class="dim-card">
              <span class="dim-card-title"><i class="fa-solid fa-shield-halved"></i> Anti-AI-Slop</span>
              <span class="dim-card-score" id="dim-slop" style="color: var(--accent);">--%</span>
            </div>
            <div class="dim-card">
              <span class="dim-card-title"><i class="fa-solid fa-draw-polygon"></i> Vektoren &amp; Geometrie</span>
              <span class="dim-card-score" id="dim-vector" style="color: var(--accent);">--%</span>
            </div>
          </div>

          <!-- Detailed Issues List with Category Filters -->
          <div class="section-title">
            <span><i class="fa-solid fa-list-check"></i> Detaillierte Befunde &amp; Heuristiken</span>
          </div>

          <div class="audit-filter-bar">
            <button type="button" class="audit-filter-chip active" id="flt-all" onclick="filterAuditIssues('all')">
              Alle (<span id="cnt-all">0</span>)
            </button>
            <button type="button" class="audit-filter-chip" id="flt-error" onclick="filterAuditIssues('error')">
              <i class="fa-solid fa-circle-xmark" style="color: var(--error);"></i> Kritisch (<span id="cnt-error">0</span>)
            </button>
            <button type="button" class="audit-filter-chip" id="flt-warn" onclick="filterAuditIssues('warn')">
              <i class="fa-solid fa-triangle-exclamation" style="color: var(--warning);"></i> Warnungen (<span id="cnt-warn">0</span>)
            </button>
            <button type="button" class="audit-filter-chip" id="flt-info" onclick="filterAuditIssues('info')">
              <i class="fa-solid fa-circle-info" style="color: var(--cyan);"></i> Hinweise (<span id="cnt-info">0</span>)
            </button>
          </div>

          <div class="issues-list" id="audit-issues-list">
            <div style="font-size: 13px; color: var(--text-dim); text-align: center; padding: 20px;">Keine Befunde geladen.</div>
          </div>
        </div>
      </div>

    </main>
  </div>

  <!-- Modal: toad init -->
  <div class="modal-backdrop" id="modal-init">
    <div class="modal">
      <div class="modal-title">
        <i class="fa-solid fa-circle-plus" style="color: var(--accent);"></i>
        <span>Neues TOAD-Projekt anlegen (toad init)</span>
      </div>
      <div class="param-group">
        <div class="param-label">Projekt-Name</div>
        <input type="text" class="input-control" id="init-name" placeholder="mein-plakat">
      </div>
      <div class="param-group">
        <div class="param-label">Vorlage</div>
        <select class="select-control" id="init-template">
          <option value="poster" selected>Poster / Plakat (1080x1350)</option>
          <option value="social">Social Media Banner (1200x630)</option>
          <option value="motion">Motion Animation (.toadm)</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal('modal-init')">Abbrechen</button>
        <button class="btn-primary" style="width: auto;" onclick="submitInit()">
          <i class="fa-solid fa-check"></i> Projekt erstellen
        </button>
      </div>
    </div>
  </div>

  <!-- Modal: toad bundle -->
  <div class="modal-backdrop" id="modal-bundle">
    <div class="modal">
      <div class="modal-title">
        <i class="fa-solid fa-box-archive" style="color: var(--cyan);"></i>
        <span>Asset Bundle packen (toad bundle)</span>
      </div>
      <div class="param-group">
        <div class="param-label">Bundle Preset</div>
        <select class="select-control" id="bundle-preset">
          <option value="favicons" selected>Favicons (16x16 bis 512x512)</option>
          <option value="app-icon">App Icons (iOS, Android, macOS)</option>
          <option value="social">Social Media Paket</option>
          <option value="all">Komplettes All-in-One Bundle</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal('modal-bundle')">Abbrechen</button>
        <button class="btn-primary" style="width: auto;" onclick="submitBundle()">
          <i class="fa-solid fa-box-archive"></i> Bundle erstellen
        </button>
      </div>
    </div>
  </div>

  <!-- Modal: toad workspace -->
  <div class="modal-backdrop" id="modal-workspaces">
    <div class="modal">
      <div class="modal-title">
        <i class="fa-solid fa-layer-group" style="color: var(--violet);"></i>
        <span>Workspaces verwalten (toad workspace)</span>
      </div>
      <div id="workspaces-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto;"></div>
      <div class="param-group" style="margin-top: 10px;">
        <div class="param-label">Neuen Workspace-Ordner hinzufügen</div>
        <div style="display: flex; gap: 6px;">
          <input type="text" class="input-control" id="ws-add-input" placeholder="C:\\MeinProjekt">
          <button class="btn-secondary" onclick="submitAddWorkspace()">
            <i class="fa-solid fa-plus"></i> Hinzufügen
          </button>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal('modal-workspaces')">Schließen</button>
      </div>
    </div>
  </div>

  <script>
    // State
    let allFiles = [];
    let selectedFilePath = '${defaultFile.replace(/\\/g, '\\\\')}';
    let selectedScale = 1;
    let bgrQueue = [];
    let selectedPsdFile = null;
    let activeConvertedPath = null;

    // Image Converter State
    let selectedImgFile = null;
    let selectedImgDataUrl = null;
    let selectedImgOriginalWidth = 0;
    let selectedImgOriginalHeight = 0;
    let isAspectLocked = true;
    let selectedConvertFormat = 'webp';
    let convertedResult = null;

    // Split Slider Dragging State
    let isDraggingSplit = false;

    // Toast Notification
    var toastTimeout = null;
    function showToast(msg, type) {
      var toast = document.getElementById('studio-toast');
      var icon = document.getElementById('studio-toast-icon');
      var text = document.getElementById('studio-toast-msg');
      if (!toast || !text) return;

      text.textContent = msg;
      if (type === 'error') {
        icon.className = 'fa-solid fa-triangle-exclamation';
        icon.style.color = 'var(--rose)';
        toast.style.borderColor = 'rgba(244, 63, 94, 0.5)';
      } else {
        icon.className = 'fa-solid fa-circle-check';
        icon.style.color = 'var(--accent)';
        toast.style.borderColor = 'rgba(16, 185, 129, 0.5)';
      }

      toast.classList.add('show');
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(function() {
        toast.classList.remove('show');
      }, 4000);
    }

    // Command Builder Hub & Wizard State
    var currentWizard = null;
    var currentStep = 1;
    var wizardData = {
      bgr: {
        sourcePath: './bilder',
        sourceName: 'Ordner: ./bilder',
        preset: 'standard',
        format: 'png',
        targetDir: './freigestellt'
      },
      build: {
        file: '',
        format: 'png',
        scale: '2'
      },
      motion: {
        file: '',
        format: 'mp4',
        fps: '60'
      },
      convert: {
        file: '',
        format: 'webp',
        quality: '80'
      },
      report: {
        file: '',
        mode: 'fixes'
      }
    };

    var wizardConfig = {
      bgr: {
        title: 'Freistellen',
        badge: 'toad remove-bg',
        totalSteps: 5,
        stepNames: ['1. Motiv', '2. Modus', '3. Format', '4. Zielordner', '5. Ausführen']
      },
      build: {
        title: 'Grafik & Build',
        badge: 'toad build',
        totalSteps: 4,
        stepNames: ['1. Design', '2. Format', '3. Skalierung', '4. Ausführen']
      },
      motion: {
        title: 'Animation',
        badge: 'toad motion',
        totalSteps: 4,
        stepNames: ['1. Motion-Datei', '2. Video-Format', '3. Framerate', '4. Ausführen']
      },
      convert: {
        title: 'Konvertieren',
        badge: 'toad convert',
        totalSteps: 4,
        stepNames: ['1. Quellbild', '2. Zielformat', '3. Qualität', '4. Ausführen']
      },
      report: {
        title: 'Qualitäts-Audit',
        badge: 'toad report',
        totalSteps: 3,
        stepNames: ['1. Design', '2. Prüfungs-Tiefe', '3. Ausführen']
      }
    };

    function openWizard(type) {
      currentWizard = type;
      currentStep = 1;

      if (type === 'build' && !wizardData.build.file) {
        var firstToad = allFiles.find(function(f) { return f.path.endsWith('.toad'); });
        if (firstToad) wizardData.build.file = firstToad.path;
      }
      if (type === 'motion' && !wizardData.motion.file) {
        var firstToadm = allFiles.find(function(f) { return f.path.endsWith('.toadm'); });
        if (firstToadm) wizardData.motion.file = firstToadm.path;
      }
      if (type === 'report' && !wizardData.report.file) {
        var firstToad = allFiles.find(function(f) { return f.path.endsWith('.toad'); });
        if (firstToad) wizardData.report.file = firstToad.path;
      }

      document.getElementById('hub-main-menu').style.display = 'none';
      var deck = document.getElementById('hub-wizard-deck');
      deck.style.display = 'flex';

      var cfg = wizardConfig[type];
      document.getElementById('wizard-title-badge').textContent = cfg.badge;
      document.getElementById('wizard-header-title').textContent = cfg.title;

      renderWizardStep();
    }

    function toPosix(p) {
      if (!p) return '';
      return p.split('\\\\').join('/');
    }

    function closeWizard() {
      currentWizard = null;
      var deck = document.getElementById('hub-wizard-deck');
      if (deck) deck.style.display = 'none';
      var menu = document.getElementById('hub-main-menu');
      if (menu) menu.style.display = 'flex';
    }

    function nextWizardStep() {
      var cfg = wizardConfig[currentWizard];
      if (currentStep < cfg.totalSteps) {
        currentStep++;
        renderWizardStep();
      }
    }

    function prevWizardStep() {
      if (currentStep > 1) {
        currentStep--;
        renderWizardStep();
      }
    }

    function getGeneratedCommand(type) {
      if (type === 'bgr') {
        var d = wizardData.bgr;
        var src = toPosix(d.sourcePath || './bilder');
        var tgt = toPosix(d.targetDir || './freigestellt');
        var flag = d.preset === 'dyb' ? ' --dyb' : (d.preset === 'fast' ? ' --fast' : '');
        return 'toad remove-bg "' + src + '" "' + tgt + '"' + flag + ' -f ' + d.format;
      }
      if (type === 'build') {
        var d = wizardData.build;
        var f = toPosix(d.file || (allFiles.find(function(x) { return x.path.endsWith('.toad'); }) || {}).path || 'design.toad');
        return 'toad build "' + f + '" -f ' + d.format + ' -s ' + d.scale;
      }
      if (type === 'motion') {
        var d = wizardData.motion;
        var f = toPosix(d.file || (allFiles.find(function(x) { return x.path.endsWith('.toadm'); }) || {}).path || 'animation.toadm');
        return 'toad motion "' + f + '" -f ' + d.format + ' --fps ' + d.fps;
      }
      if (type === 'convert') {
        var d = wizardData.convert;
        var f = toPosix(d.file || 'bild.png');
        return 'toad convert "' + f + '" -f ' + d.format + ' -q ' + d.quality;
      }
      if (type === 'report') {
        var d = wizardData.report;
        var f = toPosix(d.file || (allFiles.find(function(x) { return x.path.endsWith('.toad'); }) || {}).path || 'design.toad');
        if (d.mode === 'fixes') return 'toad report "' + f + '" --fixes';
        if (d.mode === 'slop') return 'toad report "' + f + '" --slop-only';
        if (d.mode === 'strict') return 'toad report "' + f + '" --strict';
        return 'toad report "' + f + '"';
      }
      return '';
    }

    async function runWizardInCmd() {
      var cmd = getGeneratedCommand(currentWizard);
      if (!cmd) return;

      var btn = document.getElementById('btn-wizard-run-cmd');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Starte Terminal...</span>';
      }

      try {
        var res = await fetch('/api/run-cmd', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd })
        });
        var data = await res.json();
        if (data.success) {
          showToast(data.reused 
            ? 'Befehl im aktiven CMD-Terminal gestartet!' 
            : 'Neues CMD-Terminal geöffnet und Befehl gestartet!', 'success');
        } else {
          showToast('Fehler beim Ausführen: ' + (data.error || 'Unbekannt'), 'error');
        }
      } catch (err) {
        showToast('Verbindungsfehler: ' + err.message, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-terminal"></i> <span>Jetzt im CMD ausführen</span>';
        }
      }
    }

    async function copyWizardCmd() {
      var cmd = getGeneratedCommand(currentWizard);
      if (!cmd) return;
      try {
        await navigator.clipboard.writeText(cmd);
        showToast('Befehl in die Zwischenablage kopiert!', 'success');
      } catch (e) {
        var ta = document.createElement('textarea');
        ta.value = cmd;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Befehl in die Zwischenablage kopiert!', 'success');
      }
    }

    function openWizardInStudio() {
      var wiz = currentWizard;
      if (wiz === 'bgr') {
        switchTab('bg-remover');
        setBgrFormat(wizardData.bgr.format);
        var radio = document.querySelector('input[name="bgr-preset"][value="' + wizardData.bgr.preset + '"]');
        if (radio) {
          radio.checked = true;
          updateBgrPreset();
        }
        var dirEl = document.getElementById('bgr-out-dir');
        if (dirEl) dirEl.value = wizardData.bgr.targetDir;
      } else if (wiz === 'build') {
        switchTab('graphic');
        if (wizardData.build.file) selectFile(wizardData.build.file);
      } else if (wiz === 'motion') {
        switchTab('animation');
        if (wizardData.motion.file) selectFile(wizardData.motion.file);
      } else if (wiz === 'convert') {
        switchTab('convert');
        selectConvertFormat(wizardData.convert.format);
      } else if (wiz === 'report') {
        switchTab('report');
        if (wizardData.report.file) {
          selectFile(wizardData.report.file);
          runAuditForActiveFile();
        }
      }
    }

    function renderWizardStep() {
      var cfg = wizardConfig[currentWizard];
      var indicators = document.getElementById('wizard-step-indicators');
      indicators.innerHTML = cfg.stepNames.map(function(name, idx) {
        var stepNum = idx + 1;
        var cls = 'wizard-step-badge';
        if (stepNum === currentStep) cls += ' active';
        else if (stepNum < currentStep) cls += ' completed';
        return '<span class="' + cls + '">' + name + '</span>';
      }).join('');

      var body = document.getElementById('wizard-card-body');

      // Final Step: Render Generated Terminal Command Box
      if (currentStep === cfg.totalSteps) {
        var cmd = getGeneratedCommand(currentWizard);
        body.innerHTML = 
          '<div class="wizard-step-header">' +
            '<div class="wizard-step-title"><i class="fa-solid fa-circle-check" style="color: var(--accent); margin-right: 8px;"></i> Dein Terminal-Befehl ist bereit!</div>' +
            '<div class="wizard-step-subtitle">Führe den Befehl direkt im interaktiven CMD-Terminal aus oder kopiere ihn mit einem Klick.</div>' +
          '</div>' +

          '<div class="terminal-cmd-box" id="wiz-cmd-box">' +
            '<span class="terminal-cmd-prompt">C:\\&gt;</span><span>' + cmd + '</span>' +
          '</div>' +

          '<div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 10px;">' +
            '<button type="button" class="btn-run-cmd" id="btn-wizard-run-cmd" onclick="runWizardInCmd()">' +
              '<i class="fa-solid fa-terminal"></i>' +
              '<span>Jetzt im CMD ausführen</span>' +
            '</button>' +
            '<button type="button" class="btn-secondary" style="padding: 12px 20px; font-size: 14px;" onclick="copyWizardCmd()">' +
              '<i class="fa-solid fa-copy"></i>' +
              '<span>Befehl kopieren</span>' +
            '</button>' +
            '<button type="button" class="btn-secondary" style="padding: 12px 20px; font-size: 14px;" onclick="openWizardInStudio()">' +
              '<i class="fa-solid fa-arrow-up-right-from-square"></i>' +
              '<span>Im Web-GUI öffnen</span>' +
            '</button>' +
          '</div>' +

          '<div class="wizard-footer-nav">' +
            '<button type="button" class="btn-secondary" onclick="prevWizardStep()">' +
              '<i class="fa-solid fa-chevron-left"></i> Zurück' +
            '</button>' +
            '<button type="button" class="btn-secondary" onclick="closeWizard()">' +
              '<i class="fa-solid fa-rotate-left"></i> Zum Hauptmenü' +
            '</button>' +
          '</div>';
        return;
      }

      // Steps for BGR
      if (currentWizard === 'bgr') {
        if (currentStep === 1) {
          body.innerHTML = 
            '<div class="wizard-step-header">' +
              '<div class="wizard-step-title">Was möchtest du freistellen?</div>' +
              '<div class="wizard-step-subtitle">Ziehe einzelne Bilder, eine Bilderserie oder einen ganzen Ordner hinein – oder wähle sie per Dialog oder Pfad aus.</div>' +
            '</div>' +

            '<div class="dropzone" id="wiz-bgr-dropzone" style="padding: 24px;" onclick="triggerWizBgrFileInput()">' +
              '<input type="file" id="wiz-bgr-file-input" style="display:none;" accept="image/*" multiple onchange="onWizBgrFiles(this.files)">' +
              '<input type="file" id="wiz-bgr-folder-input" style="display:none;" webkitdirectory mozdirectory directory multiple onchange="onWizBgrFolder(this.files)">' +
              '<i class="fa-solid fa-cloud-arrow-up dropzone-icon" style="font-size: 32px;"></i>' +
              '<div style="font-size: 14px; font-weight: 700; color: var(--text); margin-top: 6px;">Bilder oder Ordner hier ablegen</div>' +
              '<div style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">Unterstützt PNG, JPG, WebP, AVIF, TIFF</div>' +
              '<div style="display: flex; gap: 8px; margin-top: 12px;" onclick="event.stopPropagation()">' +
                '<button type="button" class="btn-secondary" onclick="triggerWizBgrFileInput()">' +
                  '<i class="fa-solid fa-images"></i> Einzelne Bilder wählen' +
                '</button>' +
                '<button type="button" class="btn-secondary" onclick="triggerWizBgrFolderInput()">' +
                  '<i class="fa-solid fa-folder-open"></i> Ganzen Ordner wählen' +
                '</button>' +
              '</div>' +
            '</div>' +

            '<div style="display: flex; flex-direction: column; gap: 6px;">' +
              '<div class="param-label" style="font-size: 11px; color: var(--text-muted);">Ausgewählter Pfad / Quelle:</div>' +
              '<input type="text" class="input-control" id="wiz-bgr-path" value="' + wizardData.bgr.sourcePath + '" oninput="wizardData.bgr.sourcePath = this.value" placeholder="./bilder oder C:\\\\Fotos">' +
              '<div id="wiz-bgr-hint" style="font-size: 11px; color: var(--accent); font-weight: 600;">' +
                '<i class="fa-solid fa-check"></i> ' + wizardData.bgr.sourceName +
              '</div>' +
            '</div>' +

            '<div class="wizard-footer-nav">' +
              '<div></div>' +
              '<button type="button" class="btn-primary" style="width: auto; padding: 10px 24px;" onclick="nextWizardStep()">' +
                'Weiter <i class="fa-solid fa-chevron-right"></i>' +
              '</button>' +
            '</div>';

          setupWizDropzone('wiz-bgr-dropzone', function(name, isDir) {
            wizardData.bgr.sourcePath = name;
            wizardData.bgr.sourceName = (isDir ? 'Ordner: ' : 'Datei: ') + name;
            var p = document.getElementById('wiz-bgr-path');
            if (p) p.value = name;
            var h = document.getElementById('wiz-bgr-hint');
            if (h) h.innerHTML = '<i class="fa-solid fa-check"></i> ' + wizardData.bgr.sourceName;
          });
          return;
        }

        if (currentStep === 2) {
          body.innerHTML = 
            '<div class="wizard-step-header">' +
              '<div class="wizard-step-title">In welchem Modus möchtest du freistellen?</div>' +
              '<div class="wizard-step-subtitle">Wähle die passende KI-Präzision für deine Motive.</div>' +
            '</div>' +
            '<div class="wizard-tiles-grid">' +
              '<div class="wizard-tile ' + (wizardData.bgr.preset === 'fast' ? 'active' : '') + '" data-val="fast" onclick="selectWizPreset(this.dataset.val)">' +
                '<div class="wizard-tile-header">' +
                  '<i class="fa-solid fa-bolt wizard-tile-icon" style="color: var(--amber);"></i>' +
                  '<span class="wizard-tile-title">Schnell</span>' +
                '</div>' +
                '<div class="wizard-tile-desc">BiRefNet Lite (MIT). Hohe Geschwindigkeit, optimal für schnelle Previews und Layouts.</div>' +
                '<span style="font-size: 10px; font-family: var(--font-mono); color: var(--cyan); margin-top: auto;">--fast</span>' +
              '</div>' +

              '<div class="wizard-tile ' + (wizardData.bgr.preset === 'standard' ? 'active' : '') + '" data-val="standard" onclick="selectWizPreset(this.dataset.val)">' +
                '<div class="wizard-tile-header">' +
                  '<i class="fa-solid fa-crosshairs wizard-tile-icon" style="color: var(--accent);"></i>' +
                  '<span class="wizard-tile-title">Standard</span>' +
                '</div>' +
                '<div class="wizard-tile-desc">BiRefNet High-Res. Ausgewogene Randschärfe für fast alle Produkt- & Porträtmotive.</div>' +
                '<span style="font-size: 10px; font-family: var(--font-mono); color: var(--accent); margin-top: auto;">Standard</span>' +
              '</div>' +

              '<div class="wizard-tile ' + (wizardData.bgr.preset === 'dyb' ? 'active' : '') + '" data-val="dyb" onclick="selectWizPreset(this.dataset.val)">' +
                '<div class="wizard-tile-header">' +
                  '<i class="fa-solid fa-gem wizard-tile-icon" style="color: var(--violet);"></i>' +
                  '<span class="wizard-tile-title">Höchste Präzision</span>' +
                '</div>' +
                '<div class="wizard-tile-desc">Multi-Modell Ensemble + Guided Matting. Höchste Detailtreue für feine Haare &amp; Texturen.</div>' +
                '<span style="font-size: 10px; font-family: var(--font-mono); color: var(--violet); margin-top: auto;">--dyb</span>' +
              '</div>' +
            '</div>' +

            '<div class="wizard-footer-nav">' +
              '<button type="button" class="btn-secondary" onclick="prevWizardStep()">' +
                '<i class="fa-solid fa-chevron-left"></i> Zurück' +
              '</button>' +
              '<button type="button" class="btn-primary" style="width: auto; padding: 10px 24px;" onclick="nextWizardStep()">' +
                'Weiter <i class="fa-solid fa-chevron-right"></i>' +
              '</button>' +
            '</div>';
          return;
        }

        if (currentStep === 3) {
          body.innerHTML = 
            '<div class="wizard-step-header">' +
              '<div class="wizard-step-title">In welchem Format sollen die fertigen Bilder gespeichert werden?</div>' +
              '<div class="wizard-step-subtitle">Beide Formate unterstützen vollständige Alpha-Transparenz.</div>' +
            '</div>' +
            '<div class="wizard-tiles-grid" style="grid-template-columns: 1fr 1fr;">' +
              '<div class="wizard-tile ' + (wizardData.bgr.format === 'png' ? 'active' : '') + '" data-val="png" onclick="selectWizFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header">' +
                  '<i class="fa-solid fa-file-image wizard-tile-icon" style="color: var(--accent);"></i>' +
                  '<span class="wizard-tile-title">PNG (Verlustfrei)</span>' +
                '</div>' +
                '<div class="wizard-tile-desc">Verlustfreie 8-Bit Alpha-Transparenz. Maximale Qualität für Print, Layouts &amp; Weiterbearbeitung.</div>' +
              '</div>' +

              '<div class="wizard-tile ' + (wizardData.bgr.format === 'webp' ? 'active' : '') + '" data-val="webp" onclick="selectWizFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header">' +
                  '<i class="fa-solid fa-globe wizard-tile-icon" style="color: var(--cyan);"></i>' +
                  '<span class="wizard-tile-title">WebP (Kompakt)</span>' +
                '</div>' +
                '<div class="wizard-tile-desc">Moderne Web-Kompression mit Transparenz. Bis zu 70% kleinere Dateigröße für Webseiten.</div>' +
              '</div>' +
            '</div>' +

            '<div class="wizard-footer-nav">' +
              '<button type="button" class="btn-secondary" onclick="prevWizardStep()">' +
                '<i class="fa-solid fa-chevron-left"></i> Zurück' +
              '</button>' +
              '<button type="button" class="btn-primary" style="width: auto; padding: 10px 24px;" onclick="nextWizardStep()">' +
                'Weiter <i class="fa-solid fa-chevron-right"></i>' +
              '</button>' +
            '</div>';
          return;
        }

        if (currentStep === 4) {
          body.innerHTML = 
            '<div class="wizard-step-header">' +
              '<div class="wizard-step-title">Wo sollen die fertigen Bilder landen?</div>' +
              '<div class="wizard-step-subtitle">Gib das gewünschte Zielverzeichnis an. Fehlende Ordner werden automatisch erstellt.</div>' +
            '</div>' +
            '<div style="display: flex; flex-direction: column; gap: 10px;">' +
              '<input type="text" class="input-control" id="wiz-bgr-target" value="' + wizardData.bgr.targetDir + '" oninput="wizardData.bgr.targetDir = this.value" placeholder="./freigestellt">' +
              '<div style="display: flex; gap: 8px;">' +
                '<button type="button" class="btn-secondary" style="font-size: 11px; padding: 5px 10px;" data-val="./freigestellt" onclick="setWizTargetDir(this.dataset.val)">./freigestellt</button>' +
                '<button type="button" class="btn-secondary" style="font-size: 11px; padding: 5px 10px;" data-val="./output" onclick="setWizTargetDir(this.dataset.val)">./output</button>' +
                '<button type="button" class="btn-secondary" style="font-size: 11px; padding: 5px 10px;" data-val="./cutouts" onclick="setWizTargetDir(this.dataset.val)">./cutouts</button>' +
              '</div>' +
            '</div>' +

            '<div class="wizard-footer-nav">' +
              '<button type="button" class="btn-secondary" onclick="prevWizardStep()">' +
                '<i class="fa-solid fa-chevron-left"></i> Zurück' +
              '</button>' +
              '<button type="button" class="btn-primary" style="width: auto; padding: 10px 24px;" onclick="nextWizardStep()">' +
                'Befehl erstellen <i class="fa-solid fa-chevron-right"></i>' +
              '</button>' +
            '</div>';
          return;
        }
      }

      // Steps for Build
      if (currentWizard === 'build') {
        if (currentStep === 1) {
          body.innerHTML = 
            '<div class="wizard-step-header">' +
              '<div class="wizard-step-title">Welches Design möchtest du bauen?</div>' +
              '<div class="wizard-step-subtitle">Tippe den Namen oder Pfad der .toad Datei ein. Nutze Pfeiltasten oder Tab zur Autovervollständigung.</div>' +
            '</div>' +
            renderWizFileSearchControl('build', '.toad', 'design.toad') +
            '<div class="wizard-footer-nav">' +
              '<div></div>' +
              '<button type="button" class="btn-primary" style="width: auto; padding: 10px 24px;" onclick="nextWizardStep()">' +
                'Weiter <i class="fa-solid fa-chevron-right"></i>' +
              '</button>' +
            '</div>';
          attachWizFileSearch('build', '.toad');
          return;
        }
        if (currentStep === 2) {
          body.innerHTML = 
            '<div class="wizard-step-header">' +
              '<div class="wizard-step-title">Welche Ausgabe-Formate möchtest du generieren?</div>' +
              '<div class="wizard-step-subtitle">TOAD kann Rastergrafiken, Vektoren und native Photoshop-Dateien ausgeben.</div>' +
            '</div>' +
            '<div class="wizard-tiles-grid">' +
              '<div class="wizard-tile ' + (wizardData.build.format === 'png' ? 'active' : '') + '" data-val="png" onclick="selectWizBuildFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-file-image wizard-tile-icon"></i><span class="wizard-tile-title">PNG</span></div>' +
                '<div class="wizard-tile-desc">Standard-Grafikformat mit Transparenz.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.build.format === 'webp' ? 'active' : '') + '" data-val="webp" onclick="selectWizBuildFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-globe wizard-tile-icon" style="color: var(--cyan);"></i><span class="wizard-tile-title">WebP</span></div>' +
                '<div class="wizard-tile-desc">Hochkomprimiert für Webseiten.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.build.format === 'jpg' ? 'active' : '') + '" data-val="jpg" onclick="selectWizBuildFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-camera wizard-tile-icon" style="color: var(--amber);"></i><span class="wizard-tile-title">JPEG</span></div>' +
                '<div class="wizard-tile-desc">Ideal für Fotocollagen ohne Alpha.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.build.format === 'psd' ? 'active' : '') + '" data-val="psd" onclick="selectWizBuildFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-layer-group wizard-tile-icon" style="color: var(--violet);"></i><span class="wizard-tile-title">PSD (Photoshop)</span></div>' +
                '<div class="wizard-tile-desc">Mit echten bearbeitbaren Ebenen.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.build.format === 'all' ? 'active' : '') + '" data-val="all" onclick="selectWizBuildFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-boxes-stacked wizard-tile-icon" style="color: var(--rose);"></i><span class="wizard-tile-title">Alle Formate</span></div>' +
                '<div class="wizard-tile-desc">PNG, WebP, JPEG und PSD synchron.</div>' +
              '</div>' +
            '</div>' +
            '<div class="wizard-footer-nav">' +
              '<button type="button" class="btn-secondary" onclick="prevWizardStep()"><i class="fa-solid fa-chevron-left"></i> Zurück</button>' +
              '<button type="button" class="btn-primary" style="width: auto; padding: 10px 24px;" onclick="nextWizardStep()">Weiter <i class="fa-solid fa-chevron-right"></i></button>' +
            '</div>';
          return;
        }
        if (currentStep === 3) {
          body.innerHTML = 
            '<div class="wizard-step-header">' +
              '<div class="wizard-step-title">In welcher Skalierung / Auflösung?</div>' +
              '<div class="wizard-step-subtitle">Skaliere verlustfrei mit sub-pixelgenauer Vektorberechnung.</div>' +
            '</div>' +
            '<div class="wizard-tiles-grid" style="grid-template-columns: repeat(3, 1fr);">' +
              '<div class="wizard-tile ' + (wizardData.build.scale === '1' ? 'active' : '') + '" data-val="1" onclick="selectWizBuildScale(this.dataset.val)">' +
                '<div class="wizard-tile-header"><span class="wizard-tile-title">1x (Original)</span></div>' +
                '<div class="wizard-tile-desc">Standard 72 DPI für Bildschirmdarstellung.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.build.scale === '2' ? 'active' : '') + '" data-val="2" onclick="selectWizBuildScale(this.dataset.val)">' +
                '<div class="wizard-tile-header"><span class="wizard-tile-title">2x (Retina)</span></div>' +
                '<div class="wizard-tile-desc">Doppelte Auflösung für hochauflösende Displays.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.build.scale === '4' ? 'active' : '') + '" data-val="4" onclick="selectWizBuildScale(this.dataset.val)">' +
                '<div class="wizard-tile-header"><span class="wizard-tile-title">4x (Ultra HD / Print)</span></div>' +
                '<div class="wizard-tile-desc">Vierfache Auflösung (300 DPI) für Posterdruck.</div>' +
              '</div>' +
            '</div>' +
            '<div class="wizard-footer-nav">' +
              '<button type="button" class="btn-secondary" onclick="prevWizardStep()"><i class="fa-solid fa-chevron-left"></i> Zurück</button>' +
              '<button type="button" class="btn-primary" style="width: auto; padding: 10px 24px;" onclick="nextWizardStep()">Befehl erstellen <i class="fa-solid fa-chevron-right"></i></button>' +
            '</div>';
          return;
        }
      }

      // Steps for Motion
      if (currentWizard === 'motion') {
        if (currentStep === 1) {
          body.innerHTML = 
            '<div class="wizard-step-header">' +
              '<div class="wizard-step-title">Welche Motion-Datei möchtest du rendern?</div>' +
              '<div class="wizard-step-subtitle">Tippe den Namen oder Pfad der .toadm Datei ein. Nutze Pfeiltasten oder Tab zur Autovervollständigung.</div>' +
            '</div>' +
            renderWizFileSearchControl('motion', '.toadm', 'animation.toadm') +
            '<div class="wizard-footer-nav">' +
              '<div></div>' +
              '<button type="button" class="btn-primary" style="width: auto; padding: 10px 24px;" onclick="nextWizardStep()">Weiter <i class="fa-solid fa-chevron-right"></i></button>' +
            '</div>';
          attachWizFileSearch('motion', '.toadm');
          return;
        }
        if (currentStep === 2) {
          body.innerHTML = 
            '<div class="wizard-step-header">' +
              '<div class="wizard-step-title">In welchem Video-Format soll exportiert werden?</div>' +
              '<div class="wizard-step-subtitle">Wähle das Format für deinen Einsatzzweck.</div>' +
            '</div>' +
            '<div class="wizard-tiles-grid">' +
              '<div class="wizard-tile ' + (wizardData.motion.format === 'mp4' ? 'active' : '') + '" data-val="mp4" onclick="selectWizMotionFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-video wizard-tile-icon"></i><span class="wizard-tile-title">MP4 (H.264)</span></div>' +
                '<div class="wizard-tile-desc">Universell kompatibel für alle Plattformen und Player.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.motion.format === 'webm' ? 'active' : '') + '" data-val="webm" onclick="selectWizMotionFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-film wizard-tile-icon" style="color: var(--cyan);"></i><span class="wizard-tile-title">WebM (VP9)</span></div>' +
                '<div class="wizard-tile-desc">Schlank für Web-Integration mit Alpha-Kanal.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.motion.format === 'gif' ? 'active' : '') + '" data-val="gif" onclick="selectWizMotionFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-play wizard-tile-icon" style="color: var(--amber);"></i><span class="wizard-tile-title">GIF (Animiert)</span></div>' +
                '<div class="wizard-tile-desc">Perfekt für Messenger, GitHub Readmes und Social.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.motion.format === 'frames' ? 'active' : '') + '" data-val="frames" onclick="selectWizMotionFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-images wizard-tile-icon" style="color: var(--violet);"></i><span class="wizard-tile-title">Frames (PNG)</span></div>' +
                '<div class="wizard-tile-desc">Exportiert jedes Frame als einzelnes PNG.</div>' +
              '</div>' +
            '</div>' +
            '<div class="wizard-footer-nav">' +
              '<button type="button" class="btn-secondary" onclick="prevWizardStep()"><i class="fa-solid fa-chevron-left"></i> Zurück</button>' +
              '<button type="button" class="btn-primary" style="width: auto; padding: 10px 24px;" onclick="nextWizardStep()">Weiter <i class="fa-solid fa-chevron-right"></i></button>' +
            '</div>';
          return;
        }
        if (currentStep === 3) {
          body.innerHTML = 
            '<div class="wizard-step-header">' +
              '<div class="wizard-step-title">Mit wie vielen Bildern pro Sekunde (FPS)?</div>' +
              '<div class="wizard-step-subtitle">Höhere Frameraten erzeugen ultra-flüssige Bewegungen.</div>' +
            '</div>' +
            '<div class="wizard-tiles-grid" style="grid-template-columns: repeat(3, 1fr);">' +
              '<div class="wizard-tile ' + (wizardData.motion.fps === '30' ? 'active' : '') + '" data-val="30" onclick="selectWizMotionFps(this.dataset.val)">' +
                '<div class="wizard-tile-header"><span class="wizard-tile-title">30 FPS</span></div>' +
                '<div class="wizard-tile-desc">Standard-Webanimation, kleine Dateigröße.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.motion.fps === '60' ? 'active' : '') + '" data-val="60" onclick="selectWizMotionFps(this.dataset.val)">' +
                '<div class="wizard-tile-header"><span class="wizard-tile-title">60 FPS (Flüssig)</span></div>' +
                '<div class="wizard-tile-desc">Empfohlen für moderne Displays und UI-Showcases.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.motion.fps === '120' ? 'active' : '') + '" data-val="120" onclick="selectWizMotionFps(this.dataset.val)">' +
                '<div class="wizard-tile-header"><span class="wizard-tile-title">120 FPS (Ultra Smooth)</span></div>' +
                '<div class="wizard-tile-desc">Höchste Geschmeidigkeit für ProMotion / Gaming-Panels.</div>' +
              '</div>' +
            '</div>' +
            '<div class="wizard-footer-nav">' +
              '<button type="button" class="btn-secondary" onclick="prevWizardStep()"><i class="fa-solid fa-chevron-left"></i> Zurück</button>' +
              '<button type="button" class="btn-primary" style="width: auto; padding: 10px 24px;" onclick="nextWizardStep()">Befehl erstellen <i class="fa-solid fa-chevron-right"></i></button>' +
            '</div>';
          return;
        }
      }

      // Steps for Convert
      if (currentWizard === 'convert') {
        if (currentStep === 1) {
          body.innerHTML = 
            '<div class="wizard-step-header">' +
              '<div class="wizard-step-title">Was möchtest du konvertieren?</div>' +
              '<div class="wizard-step-subtitle">Ziehe ein Bild oder eine Photoshop PSD-Datei hinein oder wähle sie aus.</div>' +
            '</div>' +
            '<div class="dropzone" id="wiz-convert-dropzone" style="padding: 24px;" onclick="triggerWizConvertInput()">' +
              '<input type="file" id="wiz-convert-input" style="display:none;" accept="image/*,.psd,.svg,.pdf,.ico,.avif" onchange="onWizConvertFile(this.files[0])">' +
              '<i class="fa-solid fa-cloud-arrow-up dropzone-icon" style="font-size: 32px;"></i>' +
              '<div style="font-size: 14px; font-weight: 700; color: var(--text); margin-top: 6px;">Bild oder PSD hier ablegen</div>' +
              '<div style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">WebP, JPG, PNG, AVIF, SVG, PSD, PDF, ICO</div>' +
              '<div style="margin-top: 12px;" onclick="event.stopPropagation()">' +
                '<button type="button" class="btn-secondary" onclick="triggerWizConvertInput()">' +
                  '<i class="fa-solid fa-file"></i> Datei auswählen' +
                '</button>' +
              '</div>' +
            '</div>' +
            '<div style="display: flex; flex-direction: column; gap: 6px;">' +
              '<div class="param-label" style="font-size: 11px; color: var(--text-muted);">Quell-Datei:</div>' +
              '<input type="text" class="input-control" id="wiz-convert-file" value="' + wizardData.convert.file + '" oninput="wizardData.convert.file = this.value" placeholder="bild.png oder layout.psd">' +
            '</div>' +
            '<div class="wizard-footer-nav">' +
              '<div></div>' +
              '<button type="button" class="btn-primary" style="width: auto; padding: 10px 24px;" onclick="nextWizardStep()">Weiter <i class="fa-solid fa-chevron-right"></i></button>' +
            '</div>';
          setupWizDropzone('wiz-convert-dropzone', function(name) {
            wizardData.convert.file = name;
            var el = document.getElementById('wiz-convert-file');
            if (el) el.value = name;
          });
          return;
        }
        if (currentStep === 2) {
          body.innerHTML = 
            '<div class="wizard-step-header">' +
              '<div class="wizard-step-title">In welches Zielformat konvertieren?</div>' +
              '<div class="wizard-step-subtitle">Wähle das gewünschte Format.</div>' +
            '</div>' +
            '<div class="wizard-tiles-grid">' +
              '<div class="wizard-tile ' + (wizardData.convert.format === 'webp' ? 'active' : '') + '" data-val="webp" onclick="selectWizConvertFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-bolt wizard-tile-icon" style="color: var(--accent);"></i><span class="wizard-tile-title">WebP</span></div>' +
                '<div class="wizard-tile-desc">Moderne Web-Kompression, bis zu 70% kleiner.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.convert.format === 'png' ? 'active' : '') + '" data-val="png" onclick="selectWizConvertFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-file-image wizard-tile-icon"></i><span class="wizard-tile-title">PNG</span></div>' +
                '<div class="wizard-tile-desc">Verlustfrei mit 8-Bit Alpha-Transparenz.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.convert.format === 'jpg' ? 'active' : '') + '" data-val="jpg" onclick="selectWizConvertFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-camera wizard-tile-icon" style="color: var(--amber);"></i><span class="wizard-tile-title">JPEG</span></div>' +
                '<div class="wizard-tile-desc">Universell für Web &amp; Fotoanzeige.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.convert.format === 'avif' ? 'active' : '') + '" data-val="avif" onclick="selectWizConvertFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-sparkles wizard-tile-icon" style="color: var(--cyan);"></i><span class="wizard-tile-title">AVIF</span></div>' +
                '<div class="wizard-tile-desc">Next-Gen Ultra-Kompression für maximale Performance.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.convert.format === 'svg' ? 'active' : '') + '" data-val="svg" onclick="selectWizConvertFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-bezier-curve wizard-tile-icon" style="color: var(--violet);"></i><span class="wizard-tile-title">SVG</span></div>' +
                '<div class="wizard-tile-desc">Skalierbare Vektorgrafik.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.convert.format === 'ico' ? 'active' : '') + '" data-val="ico" onclick="selectWizConvertFormat(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-icons wizard-tile-icon"></i><span class="wizard-tile-title">Favicon (ICO)</span></div>' +
                '<div class="wizard-tile-desc">Website-Icon in 16x16 bis 256x256.</div>' +
              '</div>' +
            '</div>' +
            '<div class="wizard-footer-nav">' +
              '<button type="button" class="btn-secondary" onclick="prevWizardStep()"><i class="fa-solid fa-chevron-left"></i> Zurück</button>' +
              '<button type="button" class="btn-primary" style="width: auto; padding: 10px 24px;" onclick="nextWizardStep()">Weiter <i class="fa-solid fa-chevron-right"></i></button>' +
            '</div>';
          return;
        }
        if (currentStep === 3) {
          body.innerHTML = 
            '<div class="wizard-step-header">' +
              '<div class="wizard-step-title">Welche Qualität &amp; Komprimierung?</div>' +
              '<div class="wizard-step-subtitle">Wähle die Balance zwischen Dateigröße und Schärfe.</div>' +
            '</div>' +
            '<div class="wizard-tiles-grid" style="grid-template-columns: repeat(2, 1fr);">' +
              '<div class="wizard-tile ' + (wizardData.convert.quality === '80' ? 'active' : '') + '" data-val="80" onclick="selectWizConvertQuality(this.dataset.val)">' +
                '<div class="wizard-tile-header"><span class="wizard-tile-title">Web-Standard (80%)</span></div>' +
                '<div class="wizard-tile-desc">Ausgezeichnete Balance für fast alle Einsätze.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.convert.quality === '92' ? 'active' : '') + '" data-val="92" onclick="selectWizConvertQuality(this.dataset.val)">' +
                '<div class="wizard-tile-header"><span class="wizard-tile-title">Hohe Qualität (92%)</span></div>' +
                '<div class="wizard-tile-desc">Kaum sichtbare Kompression für Portfolios.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.convert.quality === '60' ? 'active' : '') + '" data-val="60" onclick="selectWizConvertQuality(this.dataset.val)">' +
                '<div class="wizard-tile-header"><span class="wizard-tile-title">Kompakt (60%)</span></div>' +
                '<div class="wizard-tile-desc">Minimale Dateigröße für schnelles Laden.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.convert.quality === '100' ? 'active' : '') + '" data-val="100" onclick="selectWizConvertQuality(this.dataset.val)">' +
                '<div class="wizard-tile-header"><span class="wizard-tile-title">Maximal (100%)</span></div>' +
                '<div class="wizard-tile-desc">Verlustfrei ohne Qualitätsabstriche.</div>' +
              '</div>' +
            '</div>' +
            '<div class="wizard-footer-nav">' +
              '<button type="button" class="btn-secondary" onclick="prevWizardStep()"><i class="fa-solid fa-chevron-left"></i> Zurück</button>' +
              '<button type="button" class="btn-primary" style="width: auto; padding: 10px 24px;" onclick="nextWizardStep()">Befehl erstellen <i class="fa-solid fa-chevron-right"></i></button>' +
            '</div>';
          return;
        }
      }

      // Steps for Report
      if (currentWizard === 'report') {
        if (currentStep === 1) {
          body.innerHTML = 
            '<div class="wizard-step-header">' +
              '<div class="wizard-step-title">Welches Design soll analysiert werden?</div>' +
              '<div class="wizard-step-subtitle">Tippe den Namen oder Pfad der .toad Datei ein. Nutze Pfeiltasten oder Tab zur Autovervollständigung.</div>' +
            '</div>' +
            renderWizFileSearchControl('report', '.toad', 'design.toad') +
            '<div class="wizard-footer-nav">' +
              '<div></div>' +
              '<button type="button" class="btn-primary" style="width: auto; padding: 10px 24px;" onclick="nextWizardStep()">Weiter <i class="fa-solid fa-chevron-right"></i></button>' +
            '</div>';
          attachWizFileSearch('report', '.toad');
          return;
        }
        if (currentStep === 2) {
          body.innerHTML = 
            '<div class="wizard-step-header">' +
              '<div class="wizard-step-title">Welche Audit-Prüfungen durchführen?</div>' +
              '<div class="wizard-step-subtitle">Wähle die gewünschte Analysetiefe.</div>' +
            '</div>' +
            '<div class="wizard-tiles-grid" style="grid-template-columns: repeat(2, 1fr);">' +
              '<div class="wizard-tile ' + (wizardData.report.mode === 'fixes' ? 'active' : '') + '" data-val="fixes" onclick="selectWizReportMode(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-wrench wizard-tile-icon" style="color: var(--accent);"></i><span class="wizard-tile-title">Mit Auto-Fixes (--fixes)</span></div>' +
                '<div class="wizard-tile-desc">Zeigt direkte Lösungsvorschläge und Korrekturen für jeden Befund.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.report.mode === 'standard' ? 'active' : '') + '" data-val="standard" onclick="selectWizReportMode(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-chart-simple wizard-tile-icon" style="color: var(--cyan);"></i><span class="wizard-tile-title">Standard-Audit</span></div>' +
                '<div class="wizard-tile-desc">Vollständiger Gesamtbericht über WCAG, Typo und Layout.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.report.mode === 'slop' ? 'active' : '') + '" data-val="slop" onclick="selectWizReportMode(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-shield-halved wizard-tile-icon" style="color: var(--amber);"></i><span class="wizard-tile-title">Anti-AI-Slop Only (--slop-only)</span></div>' +
                '<div class="wizard-tile-desc">Fokus ausschließlich auf generische KI-Slop-Muster und Kitsch.</div>' +
              '</div>' +
              '<div class="wizard-tile ' + (wizardData.report.mode === 'strict' ? 'active' : '') + '" data-val="strict" onclick="selectWizReportMode(this.dataset.val)">' +
                '<div class="wizard-tile-header"><i class="fa-solid fa-triangle-exclamation wizard-tile-icon" style="color: var(--rose);"></i><span class="wizard-tile-title">Strenge Prüfung (--strict)</span></div>' +
                '<div class="wizard-tile-desc">Bricht mit Fehlercode ab, falls auch nur eine Warnung existiert.</div>' +
              '</div>' +
            '</div>' +
            '<div class="wizard-footer-nav">' +
              '<button type="button" class="btn-secondary" onclick="prevWizardStep()"><i class="fa-solid fa-chevron-left"></i> Zurück</button>' +
              '<button type="button" class="btn-primary" style="width: auto; padding: 10px 24px;" onclick="nextWizardStep()">Befehl erstellen <i class="fa-solid fa-chevron-right"></i></button>' +
            '</div>';
          return;
        }
      }
    }

    // Helper functions for tile selections
    function selectWizPreset(p) { wizardData.bgr.preset = p; renderWizardStep(); }
    function selectWizFormat(f) { wizardData.bgr.format = f; renderWizardStep(); }
    function setWizTargetDir(d) { wizardData.bgr.targetDir = d; renderWizardStep(); }
    function selectWizBuildFormat(f) { wizardData.build.format = f; renderWizardStep(); }
    function selectWizBuildScale(s) { wizardData.build.scale = s; renderWizardStep(); }
    function selectWizMotionFormat(f) { wizardData.motion.format = f; renderWizardStep(); }
    function selectWizMotionFps(f) { wizardData.motion.fps = f; renderWizardStep(); }
    function selectWizConvertFormat(f) { wizardData.convert.format = f; renderWizardStep(); }
    function selectWizConvertQuality(q) { wizardData.convert.quality = q; renderWizardStep(); }
    function selectWizReportMode(m) { wizardData.report.mode = m; renderWizardStep(); }

    function onWizBgrFiles(files) {
      if (!files || files.length === 0) return;
      if (files.length === 1) {
        wizardData.bgr.sourcePath = files[0].name;
        wizardData.bgr.sourceName = 'Datei: ' + files[0].name;
      } else {
        wizardData.bgr.sourcePath = files[0].name;
        wizardData.bgr.sourceName = files.length + ' Dateien ausgewählt';
      }
      renderWizardStep();
    }

    function onWizBgrFolder(files) {
      if (!files || files.length === 0) return;
      var dirName = './bilder';
      if (files[0] && files[0].webkitRelativePath) {
        dirName = files[0].webkitRelativePath.split('/')[0];
      }
      wizardData.bgr.sourcePath = dirName;
      wizardData.bgr.sourceName = 'Ordner: ' + dirName + ' (' + files.length + ' Bilder)';
      renderWizardStep();
    }

    function onWizConvertFile(file) {
      if (!file) return;
      wizardData.convert.file = file.name;
      renderWizardStep();
    }

    function triggerWizBgrFileInput() {
      var el = document.getElementById('wiz-bgr-file-input');
      if (el) el.click();
    }
    function triggerWizBgrFolderInput() {
      var el = document.getElementById('wiz-bgr-folder-input');
      if (el) el.click();
    }
    function triggerWizConvertInput() {
      var el = document.getElementById('wiz-convert-input');
      if (el) el.click();
    }

    function renderWizFileSearchControl(wizKey, ext, placeholder) {
      var currentVal = wizardData[wizKey].file || '';
      return '' +
        '<div class="wiz-search-wrap" id="wiz-search-wrap-' + wizKey + '">' +
          '<div class="wiz-search-input-box" id="wiz-box-' + wizKey + '">' +
            '<i class="fa-solid fa-file-code wiz-search-icon"></i>' +
            '<div class="wiz-search-ghost" id="wiz-ghost-' + wizKey + '"></div>' +
            '<input type="text" class="wiz-search-input" id="wiz-file-input-' + wizKey + '" ' +
              'value="' + currentVal + '" autocomplete="off" spellcheck="false" ' +
              'placeholder="' + placeholder + '">' +
          '</div>' +
          '<div class="wiz-search-hints">' +
            '<span><kbd>Tab</kbd> oder <kbd>→</kbd> übernimmt Ghost-Text / Vorschlag &bull; <kbd>Enter</kbd> Weiter</span>' +
            '<span><kbd>↑</kbd> <kbd>↓</kbd> Menü &bull; <kbd>Esc</kbd> Schließen</span>' +
          '</div>' +
          '<div class="wiz-suggestions-menu" id="wiz-suggestions-' + wizKey + '"></div>' +
        '</div>';
    }

    function attachWizFileSearch(wizKey, ext) {
      setTimeout(function() {
        var input = document.getElementById('wiz-file-input-' + wizKey);
        var ghost = document.getElementById('wiz-ghost-' + wizKey);
        var menu = document.getElementById('wiz-suggestions-' + wizKey);
        if (!input || !menu) return;

        var activeIdx = -1;
        var currentItems = [];

        function getMatchingFiles() {
          return allFiles.filter(function(f) { 
            return f.path && f.path.toLowerCase().endsWith(ext.toLowerCase()); 
          });
        }

        function updateInlineGhost(typed, topCandidate) {
          if (!ghost) return;
          if (!typed || !topCandidate) {
            ghost.textContent = '';
            return;
          }
          // Check if top candidate name or path starts with typed
          var candText = topCandidate.name;
          if (candText.toLowerCase().startsWith(typed.toLowerCase())) {
            ghost.textContent = typed + candText.slice(typed.length);
            return;
          }
          var candPath = topCandidate.path;
          if (candPath.toLowerCase().startsWith(typed.toLowerCase())) {
            ghost.textContent = typed + candPath.slice(typed.length);
            return;
          }
          // If contains, show full suggestion in ghost or empty
          ghost.textContent = '';
        }

        function renderSuggestions(query) {
          var matchingFiles = getMatchingFiles();
          var rawQuery = query || '';
          var q = rawQuery.toLowerCase().trim();

          currentItems = matchingFiles.filter(function(f) {
            if (!q) return true;
            return f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q);
          });

          // Sort exact/prefix matches first
          currentItems.sort(function(a, b) {
            var aPrefix = a.name.toLowerCase().startsWith(q) || a.path.toLowerCase().startsWith(q);
            var bPrefix = b.name.toLowerCase().startsWith(q) || b.path.toLowerCase().startsWith(q);
            if (aPrefix && !bPrefix) return -1;
            if (!aPrefix && bPrefix) return 1;
            return a.name.localeCompare(b.name);
          });

          // Update inline ghost text with top candidate
          var topMatch = currentItems.length > 0 ? currentItems[0] : null;
          updateInlineGhost(rawQuery, topMatch);

          if (currentItems.length === 0) {
            menu.innerHTML = '<div style="padding: 12px 14px; font-size: 12px; color: var(--text-dim); text-align: center;"><i class="fa-solid fa-magnifying-glass" style="margin-right: 6px;"></i> Keine Datei gefunden für "' + rawQuery + '"</div>';
            menu.classList.add('open');
            activeIdx = -1;
            return;
          }

          var html = currentItems.slice(0, 15).map(function(f, idx) {
            var isSel = (f.path === wizardData[wizKey].file);
            return '<div class="wiz-suggestion-item ' + (isSel ? 'active' : '') + '" data-idx="' + idx + '" data-path="' + f.path + '">' +
              '<div class="wiz-suggestion-name">' +
                '<i class="fa-solid fa-file-lines" style="color: var(--accent); font-size: 11px;"></i> ' +
                highlightMatches(f.name, q) +
              '</div>' +
              '<div class="wiz-suggestion-path">' + highlightMatches(f.path, q) + '</div>' +
            '</div>';
          }).join('');

          menu.innerHTML = html;
          menu.classList.add('open');
          activeIdx = -1;

          // Click listeners
          var itemEls = menu.querySelectorAll('.wiz-suggestion-item');
          itemEls.forEach(function(el) {
            el.addEventListener('mousedown', function(e) {
              e.preventDefault();
              var p = el.getAttribute('data-path');
              if (p) selectItem(p);
            });
          });
        }

        function highlightMatches(text, query) {
          if (!query) return text;
          var idx = text.toLowerCase().indexOf(query.toLowerCase());
          if (idx === -1) return text;
          var before = text.substring(0, idx);
          var match = text.substring(idx, idx + query.length);
          var after = text.substring(idx + query.length);
          return before + '<span style="color: var(--accent); font-weight: 800; text-decoration: underline;">' + match + '</span>' + after;
        }

        function selectItem(path) {
          wizardData[wizKey].file = path;
          input.value = path;
          if (ghost) ghost.textContent = '';
          menu.classList.remove('open');
        }

        function highlightItem(idx) {
          var itemEls = menu.querySelectorAll('.wiz-suggestion-item');
          itemEls.forEach(function(el, i) {
            if (i === idx) {
              el.classList.add('active');
              el.scrollIntoView({ block: 'nearest' });
              // Also update ghost text based on active item
              var p = el.getAttribute('data-path');
              if (p && input.value && p.toLowerCase().startsWith(input.value.toLowerCase())) {
                if (ghost) ghost.textContent = input.value + p.slice(input.value.length);
              }
            } else {
              el.classList.remove('active');
            }
          });
        }

        // Live input event: updates dynamically with every single character typed
        input.addEventListener('input', function() {
          wizardData[wizKey].file = input.value;
          renderSuggestions(input.value);
        });

        // Focus & Click: instantly open dropdown
        input.addEventListener('focus', function() {
          renderSuggestions(input.value);
        });

        input.addEventListener('click', function() {
          renderSuggestions(input.value);
        });

        // Close on blur with safe delay
        input.addEventListener('blur', function() {
          setTimeout(function() {
            menu.classList.remove('open');
            if (ghost) ghost.textContent = '';
          }, 200);
        });

        // Keyboard control
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') {
            menu.classList.remove('open');
            if (ghost) ghost.textContent = '';
            return;
          }

          if (!menu.classList.contains('open') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            renderSuggestions(input.value);
            e.preventDefault();
            return;
          }

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            var itemEls = menu.querySelectorAll('.wiz-suggestion-item');
            if (itemEls.length > 0) {
              activeIdx = (activeIdx + 1) % itemEls.length;
              highlightItem(activeIdx);
            }
            return;
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault();
            var itemEls = menu.querySelectorAll('.wiz-suggestion-item');
            if (itemEls.length > 0) {
              activeIdx = (activeIdx - 1 + itemEls.length) % itemEls.length;
              highlightItem(activeIdx);
            }
            return;
          }

          // Tab or ArrowRight to accept inline ghost or active item
          if (e.key === 'Tab' || (e.key === 'ArrowRight' && input.selectionStart === input.value.length)) {
            if (ghost && ghost.textContent && ghost.textContent.length > input.value.length) {
              e.preventDefault();
              var completedText = ghost.textContent;
              // find matching item
              var match = currentItems.find(function(item) {
                return item.name.toLowerCase() === completedText.toLowerCase() || item.path.toLowerCase() === completedText.toLowerCase();
              });
              selectItem(match ? match.path : completedText);
              return;
            }

            if (menu.classList.contains('open') && currentItems.length > 0) {
              e.preventDefault();
              var targetIdx = activeIdx >= 0 ? activeIdx : 0;
              if (currentItems[targetIdx]) {
                selectItem(currentItems[targetIdx].path);
              }
              return;
            }
          }

          // Enter: accept selected item or go to next step
          if (e.key === 'Enter') {
            e.preventDefault();
            if (menu.classList.contains('open') && activeIdx >= 0 && currentItems[activeIdx]) {
              selectItem(currentItems[activeIdx].path);
            } else if (menu.classList.contains('open') && currentItems.length > 0 && (!input.value || input.value.trim() === '')) {
              selectItem(currentItems[0].path);
            } else {
              menu.classList.remove('open');
              nextWizardStep();
            }
          }
        });

        // Trigger immediate suggestions render if input is focused or initially opened
        if (document.activeElement === input || !input.value) {
          renderSuggestions(input.value);
        }
      }, 30);
    }

    function setupWizDropzone(id, callback) {
      setTimeout(function() {
        var dropzone = document.getElementById(id);
        if (!dropzone) return;
        ['dragenter', 'dragover'].forEach(function(name) {
          dropzone.addEventListener(name, function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
          });
        });
        ['dragleave', 'drop'].forEach(function(name) {
          dropzone.addEventListener(name, function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
          });
        });
        dropzone.addEventListener('drop', async function(e) {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('dragover');
          var items = e.dataTransfer.items;
          if (items && items.length > 0) {
            var entry = items[0].webkitGetAsEntry ? items[0].webkitGetAsEntry() : null;
            if (entry && entry.isDirectory) {
              callback(entry.name, true);
              return;
            }
          }
          var files = await extractFilesFromDataTransfer(e.dataTransfer);
          if (files.length > 0) {
            callback(files[0].name, false);
          }
        });
      }, 50);
    }

    // Initialization
    window.addEventListener('DOMContentLoaded', function() {
      loadFiles();
      setupSplitSlider();
      setupSse();
      updateCliPreview();
      setupImageConverterDragDrop();
      setupBgRemoverDragDrop();
      switchTab('hub');
    });

    // Tab Navigation
    function switchTab(tabId) {
      document.querySelectorAll('.tab-view').forEach(function(v) { v.classList.remove('active'); });

      var target = document.getElementById('tab-' + tabId);
      if (target) target.classList.add('active');

      var header = document.getElementById('studio-header');
      var sidebar = document.getElementById('global-sidebar');

      if (tabId === 'hub') {
        if (header) header.style.display = 'none';
        if (sidebar) sidebar.style.display = 'none';
        closeWizard();
      } else {
        if (header) header.style.display = 'flex';
        if (sidebar) {
          if (['graphic', 'animation', 'report'].indexOf(tabId) !== -1) {
            sidebar.style.display = 'flex';
          } else {
            sidebar.style.display = 'none';
          }
        }
      }

      if (tabId === 'report' && selectedFilePath) {
        runAuditForActiveFile();
      }
    }

    // Load & Render Grouped File Tree with FontAwesome Icons
    async function loadFiles() {
      try {
        const res = await fetch('/api/files');
        const data = await res.json();
        allFiles = data.files || [];
        renderFileTree(allFiles);

        if (!selectedFilePath && allFiles.length > 0) {
          selectFile(allFiles[0].path);
        } else if (selectedFilePath) {
          selectFile(selectedFilePath);
        }
      } catch (err) {
        console.error('Failed to load files:', err);
      }
    }

    function renderFileTree(files) {
      const container = document.getElementById('file-tree');
      if (files.length === 0) {
        container.innerHTML = '<div style="padding: 20px; font-size: 12px; color: var(--text-dim); text-align: center;">Keine .toad/.toadm Dateien gefunden.</div>';
        return;
      }

      // Group files by normalized directory
      const groups = {};
      files.forEach(f => {
        const norm = f.path.replace(/\\\\/g, '/');
        const lastSlash = norm.lastIndexOf('/');
        const dir = lastSlash > -1 ? norm.substring(0, lastSlash) : 'Projekt-Wurzel';
        if (!groups[dir]) groups[dir] = [];
        groups[dir].push(f);
      });

      let html = '';
      Object.keys(groups).sort().forEach(dir => {
        const dirFiles = groups[dir];
        const dirName = dir.split('/').pop() || dir;

        html += \`
          <div class="tree-folder" data-dir="\${dir}">
            <div class="folder-header" onclick="toggleFolder(this)">
              <i class="fa-solid fa-chevron-down folder-chevron"></i>
              <i class="fa-solid fa-folder folder-icon"></i>
              <span class="folder-name" title="\${dir}">\${dirName}</span>
              <span class="folder-badge">\${dirFiles.length}</span>
            </div>
            <div class="folder-children">
        \`;

        dirFiles.forEach(f => {
          const isToadm = f.path.toLowerCase().endsWith('.toadm');
          const badgeClass = isToadm ? 'toadm' : 'toad';
          const badgeText = isToadm ? '.toadm' : '.toad';
          const iconClass = isToadm ? 'fa-solid fa-file-video' : 'fa-solid fa-file-code';
          const isActive = f.path === selectedFilePath ? 'active' : '';

          html += \`
            <div class="tree-file \${isActive}" data-path="\${f.path}" onclick="selectFile('\${f.path.replace(/\\\\/g, '\\\\\\\\')}')">
              <span class="file-badge \${badgeClass}">\${badgeText}</span>
              <span class="file-title" title="\${f.name}">\${f.name}</span>
            </div>
          \`;
        });

        html += \`
            </div>
          </div>
        \`;
      });

      container.innerHTML = html;
    }

    function toggleFolder(header) {
      header.classList.toggle('collapsed');
      const folderIcon = header.querySelector('.folder-icon');
      if (folderIcon) {
        if (header.classList.contains('collapsed')) {
          folderIcon.className = 'fa-solid fa-folder folder-icon';
        } else {
          folderIcon.className = 'fa-solid fa-folder-open folder-icon';
        }
      }
    }

    function filterFiles() {
      const q = document.getElementById('file-filter').value.toLowerCase();
      if (!q) {
        renderFileTree(allFiles);
        return;
      }
      const filtered = allFiles.filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
      renderFileTree(filtered);
    }

    // Sidebar Toggle for Extra Real Estate
    let isSidebarOpen = true;
    function toggleSidebar() {
      isSidebarOpen = !isSidebarOpen;
      const sidebar = document.getElementById('global-sidebar');
      const btn = document.getElementById('btn-toggle-sidebar');
      if (sidebar) {
        sidebar.classList.toggle('collapsed', !isSidebarOpen);
      }
      if (btn) {
        btn.classList.toggle('active', isSidebarOpen);
      }
    }

    // Format Chips & 1-Click Profiles
    function onFormatChipChange(input) {
      const chip = input.closest('.format-chip');
      if (chip) chip.classList.toggle('active', input.checked);
      updateCliPreview();
    }

    function applyBuildPreset(preset) {
      document.querySelectorAll('.quick-preset-btn').forEach(b => b.classList.remove('active'));
      const activeBtn = document.getElementById('btn-preset-' + preset);
      if (activeBtn) activeBtn.classList.add('active');

      const formats = {
        web: ['webp', 'png'],
        print: ['pdf', 'jpg'],
        social: ['png', 'webp']
      };

      const selectedFmts = formats[preset] || ['png'];
      document.querySelectorAll('input[name="fmt"]').forEach(input => {
        input.checked = selectedFmts.includes(input.value);
        const chip = input.closest('.format-chip');
        if (chip) chip.classList.toggle('active', input.checked);
      });

      if (preset === 'web') {
        setScale(1);
        document.getElementById('dpi-select').value = '72';
        document.getElementById('quality-slider').value = '85';
        document.getElementById('quality-val').textContent = '85';
      } else if (preset === 'print') {
        setScale(2);
        document.getElementById('dpi-select').value = '300';
        document.getElementById('quality-slider').value = '98';
        document.getElementById('quality-val').textContent = '98';
      } else if (preset === 'social') {
        setScale(2);
        document.getElementById('dpi-select').value = '150';
        document.getElementById('quality-slider').value = '90';
        document.getElementById('quality-val').textContent = '90';
      }

      updateCliPreview();
    }

    function copyCliCommand() {
      const text = document.getElementById('cli-preview-text')?.textContent || '';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          alert('CLI-Befehl in die Zwischenablage kopiert!');
        }).catch(() => {
          prompt('Befehl kopieren:', text);
        });
      } else {
        prompt('Befehl kopieren:', text);
      }
    }

    // File Selection
    function selectFile(path) {
      selectedFilePath = path;

      document.querySelectorAll('.tree-file').forEach(el => {
        if (el.getAttribute('data-path') === path) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });

      const basename = path.split(/[/\\\\]/).pop();
      const isMotion = path.toLowerCase().endsWith('.toadm');

      // Update Graphic Deck
      const deckName = document.getElementById('deck-filename');
      if (deckName) deckName.textContent = basename;
      const statusDot = document.getElementById('deck-status-dot');
      if (statusDot) statusDot.classList.add('online');

      // Update Motion Deck
      const motionName = document.getElementById('motion-filename');
      if (motionName) motionName.textContent = basename;
      const motionDot = document.getElementById('motion-status-dot');
      if (motionDot) motionDot.classList.add('online');

      // Show canvas image, hide empty state
      const emptyState = document.getElementById('canvas-empty-state');
      if (emptyState) emptyState.style.display = 'none';
      const previewImg = document.getElementById('preview-img');
      if (previewImg) previewImg.style.display = 'block';

      // Update Preview Image
      refreshPreview();
      updateCliPreview();

      // If in report tab, trigger audit
      const activeTab = document.querySelector('.tab-view.active');
      if (activeTab && activeTab.id === 'tab-report') {
        runAuditForActiveFile();
      }
    }

    // Preview Image Management
    function refreshPreview() {
      if (!selectedFilePath) {
        const emptyState = document.getElementById('canvas-empty-state');
        if (emptyState) emptyState.style.display = 'flex';
        const previewImg = document.getElementById('preview-img');
        if (previewImg) previewImg.style.display = 'none';
        return;
      }
      const img = document.getElementById('preview-img');
      const badge = document.getElementById('preview-status-badge');
      if (badge) badge.textContent = 'Lädt...';

      const timestamp = Date.now();
      img.src = \`/image?path=\${encodeURIComponent(selectedFilePath)}&t=\${timestamp}\`;
      img.onload = () => {
        if (badge) badge.textContent = 'Aktuell';
        const dims = document.getElementById('deck-dimensions');
        const indicator = document.getElementById('preview-dim-indicator');
        if (img.naturalWidth) {
          const dimStr = \`\${img.naturalWidth} × \${img.naturalHeight} px\`;
          if (dims) dims.textContent = dimStr;
          if (indicator) indicator.textContent = dimStr;
        }
      };
      img.onerror = () => {
        if (badge) badge.textContent = 'Fehler';
      };
    }

    function setZoom(mode) {
      const img = document.getElementById('preview-img');
      document.querySelectorAll('#tab-graphic .preview-toolbar .segment-btn').forEach(b => b.classList.remove('active'));
      
      if (mode === 'fit') {
        document.getElementById('zoom-fit')?.classList.add('active');
        img.style.transform = 'none';
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
      } else {
        const btnId = mode === 1 ? 'zoom-100' : 'zoom-200';
        document.getElementById(btnId)?.classList.add('active');
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
        img.style.transform = \`scale(\${mode})\`;
      }
    }

    // Graphic Parameters & CLI Preview
    function setScale(s) {
      selectedScale = s;
      document.querySelectorAll('#scale-group .segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === s + 'x');
      });
      updateCliPreview();
    }

    function updateCliPreview() {
      if (!selectedFilePath) return;
      const basename = selectedFilePath.split(/[/\\\\]/).pop();

      const fmts = Array.from(document.querySelectorAll('input[name="fmt"]:checked')).map(cb => cb.value);
      const dpi = document.getElementById('dpi-select').value;
      const quality = document.getElementById('quality-slider').value;
      const bleed = document.getElementById('bleed-input').value;
      const marks = document.getElementById('opt-marks').checked;
      const cmyk = document.getElementById('opt-cmyk').checked;
      const dryRun = document.getElementById('opt-dryrun').checked;
      const outDir = document.getElementById('outdir-input').value;

      let cmd = \`toad build "\${basename}"\`;
      if (fmts.length > 0) cmd += \` --format \${fmts.join(',')}\`;
      if (selectedScale !== 1) cmd += \` --scale \${selectedScale}\`;
      if (dpi && dpi !== '72') cmd += \` --dpi \${dpi}\`;
      if (quality && quality !== '85') cmd += \` --quality \${quality}\`;
      if (bleed) cmd += \` --bleed \${bleed}\`;
      if (marks) cmd += ' --marks';
      if (cmyk) cmd += ' --cmyk';
      if (dryRun) cmd += ' --dry-run';
      if (outDir) cmd += \` --out "\${outDir}"\`;

      const box = document.getElementById('cli-preview-text');
      if (box) box.textContent = cmd;
      const snippet = document.getElementById('cli-summary-snippet');
      if (snippet) snippet.textContent = cmd.length > 35 ? cmd.substring(0, 32) + '...' : cmd;
    }

    // Execute Build
    async function executeBuild() {
      if (!selectedFilePath) return;
      const btn = document.getElementById('btn-run-build');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Kompiliere...</span>';

      const fmts = Array.from(document.querySelectorAll('input[name="fmt"]:checked')).map(cb => cb.value);
      const dpi = document.getElementById('dpi-select').value;
      const quality = document.getElementById('quality-slider').value;
      const bleed = document.getElementById('bleed-input').value;
      const marks = document.getElementById('opt-marks').checked;
      const cmyk = document.getElementById('opt-cmyk').checked;
      const dryRun = document.getElementById('opt-dryrun').checked;
      const outDir = document.getElementById('outdir-input').value;

      try {
        const res = await fetch('/api/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: selectedFilePath,
            formats: fmts,
            scale: selectedScale,
            dpi,
            quality,
            bleed,
            marks,
            cmyk,
            dryRun,
            outDir
          })
        });
        const data = await res.json();
        if (data.success) {
          btn.innerHTML = \`<i class="fa-solid fa-check"></i> <span>Fertig (\${data.durationMs}ms)</span>\`;
          refreshPreview();
        } else {
          alert('Build-Fehler: ' + (data.error || 'Unbekannt'));
          btn.innerHTML = '<i class="fa-solid fa-rocket"></i> <span>Build ausführen</span>';
        }
      } catch (err) {
        alert('Netzwerkfehler beim Build: ' + err.message);
        btn.innerHTML = '<i class="fa-solid fa-rocket"></i> <span>Build ausführen</span>';
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-rocket"></i> <span>Build ausführen</span>';
        }, 1200);
      }
    }

    // Open Active Folder in Windows Explorer
    async function openActiveFolder() {
      await fetch('/api/open-folder', { method: 'POST' });
    }

    // Motion Rendering
    let motionFmt = 'mp4';
    function setMotionFmt(fmt) {
      motionFmt = fmt;
      document.querySelectorAll('#motion-fmt-group .segment-btn').forEach(b => {
        b.classList.toggle('active', b.textContent.toLowerCase() === fmt);
      });
      updateMotionCliPreview();
    }

    function updateMotionCliPreview() {
      if (!selectedFilePath) return;
      const basename = selectedFilePath.split(/[/\\\\]/).pop();
      const fps = document.getElementById('motion-fps').value;
      const quality = document.getElementById('motion-crf').value;
      const scale = document.getElementById('motion-scale').value;

      const cmd = \`toad motion "\${basename}" -f \${motionFmt} --fps \${fps} -q \${quality} --scale \${scale}\`;
      const box = document.getElementById('motion-cli-preview');
      if (box) box.textContent = cmd;
    }

    async function renderMotion() {
      if (!selectedFilePath) return;
      const btn = document.getElementById('btn-render-motion');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Rendere Animation...</span>';

      const fps = document.getElementById('motion-fps').value;
      const quality = document.getElementById('motion-crf').value;
      const scale = document.getElementById('motion-scale').value;

      try {
        const res = await fetch('/api/motion/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: selectedFilePath,
            format: motionFmt,
            fps,
            quality,
            scale
          })
        });
        const data = await res.json();
        if (data.success) {
          btn.innerHTML = \`<i class="fa-solid fa-check"></i> <span>Fertig (\${data.durationMs}ms)</span>\`;
          alert('Motion-Datei erfolgreich gerendert:\\n' + data.outputFile);
        } else {
          alert('Render-Fehler: ' + (data.error || 'Unbekannt'));
          btn.innerHTML = '<i class="fa-solid fa-clapperboard"></i> <span>Animation rendern</span>';
        }
      } catch (err) {
        alert('Netzwerkfehler: ' + err.message);
        btn.innerHTML = '<i class="fa-solid fa-clapperboard"></i> <span>Animation rendern</span>';
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-clapperboard"></i> <span>Animation rendern</span>';
        }, 1500);
      }
    }

    // BG-Remover Queue & Progress
    let bgrPreset = 'standard';
    let bgrFormat = 'png';

    function updateBgrPreset() {
      const checked = document.querySelector('input[name="bgr-preset"]:checked');
      if (checked) bgrPreset = checked.value;
    }

    function setBgrFormat(fmt) {
      bgrFormat = fmt;
      document.getElementById('bgr-fmt-png').classList.toggle('active', fmt === 'png');
      document.getElementById('bgr-fmt-webp').classList.toggle('active', fmt === 'webp');
    }

    function onBgrDropzoneClick(event) {
      if (event && event.target && event.target.closest('button')) return;
      triggerBgrFilePicker(event);
    }

    function triggerBgrFilePicker(event) {
      if (event) {
        event.stopPropagation();
      }
      const input = document.getElementById('bgr-file-input');
      if (input) {
        input.value = '';
        input.click();
      }
    }

    async function triggerBgrFolderPicker(event) {
      if (event) {
        event.stopPropagation();
      }
      // Native File System Access API (opens native folder picker in Edge/Chrome)
      if (window.showDirectoryPicker) {
        try {
          const dirHandle = await window.showDirectoryPicker();
          const files = [];
          async function scanDir(handle) {
            for await (const entry of handle.values()) {
              if (entry.kind === 'file') {
                if (isImageFile(entry.name)) {
                  const file = await entry.getFile();
                  files.push(file);
                }
              } else if (entry.kind === 'directory') {
                await scanDir(entry);
              }
            }
          }
          await scanDir(dirHandle);
          if (files.length > 0) {
            handleBgFiles(files);
          } else {
            alert('Keine unterstützten Bilddateien (.png, .jpg, .webp) im gewählten Ordner gefunden.');
          }
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return; // User cancelled
          console.warn('showDirectoryPicker fallback:', err);
        }
      }

      // Standard fallback
      const input = document.getElementById('bgr-folder-input');
      if (input) {
        input.value = '';
        input.click();
      }
    }

    function handleBgFiles(files) {
      const validFiles = Array.from(files || []).filter(f => isImageFile(f.name));
      if (validFiles.length === 0) {
        if (files && files.length > 0) {
          alert('Keine unterstützten Bilddateien (.png, .jpg, .webp) gefunden.');
        }
        return;
      }

      validFiles.forEach(f => {
        const id = 'bgr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
        const item = {
          id,
          file: f,
          name: f.name,
          progress: 0,
          status: 'Warteschlange...',
          resultUrl: null
        };
        bgrQueue.push(item);
      });
      renderBgrQueue();
      processNextInBgrQueue();
    }

    function renderBgrQueue() {
      const container = document.getElementById('bgr-queue-list');
      if (bgrQueue.length === 0) {
        container.innerHTML = '<div style="font-size: 12px; color: var(--text-dim); text-align: center; padding: 12px;">Keine Bilder geladen.</div>';
        return;
      }

      container.innerHTML = bgrQueue.map(item => \`
        <div class="bgr-card" id="card-\${item.id}">
          <div class="bgr-card-header">
            <span class="bgr-card-title" title="\${item.name}"><i class="fa-solid fa-image" style="color: var(--cyan); margin-right: 6px;"></i>\${item.name}</span>
            <span style="font-size: 10px; font-family: var(--font-mono); color: var(--text-dim);" id="pct-\${item.id}">\${item.progress}%</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" id="bar-\${item.id}" style="width: \${item.progress}%"></div>
          </div>
          <div class="progress-status" style="align-items: center;">
            <span id="status-\${item.id}">\${item.status}</span>
            <div style="display: flex; gap: 4px; align-items: center;">
              \${item.resultUrl ? \`<button class="btn-secondary" style="padding: 2px 8px; font-size: 10px;" onclick="loadBgrComparison('\${item.id}')"><i class="fa-solid fa-arrows-left-right"></i> Vergleichen</button>\` : ''}
              \${item.savedPath ? \`<button class="btn-secondary" style="padding: 2px 8px; font-size: 10px;" title="Gespeichert: \${item.savedPath}" onclick="openBgrTargetFolder()"><i class="fa-solid fa-folder-open"></i></button>\` : ''}
            </div>
          </div>
        </div>
      \`).join('');
    }

    let isProcessingBgr = false;
    async function processNextInBgrQueue() {
      if (isProcessingBgr) return;
      const next = bgrQueue.find(i => !i.resultUrl && i.status !== 'Fehler');
      if (!next) return;

      isProcessingBgr = true;
      const updateUi = (pct, status) => {
        next.progress = pct;
        next.status = status;
        const bar = document.getElementById('bar-' + next.id);
        const pctEl = document.getElementById('pct-' + next.id);
        const stEl = document.getElementById('status-' + next.id);
        if (bar) bar.style.width = pct + '%';
        if (pctEl) pctEl.textContent = pct + '%';
        if (stEl) stEl.textContent = status;
      };

      try {
        updateUi(15, 'Lade Bilddaten...');
        const reader = new FileReader();
        const dataUrl = await new Promise((res, rej) => {
          reader.onload = () => res(reader.result);
          reader.onerror = rej;
          reader.readAsDataURL(next.file);
        });

        updateUi(35, 'KI-Modell verarbeitet...');

        // Visual progression
        const interval = setInterval(() => {
          if (next.progress < 85) updateUi(next.progress + 10, 'Segmentiere Motiv...');
        }, 600);

        const autoSave = document.getElementById('bgr-auto-save') ? document.getElementById('bgr-auto-save').checked : true;
        const outDir = document.getElementById('bgr-out-dir') ? document.getElementById('bgr-out-dir').value : './freigestellt';

        const res = await fetch('/api/bg-remover/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl,
            filename: next.name,
            preset: bgrPreset,
            format: bgrFormat,
            saveToDisk: autoSave,
            outDir: outDir
          })
        });

        clearInterval(interval);
        const data = await res.json();

        if (data.success && data.resultUrl) {
          next.resultUrl = data.resultUrl;
          next.savedPath = data.savedPath || null;
          next.originalDataUrl = dataUrl;
          updateUi(100, \`Fertig (\${(data.durationMs / 1000).toFixed(1)}s)\`);
          loadBgrComparison(next.id);
        } else {
          updateUi(0, 'Fehler: ' + (data.error || 'Segmentierungs-Fehler'));
        }
      } catch (err) {
        updateUi(0, 'Fehler: ' + err.message);
      } finally {
        isProcessingBgr = false;
        renderBgrQueue();
        processNextInBgrQueue();
      }
    }

    let currentActiveBgrId = null;
    function loadBgrComparison(id) {
      currentActiveBgrId = id;
      const item = bgrQueue.find(i => i.id === id);
      if (!item || !item.resultUrl) return;

      const origImg = document.getElementById('split-img-orig');
      const procImg = document.getElementById('split-img-proc');
      origImg.src = item.originalDataUrl;
      procImg.src = item.resultUrl;

      document.getElementById('btn-bgr-download').style.display = 'inline-flex';
    }

    async function openBgrTargetFolder() {
      const outDir = document.getElementById('bgr-out-dir') ? document.getElementById('bgr-out-dir').value : './freigestellt';
      try {
        await fetch('/api/open-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dir: outDir })
        });
      } catch (err) {
        console.warn('Fehler beim Öffnen des Ordners:', err);
      }
    }

    function downloadBgrResult() {
      const item = bgrQueue.find(i => i.id === currentActiveBgrId);
      if (!item || !item.resultUrl) return;

      const ext = bgrFormat === 'webp' ? '.webp' : '.png';
      const outName = item.name.replace(/\\.[^/.]+$/, '') + '-freigestellt' + ext;
      const a = document.createElement('a');
      a.href = item.resultUrl;
      a.download = outName;
      a.click();
    }

    // Split-Slider Event Handling
    function setupSplitSlider() {
      const box = document.getElementById('split-box');
      const divider = document.getElementById('split-divider');
      const topLayer = document.getElementById('split-top-layer');

      const onMove = (clientX) => {
        const rect = box.getBoundingClientRect();
        let x = clientX - rect.left;
        x = Math.max(0, Math.min(rect.width, x));
        const pct = (x / rect.width) * 100;

        divider.style.left = pct + '%';
        topLayer.style.clipPath = \`polygon(\${pct}% 0, 100% 0, 100% 100%, \${pct}% 100%)\`;
      };

      const startDrag = (e) => {
        isDraggingSplit = true;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        onMove(clientX);
      };

      const handleMove = (e) => {
        if (!isDraggingSplit) return;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        onMove(clientX);
      };

      const stopDrag = () => {
        isDraggingSplit = false;
      };

      box.addEventListener('mousedown', startDrag);
      box.addEventListener('touchstart', startDrag, { passive: false });

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('touchmove', handleMove, { passive: false });

      window.addEventListener('mouseup', stopDrag);
      window.addEventListener('touchend', stopDrag);
    }

    // Convert Workspace: Universal Image Studio (Decluttered)
    function switchConvertMode(mode) {
      document.getElementById('btn-mode-img').classList.toggle('active', mode === 'img');
      document.getElementById('btn-mode-psd').classList.toggle('active', mode === 'psd');
      document.getElementById('convert-view-img').style.display = mode === 'img' ? 'flex' : 'none';
      document.getElementById('convert-view-psd').style.display = mode === 'psd' ? 'flex' : 'none';
    }

    // Recursive Folder & Multi-File Extraction
    function isImageFile(filename) {
      return /\.(png|jpe?g|webp|avif|bmp|tiff?|ico|gif)$/i.test(filename || '');
    }

    function traverseEntry(entry) {
      return new Promise((resolve) => {
        if (!entry) return resolve([]);
        if (entry.isFile) {
          entry.file((f) => {
            if (isImageFile(f.name)) resolve([f]);
            else resolve([]);
          }, () => resolve([]));
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          const allEntries = [];
          const readBatch = () => {
            reader.readEntries(async (entries) => {
              if (!entries || entries.length === 0) {
                const subPromises = allEntries.map(e => traverseEntry(e));
                const subResults = await Promise.all(subPromises);
                resolve(subResults.flat());
              } else {
                allEntries.push(...entries);
                readBatch();
              }
            }, () => resolve([]));
          };
          readBatch();
        } else {
          resolve([]);
        }
      });
    }

    async function extractFilesFromDataTransfer(dataTransfer) {
      if (!dataTransfer) return [];
      const items = dataTransfer.items;
      if (items && items.length > 0) {
        const promises = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
            if (entry) {
              promises.push(traverseEntry(entry));
            } else {
              const file = item.getAsFile();
              if (file && isImageFile(file.name)) promises.push(Promise.resolve([file]));
            }
          }
        }
        const results = await Promise.all(promises);
        const flattened = results.flat();
        if (flattened.length > 0) return flattened;
      }
      if (dataTransfer.files && dataTransfer.files.length > 0) {
        return Array.from(dataTransfer.files).filter(f => isImageFile(f.name));
      }
      return [];
    }

    // BG-Remover Drag-and-Drop (Folder & Multi-File Support)
    function setupBgRemoverDragDrop() {
      const dropzone = document.getElementById('bgr-dropzone');
      if (!dropzone) return;
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('dragover');
        });
      });
      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('dragover');
        });
      });
      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
        const files = await extractFilesFromDataTransfer(e.dataTransfer);
        if (files.length > 0) {
          handleBgFiles(files);
        }
      });
    }

    // Image Converter Drag-and-Drop
    function setupImageConverterDragDrop() {
      const dropzone = document.getElementById('img-dropzone');
      if (!dropzone) return;
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('dragover');
        });
      });
      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('dragover');
        });
      });
      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
        const files = await extractFilesFromDataTransfer(e.dataTransfer);
        if (files.length > 0) {
          handleImageConvertFile(files[0]);
        }
      });
    }

    function formatFileSize(bytes) {
      if (!bytes || isNaN(bytes)) return '0 B';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    async function handleImageConvertFile(file) {
      if (!file) return;
      selectedImgFile = file;

      const reader = new FileReader();
      reader.onload = (e) => {
        selectedImgDataUrl = e.target.result;
        
        // Load image to get natural dimensions
        const img = new Image();
        img.onload = () => {
          selectedImgOriginalWidth = img.naturalWidth;
          selectedImgOriginalHeight = img.naturalHeight;

          // Update Source Card
          document.getElementById('img-source-card').style.display = 'block';
          document.getElementById('img-source-thumb').src = selectedImgDataUrl;
          document.getElementById('img-source-name').textContent = file.name;
          
          const ext = file.name.split('.').pop().toUpperCase();
          document.getElementById('img-source-format').textContent = ext;
          document.getElementById('img-source-size').textContent = formatFileSize(file.size);
          document.getElementById('img-source-res').textContent = \`\${img.naturalWidth} × \${img.naturalHeight} px\`;

          // Initialize Scale inputs
          document.getElementById('img-scale-w').value = img.naturalWidth;
          document.getElementById('img-scale-h').value = img.naturalHeight;
          updateScaleDrawerBadge();

          // Enable convert button
          const btn = document.getElementById('btn-convert-img');
          btn.disabled = false;
          btn.innerHTML = \`<i class="fa-solid fa-rocket"></i> <span>\${file.name} konvertieren</span>\`;

          // Hide old result
          document.getElementById('img-result-card').style.display = 'none';
        };
        img.onerror = () => {
          selectedImgOriginalWidth = 1000;
          selectedImgOriginalHeight = 1000;
          document.getElementById('img-source-card').style.display = 'block';
          document.getElementById('img-source-name').textContent = file.name;
          document.getElementById('img-source-format').textContent = file.name.split('.').pop().toUpperCase();
          document.getElementById('img-source-size').textContent = formatFileSize(file.size);
          document.getElementById('img-source-res').textContent = 'Vektor / Dokument';
          document.getElementById('btn-convert-img').disabled = false;
        };
        img.src = selectedImgDataUrl;
      };
      reader.readAsDataURL(file);
    }

    function selectConvertFormat(fmt) {
      selectedConvertFormat = fmt;
      
      // Update primary and secondary format buttons
      document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.format-pill-btn').forEach(b => b.classList.remove('active'));

      const primaryBtn = document.getElementById('fmt-' + fmt);
      if (primaryBtn) primaryBtn.classList.add('active');

      // Background color option for JPEG / PDF
      const bgGroup = document.getElementById('img-bg-group');
      if (bgGroup) {
        bgGroup.style.display = (fmt === 'jpeg' || fmt === 'jpg' || fmt === 'pdf') ? 'flex' : 'none';
      }

      // Quality control: dim for lossless/vector formats
      const qCard = document.getElementById('img-quality-card');
      if (qCard) {
        if (fmt === 'png' || fmt === 'svg' || fmt === 'ico') {
          qCard.style.opacity = '0.5';
          qCard.title = 'Qualitätsslider ist bei ' + fmt.toUpperCase() + ' verlustfrei.';
        } else {
          qCard.style.opacity = '1';
          qCard.title = '';
        }
      }
    }

    function applyQuickScale(multiplier) {
      if (!selectedImgOriginalWidth || !selectedImgOriginalHeight) return;
      const w = Math.round(selectedImgOriginalWidth * multiplier);
      const h = Math.round(selectedImgOriginalHeight * multiplier);
      document.getElementById('img-scale-w').value = w;
      document.getElementById('img-scale-h').value = h;
      updateScaleDrawerBadge(multiplier + 'x (' + w + '×' + h + ' px)');
    }

    function updateScaleDrawerBadge(text) {
      const badge = document.getElementById('scale-summary-badge');
      if (badge) {
        if (text) {
          badge.textContent = text;
        } else {
          const w = document.getElementById('img-scale-w').value;
          const h = document.getElementById('img-scale-h').value;
          if (w && h && selectedImgOriginalWidth) {
            const mult = (w / selectedImgOriginalWidth).toFixed(2);
            badge.textContent = mult + 'x (' + w + '×' + h + ' px)';
          } else {
            badge.textContent = 'Original (100%)';
          }
        }
      }
    }

    function toggleAspectLock() {
      isAspectLocked = !isAspectLocked;
      const btn = document.getElementById('btn-aspect-lock');
      const icon = document.getElementById('aspect-lock-icon');
      const text = document.getElementById('aspect-lock-text');
      if (isAspectLocked) {
        btn.classList.add('locked');
        icon.className = 'fa-solid fa-lock';
        text.textContent = 'Gesperrt';
      } else {
        btn.classList.remove('locked');
        icon.className = 'fa-solid fa-lock-open';
        text.textContent = 'Frei';
      }
    }

    function onWidthInputChange() {
      if (!selectedImgOriginalWidth || !selectedImgOriginalHeight) return;
      if (isAspectLocked) {
        const w = parseFloat(document.getElementById('img-scale-w').value);
        if (!isNaN(w) && w > 0) {
          const h = Math.round((w / selectedImgOriginalWidth) * selectedImgOriginalHeight);
          document.getElementById('img-scale-h').value = h;
        }
      }
      updateScaleDrawerBadge();
    }

    function onHeightInputChange() {
      if (!selectedImgOriginalWidth || !selectedImgOriginalHeight) return;
      if (isAspectLocked) {
        const h = parseFloat(document.getElementById('img-scale-h').value);
        if (!isNaN(h) && h > 0) {
          const w = Math.round((h / selectedImgOriginalHeight) * selectedImgOriginalWidth);
          document.getElementById('img-scale-w').value = w;
        }
      }
      updateScaleDrawerBadge();
    }

    function resetDimensions() {
      if (!selectedImgOriginalWidth || !selectedImgOriginalHeight) return;
      document.getElementById('img-scale-w').value = selectedImgOriginalWidth;
      document.getElementById('img-scale-h').value = selectedImgOriginalHeight;
      updateScaleDrawerBadge('Original (100%)');
    }

    function onQualitySliderChange(val) {
      document.getElementById('img-quality-badge').textContent = val + '%';
      document.querySelectorAll('.preset-pill-btn').forEach(b => b.classList.remove('active'));
      const matchingBtn = document.getElementById('qp-' + val);
      if (matchingBtn) matchingBtn.classList.add('active');

      const qBadge = document.getElementById('quality-summary-badge');
      if (qBadge) {
        if (val >= 95) qBadge.textContent = 'Maximal (' + val + '%)';
        else if (val >= 85) qBadge.textContent = 'Hohe Qualität (' + val + '%)';
        else if (val >= 75) qBadge.textContent = 'Web-Standard (' + val + '%)';
        else qBadge.textContent = 'Kompakt (' + val + '%)';
      }
    }

    function applyQualityPreset(val) {
      document.getElementById('img-quality-slider').value = val;
      onQualitySliderChange(val);
    }

    async function executeImageConvert() {
      if (!selectedImgDataUrl) return;
      const btn = document.getElementById('btn-convert-img');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Konvertiere &amp; verarbeite Bild...</span>';

      const width = parseInt(document.getElementById('img-scale-w').value, 10) || undefined;
      const height = parseInt(document.getElementById('img-scale-h').value, 10) || undefined;
      const quality = parseInt(document.getElementById('img-quality-slider').value, 10);
      const fit = document.getElementById('img-fit-select').value;
      const filter = document.getElementById('img-filter-select').value;
      const compress = document.getElementById('img-opt-compress').checked;
      const background = document.getElementById('img-bg-color').value || '#FFFFFF';

      try {
        const res = await fetch('/api/image/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl: selectedImgDataUrl,
            filename: selectedImgFile ? selectedImgFile.name : 'image',
            format: selectedConvertFormat,
            quality,
            width,
            height,
            fit,
            maintainAspectRatio: isAspectLocked,
            filter,
            compress,
            background
          })
        });

        const data = await res.json();
        if (data.success) {
          convertedResult = data;
          document.getElementById('img-result-card').style.display = 'block';
          
          if (data.format === 'pdf') {
            document.getElementById('img-result-preview').src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2338bdf8" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
          } else {
            document.getElementById('img-result-preview').src = data.dataUrl;
          }

          document.getElementById('res-out-fmt').textContent = data.format.toUpperCase();
          document.getElementById('res-orig-stat').textContent = \`\${data.originalWidth} × \${data.originalHeight} px (\${formatFileSize(data.originalBytes)})\`;
          document.getElementById('res-out-stat').textContent = \`\${data.width} × \${data.height} px (\${formatFileSize(data.outputBytes)})\`;

          const savingsBadge = document.getElementById('res-savings-badge');
          if (data.savingsPercent > 0) {
            savingsBadge.className = 'savings-badge positive';
            savingsBadge.innerHTML = \`<i class="fa-solid fa-arrow-down"></i> -\${data.savingsPercent}% Dateigröße (\${formatFileSize(data.originalBytes - data.outputBytes)} gespart)\`;
          } else if (data.savingsPercent < 0) {
            savingsBadge.className = 'savings-badge neutral';
            savingsBadge.innerHTML = \`<i class="fa-solid fa-arrow-up"></i> +\${Math.abs(data.savingsPercent)}% (Skaliert)\`;
          } else {
            savingsBadge.className = 'savings-badge neutral';
            savingsBadge.textContent = 'Gleiche Dateigröße';
          }

          document.getElementById('res-duration').textContent = (data.durationMs || 0) + ' ms';
          document.getElementById('img-result-card').scrollIntoView({ behavior: 'smooth' });
        } else {
          alert('Konvertierungsfehler: ' + (data.error || 'Unbekannt'));
        }
      } catch (err) {
        alert('Netzwerk- oder Serverfehler: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = \`<i class="fa-solid fa-rocket"></i> <span>\${selectedImgFile ? selectedImgFile.name : 'Bild'} konvertieren &amp; skalieren</span>\`;
      }
    }

    function downloadConvertedImage() {
      if (!convertedResult || !convertedResult.dataUrl) return;
      const a = document.createElement('a');
      a.href = convertedResult.dataUrl;
      const base = selectedImgFile ? selectedImgFile.name.replace(/\.[^/.]+$/, '') : 'konvertiert';
      a.download = \`\${base}_\${convertedResult.width}x\${convertedResult.height}.\${convertedResult.format}\`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    async function saveResultToWorkspace() {
      if (!convertedResult || !selectedImgDataUrl) return;
      try {
        const width = parseInt(document.getElementById('img-scale-w').value, 10) || undefined;
        const height = parseInt(document.getElementById('img-scale-h').value, 10) || undefined;
        const quality = parseInt(document.getElementById('img-quality-slider').value, 10);
        const fit = document.getElementById('img-fit-select').value;
        const filter = document.getElementById('img-filter-select').value;
        const compress = document.getElementById('img-opt-compress').checked;
        const background = document.getElementById('img-bg-color').value || '#FFFFFF';

        const res = await fetch('/api/image/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl: selectedImgDataUrl,
            filename: selectedImgFile ? selectedImgFile.name : 'image',
            format: selectedConvertFormat,
            quality,
            width,
            height,
            fit,
            maintainAspectRatio: isAspectLocked,
            filter,
            compress,
            background,
            saveToDisk: true
          })
        });
        const data = await res.json();
        if (data.success && data.savedPath) {
          alert('Gespeichert in: ' + data.savedPath);
          loadFiles();
        } else {
          alert('Fehler beim Speichern: ' + (data.error || 'Unbekannt'));
        }
      } catch (err) {
        alert('Fehler: ' + err.message);
      }
    }

    // Convert (PSD) Tab
    function handlePsdFile(file) {
      if (!file) return;
      selectedPsdFile = file;
      document.getElementById('btn-convert-psd').disabled = false;
      document.getElementById('btn-convert-psd').innerHTML = \`<i class="fa-solid fa-arrows-rotate"></i> <span>\${file.name} in TOAD konvertieren</span>\`;
    }

    async function executePsdConvert() {
      if (!selectedPsdFile) return;
      const btn = document.getElementById('btn-convert-psd');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Lese Ebenen und extrahiere Assets...</span>';

      const extractImages = document.getElementById('psd-opt-assets').checked;
      const includeHidden = document.getElementById('psd-opt-hidden').checked;
      const formatCode = document.getElementById('psd-opt-format').checked;
      const dpi = document.getElementById('psd-dpi').value;

      try {
        const reader = new FileReader();
        const dataUrl = await new Promise((res, rej) => {
          reader.onload = () => res(reader.result);
          reader.onerror = rej;
          reader.readAsDataURL(selectedPsdFile);
        });

        const res = await fetch('/api/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl,
            filename: selectedPsdFile.name,
            extractImages,
            includeHidden,
            formatCode,
            dpi
          })
        });

        const data = await res.json();
        if (data.success) {
          activeConvertedPath = data.outPath;
          document.getElementById('psd-result-card').style.display = 'block';
          document.getElementById('psd-result-path').textContent = data.outPath;
          document.getElementById('psd-result-stats').innerHTML = \`
            Ebenen verarbeitet: <strong>\${data.stats?.layers || 0}</strong><br>
            Extrahierte Bild-Assets: <strong>\${data.stats?.extractedImages || 0}</strong><br>
            Canvas-Größe: <strong>\${data.stats?.width || 0} x \${data.stats?.height || 0} px</strong>
          \`;
          loadFiles();
        } else {
          alert('PSD-Konvertierungsfehler: ' + (data.error || 'Unbekannt'));
        }
      } catch (err) {
        alert('Fehler: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> <span>PSD in TOAD konvertieren</span>';
      }
    }

    function openConvertedInGraphic() {
      if (!activeConvertedPath) return;
      switchTab('graphic');
      selectFile(activeConvertedPath);
    }

    // Report / Audit Tab
    async function runAuditForActiveFile() {
      if (!selectedFilePath) return;
      const fileLabel = document.getElementById('audit-file-label');
      fileLabel.textContent = selectedFilePath.split(/[/\\\\]/).pop();

      try {
        const res = await fetch(\`/api/audit?path=\${encodeURIComponent(selectedFilePath)}\`);
        const data = await res.json();
        renderAudit(data);
      } catch (err) {
        console.error('Audit fetch error:', err);
      }
    }

    function renderAudit(data) {
      if (!data || data.status === 'no_data') {
        document.getElementById('audit-score-num').textContent = '--%';
        return;
      }

      const score = Math.round(data.totalScore || data.score || 0);
      const scoreEl = document.getElementById('audit-score-num');
      scoreEl.textContent = score + '%';
      scoreEl.className = 'hero-score-num ' + (score >= 90 ? 'high' : (score >= 70 ? 'med' : 'low'));

      const gradeEl = document.getElementById('audit-grade');
      gradeEl.textContent = data.grade || (score >= 95 ? 'A+' : (score >= 85 ? 'A' : (score >= 75 ? 'B' : 'C')));

      // Dimensions
      if (data.dimensions) {
        document.getElementById('dim-layout').textContent = Math.round(data.dimensions.layout || score) + '%';
        document.getElementById('dim-typo').textContent = Math.round(data.dimensions.typography || score) + '%';
        document.getElementById('dim-contrast').textContent = Math.round(data.dimensions.contrast || score) + '%';
        document.getElementById('dim-slop').textContent = Math.round(data.dimensions.antiSlop || score) + '%';
        document.getElementById('dim-vector').textContent = Math.round(data.dimensions.vectors || score) + '%';
      }

      // Issues List with Category Filter
      currentAuditIssues = data.issues || data.diagnostics || [];
      const errCnt = currentAuditIssues.filter(i => ['error','crit','critical'].includes((i.severity||'').toLowerCase())).length;
      const warnCnt = currentAuditIssues.filter(i => ['warn','warning'].includes((i.severity||'').toLowerCase())).length;
      const infoCnt = currentAuditIssues.filter(i => ['info','tip','notice'].includes((i.severity||'').toLowerCase())).length;

      const cntAll = document.getElementById('cnt-all');
      if (cntAll) cntAll.textContent = currentAuditIssues.length;
      const cntErr = document.getElementById('cnt-error');
      if (cntErr) cntErr.textContent = errCnt;
      const cntWarn = document.getElementById('cnt-warn');
      if (cntWarn) cntWarn.textContent = warnCnt;
      const cntInfo = document.getElementById('cnt-info');
      if (cntInfo) cntInfo.textContent = infoCnt;

      const list = document.getElementById('audit-issues-list');
      if (currentAuditIssues.length === 0) {
        list.innerHTML = '<div style="font-size: 13px; color: var(--success); text-align: center; padding: 20px; font-weight: 600;"><i class="fa-solid fa-circle-check" style="margin-right: 6px;"></i> Hervorragend! 0 Regelverstöße gefunden. Perfekte TOAD-Konformität.</div>';
        return;
      }

      renderFilteredIssues();
    }

    let currentAuditIssues = [];
    let currentAuditFilter = 'all';

    function filterAuditIssues(filter) {
      currentAuditFilter = filter;
      document.querySelectorAll('.audit-filter-chip').forEach(c => c.classList.remove('active'));
      const activeChip = document.getElementById('flt-' + filter);
      if (activeChip) activeChip.classList.add('active');
      renderFilteredIssues();
    }

    function renderFilteredIssues() {
      const list = document.getElementById('audit-issues-list');
      if (!list) return;

      const filtered = currentAuditIssues.filter(iss => {
        if (currentAuditFilter === 'all') return true;
        const sev = (iss.severity || 'warn').toLowerCase();
        if (currentAuditFilter === 'error') return sev === 'error' || sev === 'crit' || sev === 'critical';
        if (currentAuditFilter === 'warn') return sev === 'warn' || sev === 'warning';
        if (currentAuditFilter === 'info') return sev === 'info' || sev === 'tip' || sev === 'notice';
        return true;
      });

      if (filtered.length === 0) {
        list.innerHTML = '<div style="font-size: 13px; color: var(--text-dim); text-align: center; padding: 24px;">Keine Befunde in dieser Kategorie.</div>';
        return;
      }

      list.innerHTML = filtered.map(iss => {
        const sev = (iss.severity || 'warn').toLowerCase();
        let icon = 'fa-solid fa-triangle-exclamation';
        if (sev === 'error' || sev === 'crit' || sev === 'critical') icon = 'fa-solid fa-circle-xmark';
        else if (sev === 'info' || sev === 'tip' || sev === 'notice') icon = 'fa-solid fa-circle-info';

        return \`
          <div class="issue-card">
            <div class="issue-header">
              <span class="issue-badge \${sev}"><i class="\${icon}"></i> \${(iss.severity || 'WARN').toUpperCase()}</span>
              <span style="font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--text);">[\${iss.code || 'AUDIT'}] \${iss.name || iss.message}</span>
            </div>
            <div class="issue-help">\${iss.help || iss.details || ''}</div>
          </div>
        \`;
      }).join('');
    }

    async function applyAuditFixes() {
      if (!selectedFilePath) return;
      try {
        const res = await fetch('/api/audit/fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: selectedFilePath })
        });
        const data = await res.json();
        if (data.success) {
          alert('Automatische Korrekturen & Formatierung erfolgreich angewendet!');
          renderAudit(data.audit);
          refreshPreview();
        }
      } catch (err) {
        alert('Fehler beim Ausführen der Korrekturen: ' + err.message);
      }
    }

    // Modal Handlers (Init, Bundle, Workspaces)
    function openModal(id) { document.getElementById(id).classList.add('active'); }
    function closeModal(id) { document.getElementById(id).classList.remove('active'); }

    function openInitModal() { openModal('modal-init'); }
    async function submitInit() {
      const name = document.getElementById('init-name').value;
      const template = document.getElementById('init-template').value;
      const res = await fetch('/api/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, template })
      });
      const data = await res.json();
      if (data.success) {
        closeModal('modal-init');
        loadFiles();
        selectFile(data.filePath);
      } else {
        alert(data.error || 'Fehler beim Erstellen');
      }
    }

    function openBundleModal() { openModal('modal-bundle'); }
    async function submitBundle() {
      const preset = document.getElementById('bundle-preset').value;
      const res = await fetch('/api/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFilePath, preset })
      });
      const data = await res.json();
      if (data.success) {
        closeModal('modal-bundle');
        alert(\`✔ Bundle erfolgreich gepackt (\${data.assets?.length || 0} Assets) in:\\n\${data.outDir}\`);
      } else {
        alert(data.error || 'Fehler beim Packen');
      }
    }

    async function openWorkspacesModal() {
      openModal('modal-workspaces');
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      const list = document.getElementById('workspaces-list');
      const ws = data.workspaces || [];
      if (ws.length === 0) {
        list.innerHTML = '<div style="font-size: 12px; color: var(--text-dim);">Keine Workspaces registriert.</div>';
      } else {
        list.innerHTML = ws.map(w => \`
          <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg); padding: 7px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border);">
            <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text);"><i class="fa-solid fa-folder" style="color: var(--cyan); margin-right: 6px;"></i>\${w}</span>
            <button class="btn-secondary" style="padding: 2px 6px; font-size: 10px; color: var(--error);" onclick="removeWorkspace('\${w.replace(/\\\\/g, '\\\\\\\\')}')">
              <i class="fa-solid fa-trash"></i> Löschen
            </button>
          </div>
        \`).join('');
      }
    }

    async function submitAddWorkspace() {
      const dir = document.getElementById('ws-add-input').value;
      if (!dir) return;
      await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir })
      });
      document.getElementById('ws-add-input').value = '';
      openWorkspacesModal();
      loadFiles();
    }

    async function removeWorkspace(dir) {
      await fetch(\`/api/workspaces?dir=\${encodeURIComponent(dir)}\`, { method: 'DELETE' });
      openWorkspacesModal();
      loadFiles();
    }

    // Server Graceful Shutdown
    async function shutdownServer() {
      if (!confirm('Möchtest du den TOAD Studio Server wirklich beenden?')) return;
      try {
        await fetch('/api/shutdown', { method: 'POST' });
        document.body.innerHTML = \`
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #090D16; color: #94A3B8; font-family: sans-serif; gap: 14px;">
            <div style="font-size: 42px; color: var(--accent);"><i class="fa-solid fa-frog"></i></div>
            <div style="font-size: 18px; font-weight: 700; color: #F8FAFC;">TOAD Studio Server wurde beendet</div>
            <div style="font-size: 13px;">Du kannst diesen Browser-Tab jetzt schließen.</div>
          </div>
        \`;
      } catch (err) {
        alert('Server beendet.');
      }
    }

    // SSE Event Listener for Live Reload
    function setupSse() {
      const events = new EventSource('/events');
      events.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.status === 'updated') {
            refreshPreview();
          }
        } catch {}
      };
    }
    </script>
    <div class="studio-toast" id="studio-toast">
      <i id="studio-toast-icon" class="fa-solid fa-circle-check"></i>
      <span id="studio-toast-msg">Meldung</span>
    </div>
</body>
</html>`;
}
