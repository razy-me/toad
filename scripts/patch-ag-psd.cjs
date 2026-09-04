const fs = require("fs");
const path = require("path");

let agPsdDir = path.join(__dirname, "..", "node_modules", "ag-psd");
try {
  const agPsdPkg = require.resolve("ag-psd/package.json", { paths: [__dirname, process.cwd()] });
  agPsdDir = path.dirname(agPsdPkg);
} catch {
  // ag-psd may not be installed yet or running in an environment without it
}

// 1. Patch psdWriter.js (alignment fix for sections & TySh/lfx2 4-byte padding)
const psdWriterFiles = [
  path.join(agPsdDir, "dist", "psdWriter.js"),
  path.join(agPsdDir, "dist-es", "psdWriter.js")
];

for (const filePath of psdWriterFiles) {
  if (!fs.existsSync(filePath)) continue;
  let code = fs.readFileSync(filePath, "utf8");
  let modified = false;

  // Use section payload length for padding instead of global offset
  if (code.includes("while ((writer.offset % round) !== 0) {")) {
    code = code.replace(
      "while ((writer.offset % round) !== 0) {",
      "while ((len % round) !== 0) {"
    );
    modified = true;
  }

  // Revert legacy faulty patch if present: non-4-byte tagged blocks must use 2-byte boundary
  if (code.includes("writeSection(writer, 4, function () {\n            handler.write(writer, target, psd, options);")) {
    code = code.replace(
      "writeSection(writer, 4, function () {\n            handler.write(writer, target, psd, options);",
      "writeSection(writer, fourBytes ? 4 : 2, function () {\n            handler.write(writer, target, psd, options);"
    );
    modified = true;
  } else if (code.includes("writeSection(writer, 4, function () {\r\n            handler.write(writer, target, psd, options);")) {
    code = code.replace(
      "writeSection(writer, 4, function () {\r\n            handler.write(writer, target, psd, options);",
      "writeSection(writer, fourBytes ? 4 : 2, function () {\r\n            handler.write(writer, target, psd, options);"
    );
    modified = true;
  }

  // Ensure TySh and lfx2 are in fourBytes
  if (!code.includes("key === 'TySh' || key === 'lfx2'")) {
    const p1 = "var fourBytes = key === 'TySh' || key === 'Txt2'";
    const p2 = "var fourBytes = key === 'Txt2'";
    if (code.includes(p1)) {
      code = code.replace(p1, "var fourBytes = key === 'TySh' || key === 'lfx2' || key === 'Txt2'");
      modified = true;
    } else if (code.includes(p2)) {
      code = code.replace(p2, "var fourBytes = key === 'TySh' || key === 'lfx2' || key === 'Txt2'");
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, code, "utf8");
    console.log("[patch-ag-psd] Patched " + filePath);
  }
}

// 2. Patch additionalInfo.js (TySh safe bounding coordinates & vector mask Initial Fill Rule Record)
const additionalInfoFiles = [
  path.join(agPsdDir, "dist", "additionalInfo.js"),
  path.join(agPsdDir, "dist-es", "additionalInfo.js")
];

for (const filePath of additionalInfoFiles) {
  if (!fs.existsSync(filePath)) continue;
  let code = fs.readFileSync(filePath, "utf8");
  let modified = false;

  // TySh: Never allow undefined to serialize as NaN
  const distTyShPattern = "(0, psdWriter_1.writeFloat32)(writer, text.left);";
  if (code.includes(distTyShPattern)) {
    code = code.replace(
      "(0, psdWriter_1.writeFloat32)(writer, text.left);\n    (0, psdWriter_1.writeFloat32)(writer, text.top);\n    (0, psdWriter_1.writeFloat32)(writer, text.right);\n    (0, psdWriter_1.writeFloat32)(writer, text.bottom);",
      "(0, psdWriter_1.writeFloat32)(writer, text.left || 0);\n    (0, psdWriter_1.writeFloat32)(writer, text.top || 0);\n    (0, psdWriter_1.writeFloat32)(writer, text.right || 0);\n    (0, psdWriter_1.writeFloat32)(writer, text.bottom || 0);"
    );
    code = code.replace(
      "(0, psdWriter_1.writeFloat32)(writer, text.left);\r\n    (0, psdWriter_1.writeFloat32)(writer, text.top);\r\n    (0, psdWriter_1.writeFloat32)(writer, text.right);\r\n    (0, psdWriter_1.writeFloat32)(writer, text.bottom);",
      "(0, psdWriter_1.writeFloat32)(writer, text.left || 0);\r\n    (0, psdWriter_1.writeFloat32)(writer, text.top || 0);\r\n    (0, psdWriter_1.writeFloat32)(writer, text.right || 0);\r\n    (0, psdWriter_1.writeFloat32)(writer, text.bottom || 0);"
    );
    modified = true;
  }

  const esTyShPattern = "writeFloat32(writer, text.left);";
  if (code.includes(esTyShPattern) && !code.includes("writeFloat32(writer, text.left || 0);")) {
    code = code.replace(
      "writeFloat32(writer, text.left);\n    writeFloat32(writer, text.top);\n    writeFloat32(writer, text.right);\n    writeFloat32(writer, text.bottom);",
      "writeFloat32(writer, text.left || 0);\n    writeFloat32(writer, text.top || 0);\n    writeFloat32(writer, text.right || 0);\n    writeFloat32(writer, text.bottom || 0);"
    );
    code = code.replace(
      "writeFloat32(writer, text.left);\r\n    writeFloat32(writer, text.top);\r\n    writeFloat32(writer, text.right);\r\n    writeFloat32(writer, text.bottom);",
      "writeFloat32(writer, text.left || 0);\r\n    writeFloat32(writer, text.top || 0);\r\n    writeFloat32(writer, text.right || 0);\r\n    writeFloat32(writer, text.bottom || 0);"
    );
    modified = true;
  }

  // vmsk/vsms: Always write path record selector 8 (Initial fill rule record)
  const vmskFillCheck = "if (vectorMask.fillStartsWithAllPixels !== undefined) {";
  if (code.includes(vmskFillCheck)) {
    code = code.replace(vmskFillCheck, "if (true) {");
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, code, "utf8");
    console.log("[patch-ag-psd] Patched " + filePath);
  }
}

// 3. Patch descriptor.js (layer effects contour curve TrnS, Ckmt/blur/Nose defaults, & all multi-effect arrays for Photopea)
const descriptorFiles = [
  path.join(agPsdDir, "dist", "descriptor.js"),
  path.join(agPsdDir, "dist-es", "descriptor.js")
];

for (const filePath of descriptorFiles) {
  if (!fs.existsSync(filePath)) continue;
  let code = fs.readFileSync(filePath, "utf8");
  let modified = false;

  const effectDefaults = `function serializeEffectObject(obj, objName, reportErrors) {
    var result = { enab: false };
    if (objName === 'dropShadow' || objName === 'innerShadow') {
        result.TrnS = { 'Nm  ': '', 'Crv ': [] };
        result.Ckmt = { units: 'Pixels', value: 0 };
        result.blur = { units: 'Pixels', value: 0 };
        result.Dstn = { units: 'Pixels', value: 0 };
        result.Nose = { units: 'Percent', value: 0 };
        result.AntA = false;
        result.layerConceals = true;
        result.lagl = { units: 'Angle', value: 90 };
        result.uglg = false;
        result['Md  '] = exports.BlnM.encode('normal');
        result.Opct = { units: 'Percent', value: 100 };
        result['Clr '] = { 'Rd  ': 0, 'Grn ': 0, 'Bl  ': 0 };
    }
    if (objName === 'outerGlow' || objName === 'innerGlow') {
        result.TrnS = { 'Nm  ': '', 'Crv ': [] };
        result.Ckmt = { units: 'Pixels', value: 0 };
        result.blur = { units: 'Pixels', value: 0 };
        result.Nose = { units: 'Percent', value: 0 };
        result.AntA = false;
    }`;

  // Replace whatever serializeEffectObject header is present
  const regex = /function serializeEffectObject\(obj, objName, reportErrors\) \{[\s\S]*?(?=for \(var _i = 0)/;
  if (regex.test(code)) {
    code = code.replace(regex, effectDefaults + "\n    ");
    modified = true;
  }

  // Register all 11 multi-effect types in fieldToArrayExtType
  if (!code.includes("ebblMulti: makeType('', 'ebbl')")) {
    const fPattern = "frameFXMulti: makeType('', 'FrFX'),";
    const fReplacement = `frameFXMulti: makeType('', 'FrFX'),
    ebblMulti: makeType('', 'ebbl'),
    innerShadowMulti: makeType('', 'IrSh'),
    IrGlMulti: makeType('', 'IrGl'),
    ChFXMulti: makeType('', 'ChFX'),
    patternFillMulti: makeType('', 'patternFill'),
    OrGlMulti: makeType('', 'OrGl'),
    St3DMulti: makeType('', 'St3D'),`;
    if (code.includes(fPattern)) {
      code = code.replace(fPattern, fReplacement);
      modified = true;
    }
  }

  // Register all in types
  if (!code.includes("ebblMulti: 'Objc'")) {
    const tPattern = "frameFXMulti: 'Objc',";
    const tReplacement = `frameFXMulti: 'Objc',
    ebblMulti: 'Objc',
    IrGlMulti: 'Objc',
    ChFXMulti: 'Objc',
    patternFillMulti: 'Objc',
    OrGlMulti: 'Objc',
    St3DMulti: 'Objc',`;
    if (code.includes(tPattern)) {
      code = code.replace(tPattern, tReplacement);
      modified = true;
    }
  }

  // Register all in arrayKeys
  if (!code.includes("'ebblMulti'")) {
    const aPattern = "'frameFXMulti',";
    const aReplacement = "'frameFXMulti', 'ebblMulti', 'IrGlMulti', 'ChFXMulti', 'patternFillMulti', 'OrGlMulti', 'St3DMulti',";
    if (code.includes(aPattern)) {
      code = code.replace(aPattern, aReplacement);
      modified = true;
    }
  }

  // Populate all 11 in serializeEffects
  const multiPattern = "if (multi) {\n        info.numModifyingFX = 0;";
  const multiPatternCRLF = "if (multi) {\r\n        info.numModifyingFX = 0;";
  const multiReplacement = `if (multi) {
        info.numModifyingFX = 0;
        if (!info.dropShadowMulti) info.dropShadowMulti = [];
        if (!info.innerShadowMulti) info.innerShadowMulti = [];
        if (!info.solidFillMulti) info.solidFillMulti = [];
        if (!info.gradientFillMulti) info.gradientFillMulti = [];
        if (!info.frameFXMulti) info.frameFXMulti = [];
        if (!info.ebblMulti) info.ebblMulti = [];
        if (!info.IrGlMulti) info.IrGlMulti = [];
        if (!info.ChFXMulti) info.ChFXMulti = [];
        if (!info.patternFillMulti) info.patternFillMulti = [];
        if (!info.OrGlMulti) info.OrGlMulti = [];
        if (!info.St3DMulti) info.St3DMulti = [];`;
  const multiReplacementCRLF = `if (multi) {\r\n        info.numModifyingFX = 0;\r\n        if (!info.dropShadowMulti) info.dropShadowMulti = [];\r\n        if (!info.innerShadowMulti) info.innerShadowMulti = [];\r\n        if (!info.solidFillMulti) info.solidFillMulti = [];\r\n        if (!info.gradientFillMulti) info.gradientFillMulti = [];\r\n        if (!info.frameFXMulti) info.frameFXMulti = [];\r\n        if (!info.ebblMulti) info.ebblMulti = [];\r\n        if (!info.IrGlMulti) info.IrGlMulti = [];\r\n        if (!info.ChFXMulti) info.ChFXMulti = [];\r\n        if (!info.patternFillMulti) info.patternFillMulti = [];\r\n        if (!info.OrGlMulti) info.OrGlMulti = [];\r\n        if (!info.St3DMulti) info.St3DMulti = [];`;

  if (!code.includes("info.ebblMulti = []")) {
    if (code.includes(multiPattern)) {
      code = code.replace(multiPattern, multiReplacement);
      modified = true;
    } else if (code.includes(multiPatternCRLF)) {
      code = code.replace(multiPatternCRLF, multiReplacementCRLF);
      modified = true;
    }
  }

  // In parseEffects, only populate arrays when length > 0 so empty multi arrays don't clobber single effects
  const parseReplacements = [
    ["if (info.dropShadowMulti)", "if (info.dropShadowMulti && info.dropShadowMulti.length)"],
    ["if (info.innerShadowMulti)", "if (info.innerShadowMulti && info.innerShadowMulti.length)"],
    ["if (info.solidFillMulti)", "if (info.solidFillMulti && info.solidFillMulti.length)"],
    ["if (info.gradientFillMulti)", "if (info.gradientFillMulti && info.gradientFillMulti.length)"],
    ["if (info.frameFXMulti)", "if (info.frameFXMulti && info.frameFXMulti.length)"],
  ];
  for (const [p, r] of parseReplacements) {
    if (code.includes(p)) {
      code = code.replaceAll(p, r);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, code, "utf8");
    console.log("[patch-ag-psd] Patched " + filePath);
  }
}