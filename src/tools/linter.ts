import fs from 'fs';
import path from 'path';
import {
  DocumentNode,
  Diagnostic,
  VariableDeclarationNode,
  VariableReferenceNode,
  RelationalPositionNode,
  ElementNode,
  CalcValueNode
} from '../parser/ast.js';
import { parseToad } from '../parser/parser.js';

/**
 * Traverses an AST node and all its children.
 */
function traverse(node: any, visitor: (n: any, parent?: any) => void, parent?: any) {
  if (!node || typeof node !== 'object') return;
  
  if (node.type) {
    visitor(node, parent);
  }

  for (const key of Object.keys(node)) {
    if (key === 'loc') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        traverse(item, visitor, node);
      }
    } else if (typeof value === 'object') {
      traverse(value, visitor, node);
    }
  }
}

export function lintDocument(doc: DocumentNode, filePath?: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const declaredGlobalVars = new Map<string, VariableDeclarationNode>();
  const referencedGlobalVars = new Set<string>();
  const elementIds = new Set<string>(['canvas', 'parent']);
  const seenIds = new Map<string, any>();

  // Collect top-level declarations and check cross-variable references
  for (const v of doc.variables) {
    declaredGlobalVars.set(v.name, v);
    traverse(v.value, (node) => {
      if (node.type === 'VariableReference') {
        const refName = (node as VariableReferenceNode).name;
        referencedGlobalVars.add(refName);
        if (refName.includes('.')) {
          referencedGlobalVars.add(refName.split('.')[0]!);
        }
      }
    });
  }

  // 1st pass: Collect element IDs and detect duplicates on top-level elements and canvas
  const checkElementIds = (elements: any[]) => {
    for (const el of elements) {
      traverse(el, (node) => {
        if (
          [
            'RectElement', 'CircleElement', 'TextElement', 'PolygonElement',
            'PathElement', 'ImageElement', 'GroupElement', 'GridElement',
            'StackElement', 'ComponentInstance', 'IconElement', 'ShapeElement',
            'SlotElement'
          ].includes(node.type)
        ) {
          const elem = node as ElementNode;
          if (elem.id) {
            if (seenIds.has(elem.id)) {
              diagnostics.push({
                code: 'LINT-DUPLICATE-ID',
                message: `Duplicate element ID '#${elem.id}' found. Element IDs should be unique.`,
                severity: 'warning',
                loc: elem.loc
              });
            } else {
              seenIds.set(elem.id, elem.loc);
              elementIds.add(elem.id);
            }
          }
        }
      });
    }
  };

  checkElementIds(doc.elements);
  const canvasesToCheck = doc.canvases && doc.canvases.length > 0 ? doc.canvases : (doc.canvas ? [doc.canvas] : []);
  checkElementIds(canvasesToCheck);

  // Track component local scopes
  const componentLocalScopes = new Map<string, { params: Set<string>; used: Set<string> }>();
  for (const comp of doc.components) {
    const params = new Set<string>(comp.parameters.map(p => p.name));
    const used = new Set<string>();
    
    const visitCompNode = (node: any) => {
      if (node.type === 'VariableReference') {
        const refName = (node as VariableReferenceNode).name;
        const rootName = refName.split('.')[0]!;
        if (params.has(refName)) {
          used.add(refName);
        } else if (params.has(rootName)) {
          used.add(rootName);
        } else {
          referencedGlobalVars.add(refName);
        }
      } else if (node.type === 'CalcValue') {
        const expr = (node as CalcValueNode).expression;
        const matches = expr.matchAll(/>([a-zA-Z_][a-zA-Z0-9_.-]*)/g);
        for (const m of matches) {
          if (m[1]) {
            const refName = m[1];
            const rootName = refName.split('.')[0]!;
            if (params.has(refName)) {
              used.add(refName);
            } else if (params.has(rootName)) {
              used.add(rootName);
            } else {
              referencedGlobalVars.add(refName);
            }
          }
        }
      }
    };

    for (const prop of comp.properties) {
      traverse(prop, visitCompNode);
    }
    const compSeenIds = new Set<string>();
    for (const elem of comp.elements) {
      traverse(elem, (node) => {
        if (node.id) {
          if (compSeenIds.has(node.id)) {
            diagnostics.push({
              code: 'LINT-DUPLICATE-ID',
              message: `Duplicate element ID '#${node.id}' in component '${comp.name}'. Element IDs within a component should be unique.`,
              severity: 'warning',
              loc: node.loc
            });
          } else {
            compSeenIds.add(node.id);
          }
        }
      });
      traverse(elem, visitCompNode);
    }

    componentLocalScopes.set(comp.name, { params, used });

    // Check for unused component parameters
    for (const param of comp.parameters) {
      if (!used.has(param.name)) {
        diagnostics.push({
          code: 'LINT-UNUSED-PARAM',
          message: `Parameter '>${param.name}' in component '${comp.name}' is declared but never used.`,
          severity: 'warning',
          loc: param.loc,
          fix: {
            title: `Remove unused parameter '>${param.name}'`,
            kind: 'quickfix'
          }
        });
      }
    }
  }

  // 2nd pass: Lint top-level canvas & elements
  const checkElementTree = (elem: any, isDirectCanvasProp = false) => {
    traverse(elem, (node) => {
      if (node.type === 'VariableReference') {
        const ref = node as VariableReferenceNode;
        referencedGlobalVars.add(ref.name);
        const rootVarName = ref.name.includes('.') ? ref.name.split('.')[0]! : ref.name;
        if (ref.name.includes('.')) {
          referencedGlobalVars.add(rootVarName);
        }
        if (!declaredGlobalVars.has(ref.name) && !declaredGlobalVars.has(rootVarName)) {
          diagnostics.push({
            code: 'LINT-UNDECLARED-VAR',
            message: isDirectCanvasProp
              ? `Variable '>${ref.name}' is referenced on canvas but never declared.`
              : `Variable '>${ref.name}' is referenced but never declared.`,
            severity: 'error',
            loc: ref.loc
          });
        }
      } else if (node.type === 'CalcValue') {
        const expr = (node as CalcValueNode).expression;
        const matches = expr.matchAll(/>([a-zA-Z_][a-zA-Z0-9_.-]*)/g);
        for (const m of matches) {
          if (m[1]) {
            referencedGlobalVars.add(m[1]);
            const rootVar = m[1].includes('.') ? m[1].split('.')[0]! : m[1];
            if (m[1].includes('.')) {
              referencedGlobalVars.add(rootVar);
            }
            if (!declaredGlobalVars.has(m[1]) && !declaredGlobalVars.has(rootVar)) {
              diagnostics.push({
                code: 'LINT-UNDECLARED-VAR',
                message: `Variable '>${m[1]}' in calc() is referenced but never declared.`,
                severity: 'error',
                loc: node.loc
              });
            }
          }
        }
      }
      
      if (node.type === 'RelationalPosition') {
        const target = (node as RelationalPositionNode).target;
        if (!elementIds.has(target)) {
          diagnostics.push({
            code: 'LINT-INVALID-RELATION',
            message: `Relational position references unknown target '#${target}'. Did you forget to define it?`,
            severity: 'error',
            loc: node.loc
          });
        }
      }

      if (node.type === 'Property' && node.name === 'mask') {
        let maskTarget: string | undefined;
        if (node.value?.type === 'ElementReference') {
          maskTarget = node.value.targetId;
        } else if (node.value?.type === 'Identifier') {
          maskTarget = node.value.name;
        } else if (node.value?.type === 'StringLiteral') {
          maskTarget = node.value.value;
        } else if (node.value?.type === 'ColorLiteral' && typeof node.value.value === 'string') {
          maskTarget = node.value.value;
        }
        if (maskTarget) {
          const cleanTarget = maskTarget.replace(/^#/, '');
          if (!elementIds.has(cleanTarget)) {
            diagnostics.push({
              code: 'LINT-INVALID-MASK-TARGET',
              message: `Mask references unknown element '#${cleanTarget}'. Did you forget to define it?`,
              severity: 'error',
              loc: node.loc
            });
          }
        }
      }
    });
  };

  for (const elem of doc.elements) {
    checkElementTree(elem, false);
  }

  // Also check canvas properties and canvas-nested elements
  for (const c of canvasesToCheck) {
    // Check canvas's own properties
    if (c.properties) {
      for (const p of c.properties) {
        checkElementTree(p, true);
      }
    }
    // Check canvas-nested elements
    if (c.elements) {
      for (const elem of c.elements) {
        checkElementTree(elem, false);
      }
    }
  }

  // Collect all instantiated or referenced components across canvas, elements, and components
  const usedComponents = new Set<string>();
  const collectUsedComponents = (root: any) => {
    traverse(root, (node) => {
      if (node.type === 'ComponentInstance' && typeof node.componentName === 'string') {
        usedComponents.add(node.componentName);
      } else if (node.type === 'Identifier' && typeof node.name === 'string') {
        usedComponents.add(node.name);
      } else if (node.componentName && typeof node.componentName === 'string') {
        usedComponents.add(node.componentName);
      }
    });
  };

  collectUsedComponents(doc.elements);
  for (const c of canvasesToCheck) {
    collectUsedComponents(c);
  }
  for (const comp of doc.components) {
    collectUsedComponents(comp.elements);
    collectUsedComponents(comp.properties);
  }

  // Check for unused top-level variables and components. Suppress for standalone library/tokens files
  // that do not declare a canvas (as their declared variables/components are intended for @import).
  const hasCanvas = Boolean(doc.canvas || (doc.canvases && doc.canvases.length > 0));
  if (hasCanvas) {
    for (const [name, decl] of declaredGlobalVars.entries()) {
      if (!referencedGlobalVars.has(name)) {
        diagnostics.push({
          code: 'LINT-UNUSED-VAR',
          message: `Variable '>${name}' is declared but never used.`,
          severity: 'warning',
          loc: decl.loc
        });
      }
    }

    // Check for unused locally declared components
    for (const comp of doc.components) {
      if (!usedComponents.has(comp.name)) {
        diagnostics.push({
          code: 'LINT-UNUSED-COMPONENT',
          message: `Component '${comp.name}' is declared but never instantiated.`,
          severity: 'warning',
          loc: comp.loc,
          fix: {
            title: `Remove unused component '${comp.name}'`,
            kind: 'quickfix'
          }
        });
      }
    }

    // Check for unused components imported via @import
    const effectiveFile = filePath || doc.loc?.file;
    if (effectiveFile) {
      const docDir = path.dirname(effectiveFile);
      for (const dir of doc.directives) {
        if (dir.type === 'ImportDirective') {
          try {
            let importPath = dir.path;
            if (!path.extname(importPath)) importPath += '.toad';
            const resolvedPath = path.isAbsolute(importPath) ? importPath : path.resolve(docDir, importPath);
            if (fs.existsSync(resolvedPath)) {
              const content = fs.readFileSync(resolvedPath, 'utf-8');
              const importedAst = parseToad(content, resolvedPath);
              const hasUsedComponent = importedAst.components.some(comp => usedComponents.has(comp.name));
              const hasUsedVar = importedAst.variables.some(v => referencedGlobalVars.has(v.name));
              if (importedAst.components.length > 0 && !hasUsedComponent && !hasUsedVar) {
                diagnostics.push({
                  code: 'LINT-UNUSED-IMPORT',
                  message: `Imported module '${dir.path}' provides components (${importedAst.components.map(c => c.name).join(', ')}), but none are used in this file.`,
                  severity: 'warning',
                  loc: dir.loc,
                  fix: {
                    title: `Remove unused import '${dir.path}'`,
                    kind: 'quickfix'
                  }
                });
              }
            }
          } catch {
            // Ignore parse or file errors in linter
          }
        }
      }
    }
  }

  // Flag dimension values whose unit is not one the language understands.
  // The lexer tolerates arbitrary letter runs so compound suffixes like
  // `4k` / `2x` keep working; this rule surfaces likely typos (`200xp`).
  const KNOWN_UNITS = new Set(['', 'px', '%', 'deg', 'rad', 'em', 'rem', 'pt', 'vw', 'vh', 'mm', 'cm', 'in', 's', 'ms', 'k', 'x', 'ch', 'ex']);
  traverse(doc, (node) => {
    if ((node as any).type === 'DimensionLiteral') {
      const unit = String((node as any).unit || '');
      if (!KNOWN_UNITS.has(unit.toLowerCase())) {
        diagnostics.push({
          code: 'LINT-UNKNOWN-UNIT',
          message: `Unknown unit '${unit}' in value '${(node as any).value}${unit}'. The value is treated as pixels.`,
          severity: 'warning',
          loc: (node as any).loc
        });
      }
    }
  });

  return diagnostics;
}
