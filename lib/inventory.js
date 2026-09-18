function parseNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isNaN(val) ? null : val;
  const s = String(val).replace(/,/g, '');
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isNaN(n) ? null : n;
}

function cleanText(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (s.toUpperCase() === 'BLANK' || s.toUpperCase() === 'NA' || s === 'NaN') return '';
  return s;
}

function findCol(headers, fragment) {
  const frag = fragment.toLowerCase();
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] && String(headers[i]).toLowerCase().includes(frag)) return i;
  }
  return -1;
}

function findSectionRow(values, prefix) {
  const p = prefix.toLowerCase();
  for (let i = 0; i < values.length; i++) {
    const v = values[i]?.[0];
    if (v && String(v).trim().toLowerCase().startsWith(p)) return i;
  }
  return -1;
}

function readQuickFacts(values) {
  const start = findSectionRow(values, 'a. project details');
  if (start === -1) return [];
  const facts = [];
  for (let r = start + 1; r < values.length; r++) {
    const label = cleanText(values[r]?.[0]);
    const val = cleanText(values[r]?.[1]);
    if (!label) {
      if (facts.length) break;
      continue;
    }
    if (label.toLowerCase().startsWith('b. project feature')) break;
    if (val) facts.push({ label, value: val });
  }
  return facts;
}

function readAmenities(values) {
  const start = findSectionRow(values, 'e. amenities');
  if (start === -1) return [];
  const items = [];
  for (let r = start + 1; r < values.length; r++) {
    const name = cleanText(values[r]?.[0]);
    if (!name) break;
    if (name.toLowerCase().startsWith('a. project details')) break;
    items.push(name);
  }
  return items;
}

function readLandmarks(values) {
  const start = findSectionRow(values, 'd. landmark distances');
  if (start === -1) return [];
  const items = [];
  for (let r = start + 2; r < values.length; r++) {
    const name = cleanText(values[r]?.[0]);
    if (!name) break;
    if (name.toLowerCase().startsWith('e. amenities')) break;
    const dist = parseNumber(values[r]?.[2]);
    items.push({ name, distanceKm: dist });
  }
  items.sort((a, b) => {
    if (a.distanceKm === null) return 1;
    if (b.distanceKm === null) return -1;
    return a.distanceKm - b.distanceKm;
  });
  return items;
}

function readFab(values) {
  const start = findSectionRow(values, 'b. project feature');
  if (start === -1) return [];

  let headerRow = -1;
  for (let r = start + 1; r <= start + 3 && r < values.length; r++) {
    const b = values[r]?.[1];
    if (b && String(b).toLowerCase().includes('feature')) { headerRow = r; break; }
  }
  if (headerRow === -1) return [];

  const items = [];
  for (let r = headerRow + 1; r < values.length; r++) {
    const feature = cleanText(values[r]?.[1]);
    const num = values[r]?.[0];
    if (!feature && (num === null || num === '')) break;
    if (!feature) continue;

    const top3 = cleanText(values[r]?.[5]).toLowerCase().startsWith('yes');

    items.push({
      num,
      feature,
      advantage: cleanText(values[r]?.[2]),
      benefit: cleanText(values[r]?.[3]),
      proof: cleanText(values[r]?.[4]),
      top3,
      situations: cleanText(values[r]?.[6]),
    });
  }
  return items;
}

export async function getInventoryDashboardData(sheets, spreadsheetId) {
  // MASTER DATABASE
  const masterRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'MASTER DATABASE'!A1:AZ`,
  });
  const masterVals = masterRes.data.values || [];
  if (masterVals.length < 2) {
    return { units: [], projectMaster: {}, projectDetails: {}, generatedAt: new Date().toISOString() };
  }

  const headers = masterVals[0] || [];
  const rows = masterVals.slice(1);

  const idx = {
    sno: findCol(headers, 's.no'),
    unitCode: findCol(headers, 'unit code'),
    project: findCol(headers, 'project name'),
    location: findCol(headers, 'location'),
    mapsLink: findCol(headers, 'google maps'),
    projectType: findCol(headers, 'project type'),
    resCom: findCol(headers, 'residential / commercial'),
    block: findCol(headers, 'block'),
    unitNo: findCol(headers, 'unit no'),
    unitType: findCol(headers, 'type of unit'),
    floor: findCol(headers, 'floor'),
    facing: findCol(headers, 'facing'),
    corner: findCol(headers, 'corner'),
    garden: findCol(headers, 'garden'),
    plotDim: findCol(headers, 'plot dimension'),
    plotArea: findCol(headers, 'plot area'),
    builtup: findCol(headers, 'built-up area'),
    sba: findCol(headers, 'super built-up'),
    carpet: findCol(headers, 'carpet'),
    status: findCol(headers, 'status'),
    rate: findCol(headers, 'rate'),
    remarks: findCol(headers, 'remarks'),
  };

  const units = [];
  for (const row of rows) {
    const unitCode = cleanText(row[idx.unitCode]);
    if (!unitCode) continue;

    const plotArea = parseNumber(row[idx.plotArea]);
    const builtup = parseNumber(row[idx.builtup]);
    const sba = parseNumber(row[idx.sba]);
    const carpet = parseNumber(row[idx.carpet]);

    const area = sba || builtup || plotArea || carpet || null;
    const areaBasis = sba ? 'Super Built-up' : builtup ? 'Built-up' : plotArea ? 'Plot' : carpet ? 'Carpet' : '';

    const rateRaw = cleanText(row[idx.rate]);
    const rate = parseNumber(rateRaw);

    units.push({
      sno: row[idx.sno],
      unitCode,
      project: cleanText(row[idx.project]),
      location: cleanText(row[idx.location]),
      mapsLink: cleanText(row[idx.mapsLink]),
      projectType: cleanText(row[idx.projectType]),
      resCom: cleanText(row[idx.resCom]),
      block: cleanText(row[idx.block]),
      unitNo: cleanText(row[idx.unitNo]),
      unitType: cleanText(row[idx.unitType]),
      floor: cleanText(row[idx.floor]),
      facing: cleanText(row[idx.facing]),
      corner: cleanText(row[idx.corner]),
      garden: cleanText(row[idx.garden]),
      plotDim: cleanText(row[idx.plotDim]),
      plotArea,
      builtup,
      sba,
      carpet,
      area,
      areaBasis,
      status: cleanText(row[idx.status]) || 'Unknown',
      rateRaw,
      rate,
      remarks: cleanText(row[idx.remarks]),
    });
  }

  // PROJECT MASTER
  const pmRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'PROJECT MASTER'!A1:F21`,
  });
  const pmVals = pmRes.data.values || [];

  const rowMap = {
    name: 3, location: 4, mapsLink: 5, projectType: 6, resCom: 7,
    landArea: 8, builtup: 9, sba: 10, blocks: 11, floors: 12,
    flats: 13, shops: 14, plots: 15, soldCount: 16, availableCount: 17,
    permissions: 18, rera: 19, possession: 20,
  };

  const projectMaster = {};
  for (let p = 1; p <= 5; p++) { // columns B..F
    const name = cleanText(pmVals?.[rowMap.name]?.[p]);
    if (!name) continue;

    const obj = {};
    for (const k of Object.keys(rowMap)) {
      const r = rowMap[k];
      obj[k] = cleanText(pmVals?.[r]?.[p]);
    }
    projectMaster[name] = obj;
  }

  // per-project detail tabs
  const projectDetails = {};
  for (const name of Object.keys(projectMaster)) {
    try {
      const tabRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${name.replace(/'/g, "''")}'!A1:H2000`,
      });
      const tabVals = tabRes.data.values || [];
      if (!tabVals.length) continue;

      projectDetails[name] = {
        quickFacts: readQuickFacts(tabVals),
        amenities: readAmenities(tabVals),
        landmarks: readLandmarks(tabVals),
        fab: readFab(tabVals),
      };
    } catch {
      // tab not found => skip
    }
  }

  return {
    units,
    projectMaster,
    projectDetails,
    generatedAt: new Date().toISOString(),
  };
}