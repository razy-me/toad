import {
  DocumentNode,
  Diagnostic,
  VariableDeclarationNode,
  VariableReferenceNode,
  RelationalPositionNode,
  ElementNode,
  CalcValueNode
} from '../parser/ast.js';

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

export function lintDocument(doc: DocumentNode): Diagnostic[] {
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
        referencedGlobalVars.add((node as VariableReferenceNode).name);
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
  if (doc.canvas) {
    checkElementIds([doc.canvas]);
  }

  // Track component local scopes
  const componentLocalScopes = new Map<string, { params: Set<string>; used: Set<string> }>();
  for (const comp of doc.components) {
    const params = new Set<string>(comp.parameters.map(p => p.name));
    const used = new Set<string>();
    
    const visitCompNode = (node: any) => {
      if (node.type === 'VariableReference') {
        const refName = (node as VariableReferenceNode).name;
        if (params.has(refName)) {
          used.add(refName);
        } else {
          referencedGlobalVars.add(refName);
        }
      } else if (node.type === 'CalcValue') {
        const expr = (node as CalcValueNode).expression;
        const matches = expr.matchAll(/>([a-zA-Z_][a-zA-Z0-9_-]*)/g);
        for (const m of matches) {
          if (m[1]) {
            if (params.has(m[1])) {
              used.add(m[1]);
            } else {
              referencedGlobalVars.add(m[1]);
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
          loc: param.loc
        });
      }
    }
  }

  // 2nd pass: Lint top-level canvas & elements
  for (const elem of doc.elements) {
    traverse(elem, (node) => {
      if (node.type === 'VariableReference') {
        const ref = node as VariableReferenceNode;
        referencedGlobalVars.add(ref.name);
        if (!declaredGlobalVars.has(ref.name)) {
          diagnostics.push({
            code: 'LINT-UNDECLARED-VAR',
            message: `Variable '>${ref.name}' is referenced but never declared.`,
            severity: 'error',
            loc: ref.loc
          });
        }
      } else if (node.type === 'CalcValue') {
        const expr = (node as CalcValueNode).expression;
        const matches = expr.matchAll(/>([a-zA-Z_][a-zA-Z0-9_-]*)/g);
        for (const m of matches) {
          if (m[1]) {
            referencedGlobalVars.add(m[1]);
            if (!declaredGlobalVars.has(m[1])) {
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
  }

  // Also check canvas properties for variable references
  if (doc.canvas) {
    traverse(doc.canvas, (node) => {
      if (node.type === 'VariableReference') {
        const ref = node as VariableReferenceNode;
        referencedGlobalVars.add(ref.name);
        if (!declaredGlobalVars.has(ref.name)) {
          diagnostics.push({
            code: 'LINT-UNDECLARED-VAR',
            message: `Variable '>${ref.name}' is referenced on canvas but never declared.`,
            severity: 'error',
            loc: ref.loc
          });
        }
      }
    });
  }

  // Check for unused top-level variables
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

  // Flag dimension values whose unit is not one the language understands.
  // The lexer tolerates arbitrary letter runs so compound suffixes like
  // `4k` / `2x` keep working; this rule surfaces likely typos (`200xp`).
  const KNOWN_UNITS = new Set(['', 'px', '%', 'deg', 'rad', 'em', 'rem', 'pt', 'vw', 'vh', 'mm', 'cm', 'in', 's', 'ms', 'k', 'x']);
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
