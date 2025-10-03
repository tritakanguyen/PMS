import { useMemo } from "react";

const BinSquaresGrid = ({
  onBinClick,
  podData,
  selectedBin,
  loading,
  currentFaceIndex = 0,
  faceValidated = false,
  getBinValidationStatus,
}) => {
  const currentFace =
    podData &&
    podData.podFace &&
    Array.isArray(podData.podFace) &&
    podData.podFace[currentFaceIndex];

  // Memoize the grid structure calculation to prevent recalculation on every render
  const gridStructure = useMemo(() => {
    // Safety check: ensure we have valid data structure
    if (!currentFace || !currentFace.bins || !Array.isArray(currentFace.bins)) {
      return { rows: [], columns: [], binMap: {} };
    }

    const binMap = {};
    const rowSet = new Set();
    const colSet = new Set();

    currentFace.bins.forEach((bin) => {
      binMap[bin.binId] = bin;
      // Extract row and column from new binId format: "a_bin_1a" -> column="1", row="a"
      // Split by "_bin_" and extract column+row from the last part
      const parts = bin.binId.split("_bin_");
      if (parts.length === 2) {
        const columnRow = parts[1]; // e.g., "1a"
        // Extract column (all digits) and row (last letter)
        const match = columnRow.match(/^(\d+)([a-z])$/);
        if (match) {
          const col = match[1]; // "1"
          const row = match[2]; // "a"
          rowSet.add(row);
          colSet.add(col);
        }
      }
    });

    // Sort rows (A-Z) and columns (1-999)
    // Reverse rows so A starts from bottom
    const rows = Array.from(rowSet).sort().reverse();
    const columns = Array.from(colSet).sort(
      (a, b) => parseInt(a) - parseInt(b)
    );

    return { rows, columns, binMap };
  }, [currentFace]); // Only recalculate when currentFace changes

  const { rows, columns, binMap } = gridStructure;

  return (
    <div className="bg-white p-2 rounded-lg shadow w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-800 flex-1">
          {podData ? (
            <span>
              Pod {podData.podName} {currentFace ? currentFace.podFace : ""}
              {faceValidated && (
                <span className="ml-2 text-green-600">✓ Face Validated</span>
              )}
            </span>
          ) : (
            "Bin Grid"
          )}
        </h3>
        <div className="flex items-center gap-2">
          {podData && (
            <div className="text-sm font-medium text-gray-700">
              Current pod: {podData.podBarcode}
            </div>
          )}
          {loading && <div className="text-sm text-gray-500">Loading...</div>}
        </div>
      </div>
      {/* Show message when no pod is selected */}
      {!podData ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h4 className="text-lg font-medium text-gray-700 mb-2">
            No Pod Selected
          </h4>
          <p className="text-gray-500 max-w-md">
            Please select a pod from the pod list on the left or search for a
            pod using the barcode input to view the bin grid.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-hidden">
            <div
              className={`grid gap-1 h-full w-full`}
              style={{
                gridTemplateColumns: `auto repeat(${columns.length}, 1fr)`,
                gridTemplateRows: `repeat(${rows.length}, 1fr)`,
              }}
            >
              {/* Generate rows with labels and bins */}
              {rows
                .map((row) => [
                  // Row label
                  <div
                    key={`row-${row}`}
                    className="flex items-center justify-center font-medium text-gray-600 text-xs"
                  >
                    {row}
                  </div>,
                  // Bins for this row
                  ...columns.map((col) => {
                    // Construct the new binId format: "a_bin_1a"
                    const faceLetter = currentFace
                      ? currentFace.podFace.toLowerCase()
                      : "a";
                    const binId = `${faceLetter}_bin_${col}${row}`;
                    const bin = binMap[binId];
                    const displayName = `${row.toUpperCase()}${col}`; // Display as "A1" for user readability
                    const binInfo = {
                      binId: binId,
                      faceId: currentFace ? currentFace.podFace : "unknown",
                      binName: displayName,
                      itemCount: bin
                        ? bin.binItemCount || 0
                        : podData
                        ? 0
                        : Math.floor(Math.random() * 5),
                      podBarcode: podData ? podData.podBarcode : "demo",
                      binValidated: getBinValidationStatus
                        ? getBinValidationStatus({
                            binId: binId,
                            faceId: currentFace
                              ? currentFace.podFace
                              : "unknown",
                          })
                        : bin
                        ? bin.binValidated || false
                        : false,
                    };

                    const isSelected =
                      selectedBin &&
                      selectedBin.binId === binId &&
                      selectedBin.faceId === binInfo.faceId;

                    let colorClasses;
                    if (isSelected) {
                      colorClasses = "bg-blue-400 border-blue-600 text-white";
                    } else if (binInfo.binValidated) {
                      colorClasses =
                        "bg-green-300 border-green-400 hover:bg-green-200";
                    } else if (binInfo.itemCount > 0) {
                      colorClasses =
                        "bg-yellow-300 border-yellow-400 hover:bg-yellow-200";
                    } else {
                      colorClasses =
                        "bg-gray-200 border-gray-300 hover:bg-gray-100";
                    }

                    return (
                      <div
                        key={binId}
                        className={`border p-1 text-xs cursor-pointer transition-colors flex justify-center items-center w-full h-full ${colorClasses} ${
                          loading ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        style={{ minHeight: "35px", minWidth: "35px" }}
                        onClick={() => !loading && onBinClick(binInfo)}
                      >
                        <div className="flex items-center gap-1">
                          <div className="text-xs leading-none font-medium">
                            {binInfo.binName}
                          </div>
                          <div className="text-xs leading-none text-gray-400">
                            |
                          </div>
                          <div
                            className={`text-xs leading-none ${
                              isSelected ? "text-blue-100" : "text-gray-700"
                            }`}
                          >
                            {binInfo.itemCount}
                          </div>
                          {binInfo.binValidated && (
                            <>
                              <div className="text-xs leading-none text-gray-400">
                                |
                              </div>
                              <div
                                className={`text-xs leading-none ${
                                  isSelected
                                    ? "text-blue-100"
                                    : "text-green-600"
                                }`}
                              >
                                ✓
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }),
                ])
                .flat()}
            </div>
          </div>
        </div>
      )}

      {currentFace && (
        <div className="mt-2 text-xs text-gray-500 flex-shrink-0">
          <div className="flex gap-4 mt-1">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-300 border border-green-400 rounded"></div>
              Validated
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-300 border border-yellow-400 rounded"></div>
              Pending
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-200 border border-gray-300 rounded"></div>
              Empty
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BinSquaresGrid;
