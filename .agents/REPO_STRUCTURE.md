# 🛡️ TOAD Multi-Repository Architecture & Push Protocol

> **CRITICAL RULE FOR AI AGENTS & DEVELOPERS:**
> NEVER push directly to public repositories or the monorepo parent (`toad-dev`) without following the strict propagation pipeline described below.

---

## 🗺️ Repository Structure Overview

The TOAD ecosystem consists of 5 repositories across 3 workspaces:

```
                      ┌─────────────────────────────────┐
                      │    razy-me/toad-dev (PRIVATE)   │
                      │  (Monorepo holding Submodules)  │
                      └───────┬─────────────────┬───────┘
                              │ Submodule       │ Submodule
                              ▼                 ▼
 ┌──────────────────────────────┐     ┌──────────────────────────────┐
 │ razy-me/toad-private (PRIV)  │     │ razy-me/toad-designs (PUBLIC)│
 │ Core Compiler + Agents + Seed│     │ Open-Source Showcase Motifs  │
 └──────────────┬───────────────┘     └──────────────┬───────────────┘
                │ Auto-Mirror                        │ Submodule
                │ (GitHub Action:                    ▼
                │  sync-public.yml)   ┌──────────────────────────────┐
                ▼                     │toad-designs-private (PRIVATE)│
 ┌──────────────────────────────┐     │ Confidential Client Motifs   │
 │   razy-me/toad (PUBLIC)      │     └──────────────────────────────┘
 │ Open-Source Clean Tool & CLI │
 └──────────────────────────────┘
```

| Local Folder | Remote (Default `origin`) | Remote Target | Status |
| :--- | :--- | :--- | :--- |
| `d:\toad` | `origin` | `https://github.com/razy-me/toad-private.git` | **PRIVATE** |
| `d:\toad` | `public` | `https://github.com/razy-me/toad.git` | **PUBLIC (NEVER PUSH DIRECTLY)** |
| `d:\toad-designs` | `origin` | `https://github.com/razy-me/toad-designs.git` | **PUBLIC** |
| `d:\toad-designs\private` | `origin` | `https://github.com/razy-me/toad-designs-private.git` | **PRIVATE** |
| `d:\toad-dev` | `origin` | `https://github.com/razy-me/toad-dev.git` | **PRIVATE (MONOREPO)** |

---

## 🚫 Push Rules & Prohibitions (STRICT ENFORCEMENT)

1. **NEVER push directly from `d:\toad` to `public` (`razy-me/toad`)**:
   - The public repository MUST NOT contain `.agents/`, `the_seed/`, `GEMINI.md`, `PROJECT.md`, `soul-poster/`, or `assets/logo/`.
   - Always push ONLY to `origin` (`toad-private`).
   - The automated GitHub Action (`.github/workflows/sync-public.yml`) in `toad-private` will automatically filter out private folders and mirror a clean tree to `razy-me/toad`.

2. **NEVER edit code directly inside `d:\toad-dev`**:
   - `d:\toad-dev` is solely a container monorepo managing Git submodules.
   - Work happens inside `d:\toad` (compiler) or `d:\toad-designs` (designs).
   - Once work is committed and pushed in `d:\toad` or `d:\toad-designs`, sync `d:\toad-dev` by updating submodule pointers:
     ```powershell
     cd d:\toad-dev
     git submodule update --remote --merge
     git commit -am "chore: update submodule pointers"
     git push origin main
     ```

3. **NEVER put confidential designs in `d:\toad-designs` root**:
   - Confidential / client work (e.g. Vario, Urkunden) MUST be placed inside `d:\toad-designs\private\`.
   - Commit and push from within `d:\toad-designs\private` to `toad-designs-private`.
   - Then commit the updated submodule commit in `d:\toad-designs`.

---

## 🔄 Standard Sync & Push Workflow

### Workflow A: Changes to TOAD Compiler (`d:\toad`)
```powershell
cd d:\toad
git add -A
git commit -m "feat/fix: description"
git push origin main    # Pushes to toad-private
# -> GitHub Action automatically triggers and safely mirrors to public toad!

# Afterward, sync the parent monorepo:
cd d:\toad-dev
git submodule update --remote --merge
git commit -am "chore: sync toad submodule"
git push origin main
```

### Workflow B: Changes to Designs (`d:\toad-designs`)
```powershell
# If private design:
cd d:\toad-designs\private
git add -A
git commit -m "feat: design update"
git push origin main

# Sync parent designs repo:
cd d:\toad-designs
git add -A
git commit -m "chore: update private design submodule pointer"
git push origin main

# Sync monorepo:
cd d:\toad-dev
git submodule update --remote --merge
git commit -am "chore: sync designs submodule"
git push origin main
```
