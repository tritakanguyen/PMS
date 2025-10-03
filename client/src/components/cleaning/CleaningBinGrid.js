import { useMemo } from "react";
import { generatePodGrid } from "../../utils/PodLayout";

const CleaningBinGrid = ({
  onBinClick,
  podData,
  selectedBin,
  loading,
  currentFaceIndex = 0,
  faceCleaningComplete = false,
  getBinCleaningStatus,
}) => {
  // Extract current face - Clean collection has podFace as a String (e.g., "A", "B", "C")
  const currentFace = useMemo(() => {
    if (!podData) {
      return null;
    }

    // In Clean collection, podFace is a simple string like "A", "B", "C", "D"
    const podFace = podData.podFace || "A";

    // Return normalized face object for grid generation
    return {
      podFace: podFace,
      bins: [], // Clean collection doesn't have bin data, use PodLayout instead
      gcu: "0%",
      faceItemTotal: podData.totalItems || 0,
    };
  }, [podData]);

  // Calculate item counts from stowedItems in cleaning data
  const binItemCounts = useMemo(() => {
    if (!podData || !podData.stowedItems) {
      return {};
    }

    const counts = {};
    podData.stowedItems.forEach((item) => {
      if (item.binId) {
        counts[item.binId] = (counts[item.binId] || 0) + 1;
      }
    });

    return counts;
  }, [podData]);

  // Get bins that appear in attemptedStows for ambient coloring
  const attemptedStowBins = useMemo(() => {
    if (!podData || !podData.attemptedStows) {
      return new Set();
    }

    return new Set(
      podData.attemptedStows.map((item) => item.binId).filter(Boolean)
    );
  }, [podData]);

  // Generate grid structure using PodLayout module
  const podGrid = useMemo(() => {
    // If we don't have podData or currentFace, return empty grid
    if (!podData || !currentFace) {
      return { rows: [], columns: [], bins: [] };
    }

    // Get podType and podFace
    const podType = podData.podType || "H8";
    const podFace = currentFace.podFace || "A";

    // Use PodLayout module to generate the complete grid with bins
    const grid = generatePodGrid(podType, podFace);

    return grid;
  }, [podData, currentFace]);

  // Extract rows, columns, and bins from the generated pod grid
  const { rows, columns, bins: gridBins } = podGrid;

  // Create binMap for quick lookup - bins from PodLayout with item counts applied
  const binMap = useMemo(() => {
    const map = {};

    // Create a map of all bins from the grid layout
    if (gridBins && Array.isArray(gridBins)) {
      gridBins.forEach((bin) => {
        map[bin.binId] = {
          binId: bin.binId,
          displayName: bin.displayName,
          row: bin.row,
          column: bin.column,
          itemCount: binItemCounts[bin.binId] || 0,
          isAttemptedStow: attemptedStowBins.has(bin.binId),
        };
      });
    }

    return map;
  }, [gridBins, binItemCounts, attemptedStowBins]);

  return (
    <div className="bg-white p-2 rounded-lg shadow w-full h-full flex flex-col border-2 border-green-200">
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-800 flex-1">
          {podData ? (
            <span>
              🧹 {podData.podName || podData.podBarcode} {podData.podType}
              {currentFace && currentFace.podFace && `-${currentFace.podFace}`}
              {faceCleaningComplete && (
                <span className="ml-2 text-green-600">✓ Face Complete</span>
              )}
            </span>
          ) : (
            "🧹Bin Grid"
          )}
        </h3>
        <div className="flex items-center gap-2">
          {podData && (
            <div className="text-sm font-medium text-gray-700">
              Pod Barcode: {podData.podBarcode}
            </div>
          )}
        </div>
      </div>
      {/* Show message when no pod is selected */}
      {!podData ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="text-green-400 mb-4">
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
            Please select a used pod from the cleaning pod list on the left.
          </p>
        </div>
      ) : !currentFace ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="text-yellow-400 mb-4">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h4 className="text-lg font-medium text-gray-700 mb-2">
            No Face Data Available
          </h4>
          <p className="text-gray-500 max-w-md mb-2">
            The selected pod doesn't have valid face data.
          </p>
          <p className="text-sm text-gray-400 font-mono">
            Pod: {podData.podBarcode} | Type: {podData.podType}
          </p>
        </div>
      ) : rows.length === 0 || columns.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="text-red-400 mb-4">
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
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h4 className="text-lg font-medium text-gray-700 mb-2">
            Cannot Generate Grid
          </h4>
          <p className="text-gray-500 max-w-md mb-2">
            Unable to generate bin grid for this pod configuration.
          </p>
          <p className="text-sm text-gray-400 font-mono">
            Pod: {podData.podBarcode} | Type: {podData.podType}
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
                    // Construct binId using the same format as PodLayout
                    const faceLetter = currentFace
                      ? currentFace.podFace.toLowerCase()
                      : "a";
                    const binId = `${faceLetter}_bin_${col}${row}`;

                    // Get bin data from binMap (created from PodLayout)
                    const bin = binMap[binId];

                    if (!bin) {
                      return null;
                    }

                    // Use data from binMap (which includes item counts)
                    const displayName = bin.displayName;
                    const itemCount = bin.itemCount;
                    const isAttemptedStow = bin.isAttemptedStow;

                    // Build bin info for click handler
                    const binInfo = {
                      binId: binId,
                      faceId: currentFace ? currentFace.podFace : "unknown",
                      binName: displayName,
                      itemCount: itemCount,
                      podBarcode: podData ? podData.podBarcode : "demo",
                      binCleaned: getBinCleaningStatus
                        ? getBinCleaningStatus({
                            binId: binId,
                            faceId: currentFace
                              ? currentFace.podFace
                              : "unknown",
                          })
                        : false,
                      binValidated: false,
                      isAttemptedStow: isAttemptedStow,
                    };

                    const isSelected =
                      selectedBin &&
                      selectedBin.binId === binId &&
                      selectedBin.faceId === binInfo.faceId;

                    let colorClasses;
                    let statusIcon = "";

                    if (isSelected) {
                      colorClasses = "bg-green-400 border-green-600 text-white";
                    } else if (itemCount > 0) {
                      // Has items - red color
                      colorClasses =
                        "bg-red-200 border-red-300 hover:bg-red-100";
                      statusIcon = "";
                    } else if (isAttemptedStow) {
                      // Bins nearby (in attemptedStows) - ambient color
                      colorClasses =
                        "bg-yellow-200 border-yellow-300 hover:bg-yellow-100";
                      statusIcon = "⚠️";
                    } else {
                      // Empty bins - gray color
                      colorClasses =
                        "bg-gray-200 border-gray-300 hover:bg-gray-100";
                    }

                    return (
                      <div
                        key={binId}
                        className={`border-2 p-1 text-xs cursor-pointer transition-colors flex justify-center items-center w-full h-full ${colorClasses} ${
                          loading ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        style={{ minHeight: "35px", minWidth: "35px" }}
                        onClick={() => !loading && onBinClick(binInfo)}
                      >
                        <div className="flex items-center gap-1">
                          <div className="text-xs leading-none font-medium">
                            {displayName}
                          </div>
                          <div className="text-xs leading-none text-gray-400">
                            |
                          </div>
                          <div
                            className={`text-xs leading-none ${
                              isSelected ? "text-green-100" : "text-gray-700"
                            }`}
                          >
                            {itemCount}
                          </div>
                          {statusIcon && (
                            <>
                              <div className="text-xs leading-none text-gray-400">
                                |
                              </div>
                              <div
                                className={`text-xs leading-none ${
                                  isSelected
                                    ? "text-green-100"
                                    : "text-gray-600"
                                }`}
                              >
                                {statusIcon}
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
          <div className="flex gap-4 mt-1 flex-wrap">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-200 border-2 border-red-300 rounded"></div>
              Has Items
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-200 border-2 border-yellow-300 rounded"></div>
              Attempted Stows
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-200 border-2 border-gray-300 rounded"></div>
              Empty
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleaningBinGrid;
