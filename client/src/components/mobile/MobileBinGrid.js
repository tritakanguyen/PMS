import { useMemo } from "react";

const MobileBinGrid = ({
  onBinClick,
  podData,
  selectedBin,
  loading,
  currentFaceIndex = 0,
  faceValidated = false,
  getBinValidationStatus,
}) => {
  // Ensure we're working with validation mode data (podFace is an array)
  const currentFace =
    podData &&
    podData.podFace &&
    Array.isArray(podData.podFace) &&
    podData.podFace[currentFaceIndex];

  const gridStructure = useMemo(() => {
    if (!currentFace || !currentFace.bins) {
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

    const rows = Array.from(rowSet).sort().reverse();
    const columns = Array.from(colSet).sort(
      (a, b) => parseInt(a) - parseInt(b)
    );

    return { rows, columns, binMap };
  }, [currentFace]);

  const { rows, columns, binMap } = gridStructure;

  return (
    <div className="bg-white flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-800">
            {podData && Array.isArray(podData.podFace) && currentFace ? (
              <span>
                {podData.podName} {currentFace.podFace}
                {faceValidated && (
                  <span className="ml-2 text-green-600 text-sm">
                    ✓ Validated
                  </span>
                )}
              </span>
            ) : (
              "Bin Grid"
            )}
          </h3>
          {loading && <div className="text-sm text-gray-500">Loading...</div>}
        </div>
        {podData && Array.isArray(podData.podFace) && (
          <div className="text-sm text-gray-600 mt-1">
            Pod: {podData.podBarcode}
          </div>
        )}
      </div>

      {!podData || !Array.isArray(podData.podFace) ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
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
          <p className="text-gray-500 text-sm">
            Search for a pod or select one from the list to view the bin grid.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          <div
            className="grid gap-2 min-h-full"
            style={{
              gridTemplateColumns: `auto repeat(${columns.length}, minmax(50px, 1fr))`,
              gridTemplateRows: `repeat(${rows.length}, minmax(50px, auto))`,
            }}
          >
            {rows
              .map((row) => [
                <div
                  key={`row-${row}`}
                  className="flex items-center justify-center font-bold text-gray-700 text-sm"
                >
                  {row}
                </div>,
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
                    itemCount: bin ? bin.binItemCount || 0 : 0,
                    podBarcode: podData ? podData.podBarcode : "demo",
                    binValidated: getBinValidationStatus
                      ? getBinValidationStatus({
                          binId: binId,
                          faceId: currentFace ? currentFace.podFace : "unknown",
                        })
                      : false,
                  };

                  const isSelected =
                    selectedBin &&
                    selectedBin.binId === binId &&
                    selectedBin.faceId === binInfo.faceId;

                  let colorClasses;
                  if (isSelected) {
                    colorClasses = "bg-blue-500 border-blue-600 text-white";
                  } else if (binInfo.binValidated) {
                    colorClasses = "bg-green-400 border-green-500 text-white";
                  } else if (binInfo.itemCount > 0) {
                    colorClasses =
                      "bg-yellow-400 border-yellow-500 text-gray-800";
                  } else {
                    colorClasses = "bg-gray-200 border-gray-300 text-gray-700";
                  }

                  return (
                    <button
                      key={binId}
                      className={`border-2 rounded-lg p-2 text-sm font-medium transition-all duration-200 active:scale-95 ${colorClasses} ${
                        loading
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:shadow-md"
                      }`}
                      style={{ minHeight: "50px", minWidth: "50px" }}
                      onClick={() => !loading && onBinClick(binInfo)}
                      disabled={loading}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-xs font-bold">
                          {binInfo.binName}
                        </div>
                        <div className="text-xs">{binInfo.itemCount}</div>
                        {binInfo.binValidated && (
                          <div className="text-xs">✓</div>
                        )}
                      </div>
                    </button>
                  );
                }),
              ])
              .flat()}
          </div>
        </div>
      )}

      {currentFace && (
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex justify-center gap-6 text-xs">
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-400 border border-green-500 rounded"></div>
              Validated
            </span>
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-400 border border-yellow-500 rounded"></div>
              Pending
            </span>
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 border border-gray-300 rounded"></div>
              Empty
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileBinGrid;
