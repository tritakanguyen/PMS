/**
 * PodLayout.js
 *
 * Pre-defined pod layout configurations for different pod types and faces.
 * This module provides grid structures and binId generation for cleaning mode
 * where bin data may not exist in the database.
 *
 * Layout Format:
 * - H8: 8-foot pod
 * - H10: 10-foot pod
 * - H11: 11-foot pod
 * - H12: 12-foot pod
 *
 * Face naming: A, B, C, D
 *
 * BinId Format: {faceLetter}_bin_{column}{row}
 * Example: a_bin_1a, b_bin_2m, c_bin_3k
 */

/**
 * Pod type configurations
 * Based on documentation in ADD_NEW_PODS_AUTO_README.md
 */
const POD_TYPE_CONFIGS = {
  H8: {
    A: { rows: 10, columns: 4 }, // A-J rows, 1-4 columns = 40 bins
    C: { rows: 11, columns: 4 }, // A-K rows, 1-4 columns = 44 bins
  },
  H10: {
    A: { rows: 12, columns: 4 }, // A-L rows, 1-4 columns = 48 bins
    C: { rows: 11, columns: 4 }, // A-K rows, 1-4 columns = 44 bins
  },
  H11: {
    A: { rows: 13, columns: 4 }, // A-M rows, 1-4 columns = 52 bins
    C: { rows: 12, columns: 4 }, // A-L rows, 1-4 columns = 48 bins
  },
  H12: {
    A: { rows: 8, columns: 3 }, // A-H rows, 1-3 columns = 24 bins
    C: { rows: 8, columns: 3 }, // A-H rows, 1-3 columns = 24 bins
  },
};

/**
 * Generate row labels for a given number of rows
 * @param {number} rowCount - Number of rows (e.g., 10 for A-J, 13 for A-M)
 * @returns {string[]} Array of lowercase row letters in reverse order (bottom to top)
 */
const generateRows = (rowCount) => {
  return Array.from(
    { length: rowCount },
    (_, i) => String.fromCharCode(97 + i) // 'a' to 'z'
  ).reverse(); // Reverse so 'a' is at bottom of grid
};

/**
 * Generate column labels for a given number of columns
 * @param {number} columnCount - Number of columns (e.g., 3, 4)
 * @returns {string[]} Array of column numbers as strings
 */
const generateColumns = (columnCount) => {
  return Array.from(
    { length: columnCount },
    (_, i) => String(i + 1) // '1', '2', '3', '4'
  );
};

/**
 * Generate binId in the format: {faceLetter}_bin_{column}{row}
 * @param {string} faceLetter - Face letter (A, B, C, D) - will be lowercased
 * @param {string} column - Column number (1-4)
 * @param {string} row - Row letter (a-m) - already lowercase
 * @returns {string} BinId (e.g., "a_bin_1a", "b_bin_2m")
 */
const generateBinId = (faceLetter, column, row) => {
  return `${faceLetter.toLowerCase()}_bin_${column}${row}`;
};

/**
 * Generate display name for a bin
 * @param {string} column - Column number (1-4)
 * @param {string} row - Row letter (a-m)
 * @returns {string} Display name (e.g., "A1", "M4")
 */
const generateBinDisplayName = (column, row) => {
  return `${row.toUpperCase()}${column}`;
};

/**
 * Get pod layout configuration for a specific pod type and face
 * @param {string} podType - Pod type (H8, H10, H11, H12)
 * @param {string} podFace - Pod face (A, B, C, D)
 * @returns {Object|null} Layout configuration or null if not found
 */
export const getPodLayout = (podType, podFace) => {
  if (!podType || !podFace) {
    console.warn("PodLayout: Missing podType or podFace", { podType, podFace });
    return null;
  }

  // Ensure podType and podFace are strings
  if (typeof podType !== "string" || typeof podFace !== "string") {
    console.warn("PodLayout: podType or podFace is not a string", {
      podType,
      podFace,
      podTypeType: typeof podType,
      podFaceType: typeof podFace,
    });
    return null;
  }

  const normalizedType = podType.toUpperCase();
  const normalizedFace = podFace.toUpperCase();

  const typeConfig = POD_TYPE_CONFIGS[normalizedType];
  if (!typeConfig) {
    console.warn("PodLayout: Unknown pod type", { podType: normalizedType });
    return null;
  }

  const faceConfig = typeConfig[normalizedFace];
  if (!faceConfig) {
    console.warn("PodLayout: Unknown face for pod type", {
      podType: normalizedType,
      podFace: normalizedFace,
      availableFaces: Object.keys(typeConfig),
    });
    return null;
  }

  return faceConfig;
};

/**
 * Generate complete grid structure with all bins for a pod type and face
 * @param {string} podType - Pod type (H8, H10, H11, H12)
 * @param {string} podFace - Pod face (A, B, C, D)
 * @returns {Object} Grid structure with rows, columns, and bins array
 */
export const generatePodGrid = (podType, podFace) => {
  const layout = getPodLayout(podType, podFace);

  if (!layout) {
    console.error("PodLayout: Cannot generate grid, invalid layout", {
      podType,
      podFace,
    });
    return {
      rows: [],
      columns: [],
      bins: [],
      totalBins: 0,
    };
  }

  const rows = generateRows(layout.rows);
  const columns = generateColumns(layout.columns);
  const bins = [];

  // Generate all bins for this grid
  rows.forEach((row) => {
    columns.forEach((column) => {
      const binId = generateBinId(podFace, column, row);
      const displayName = generateBinDisplayName(column, row);

      bins.push({
        binId,
        displayName,
        row,
        column,
        faceLetter: podFace.toLowerCase(),
      });
    });
  });

  return {
    rows,
    columns,
    bins,
    totalBins: bins.length,
    podType,
    podFace,
  };
};

/**
 * Get all bin IDs for a specific pod type and face
 * Useful for validation or checking if a binId exists in a layout
 * @param {string} podType - Pod type (H8, H10, H11, H12)
 * @param {string} podFace - Pod face (A, B, C, D)
 * @returns {string[]} Array of all binIds for this layout
 */
export const getAllBinIds = (podType, podFace) => {
  const grid = generatePodGrid(podType, podFace);
  return grid.bins.map((bin) => bin.binId);
};

/**
 * Check if a binId is valid for a specific pod type and face
 * @param {string} binId - BinId to check (e.g., "a_bin_1a")
 * @param {string} podType - Pod type (H8, H10, H11, H12)
 * @param {string} podFace - Pod face (A, B, C, D)
 * @returns {boolean} True if binId exists in this layout
 */
export const isValidBinId = (binId, podType, podFace) => {
  const validBinIds = getAllBinIds(podType, podFace);
  return validBinIds.includes(binId);
};

/**
 * Get bin information from a binId
 * @param {string} binId - BinId (e.g., "a_bin_1a")
 * @returns {Object|null} Parsed bin info or null if invalid format
 */
export const parseBinId = (binId) => {
  // Format: {faceLetter}_bin_{column}{row}
  // Example: a_bin_1a, b_bin_2m
  const match = binId.match(/^([a-d])_bin_(\d)([a-m])$/);

  if (!match) {
    console.warn("PodLayout: Invalid binId format", { binId });
    return null;
  }

  const [, faceLetter, column, row] = match;

  return {
    faceLetter,
    column,
    row,
    displayName: generateBinDisplayName(column, row),
    binId,
  };
};

/**
 * Get summary of all available pod layouts
 * Useful for documentation or debugging
 * @returns {Object} Summary of all pod type configurations
 */
export const getPodLayoutSummary = () => {
  const summary = {};

  Object.entries(POD_TYPE_CONFIGS).forEach(([podType, faces]) => {
    summary[podType] = {};
    Object.entries(faces).forEach(([face, config]) => {
      const totalBins = config.rows * config.columns;
      summary[podType][face] = {
        rows: config.rows,
        columns: config.columns,
        totalBins,
        gridSize: `${config.rows} rows × ${config.columns} columns`,
      };
    });
  });

  return summary;
};

/**
 * Default export - main function to get grid structure
 */
const PodLayout = {
  generatePodGrid,
  getPodLayout,
  getAllBinIds,
  isValidBinId,
  parseBinId,
  getPodLayoutSummary,
};

export default PodLayout;
