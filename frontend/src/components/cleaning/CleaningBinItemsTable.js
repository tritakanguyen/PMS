import { useMemo } from "react";

const CleaningBinItemsTable = ({
  selectedBin,
  podData,
  loading,
  isMobile = false,
}) => {
  // Filter items from stowedItems and attemptedStows based on selectedBin
  const binItems = useMemo(() => {
    if (!selectedBin || !podData) {
      return { stowedItems: [], attemptedStows: [] };
    }

    const stowedItems = (podData.stowedItems || [])
      .filter((item) => item.binId === selectedBin.binId)
      .map((item) => ({
        ...item,
        type: "stowed",
        sku: item.itemFcsku,
        status: item.status || "stowed",
      }));

    const attemptedStows = (podData.attemptedStows || [])
      .filter((item) => item.binId === selectedBin.binId)
      .map((item) => ({
        ...item,
        type: "attempted",
        sku: item.itemFcsku,
        status: item.status || "attempted",
      }));

    return { stowedItems, attemptedStows };
  }, [selectedBin, podData]);

  const allItems = useMemo(() => {
    return [...binItems.stowedItems, ...binItems.attemptedStows];
  }, [binItems]);

  const getTypeIcon = (type) => {
    if (type === "stowed") {
      return "✓";
    } else if (type === "attempted") {
      return "⚠️";
    }
    return "";
  };

  return (
    <div
      className={`bg-white rounded-lg shadow h-full flex flex-col border-2 border-green-200 ${
        isMobile ? "p-4" : "p-2"
      }`}
    >
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-800">
          🧹 Cleaning Bin Items:{" "}
          {selectedBin ? (
            <>
              {selectedBin.binName ||
                `Face ${
                  selectedBin.podFace || selectedBin.faceId || "?"
                } - Bin ${selectedBin.binId}`}
            </>
          ) : (
            ""
          )}
        </h3>
      </div>

      <div className="bg-white rounded overflow-hidden flex-1 min-h-0 overflow-y-auto border">
        {!selectedBin ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <div className="text-green-400 mb-4">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <p className="font-medium">Select a bin to view items</p>
            <p className="text-xs text-gray-400 mt-1">
              Click on a bin in the grid to see its items
            </p>
          </div>
        ) : allItems.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <div className="text-green-400 mb-4">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="font-medium text-green-600">Bin is empty</p>
            <p className="text-xs text-gray-400 mt-1">
              No items found in this bin
            </p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-2 py-1 text-left text-xs">Item FCSKU</th>
                <th className="px-2 py-1 text-justify text-xs">Stow Type</th>
                {/* <th className="px-2 py-1 text-left text-xs">Status</th> */}
                <th className="px-2 py-1 text-left text-xs">Bin ID</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {allItems.map((item, index) => (
                <tr
                  key={`${item.type}-${item.sku || item.itemFcsku}-${index}`}
                  className={`border-b border-gray-200 hover:bg-gray-50 ${
                    item.type === "stowed" ? "bg-green-50" : "bg-yellow-50"
                  }`}
                >
                  <td className="px-2 py-1">
                    <div className="text-xs font-medium">
                      {item.sku || item.itemFcsku}
                    </div>
                  </td>
                  <td className="px-2 py-1 text-left">
                    <span className="flex items-center gap-1">
                      <span className="text-sm">{getTypeIcon(item.type)}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                          item.type === "stowed"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      </span>
                    </span>
                  </td>
                  {/* <td className="px-2 py-1">
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-xs ${getStatusColor(
                        item.status,
                        item.type
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td> */}
                  <td className="px-2 py-1 text-xs text-gray-600">
                    {item.binId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom section with stats - fixed at bottom with reserved space */}
      <div className="flex-shrink-0 mt-2" style={{ minHeight: "60px" }}>
        {allItems.length > 0 && (
          <div className="text-xs text-gray-600 space-y-1">
            <div className="flex justify-between items-center">
              <p className="font-medium">Total items: {allItems.length}</p>
              {podData && (
                <p className="text-xs text-gray-500">
                  Pod: {podData.podBarcode}
                </p>
              )}
            </div>
            <div className="flex gap-4 text-xs">
              <p className="flex items-center gap-1">
                <span className="text-green-600">✓</span>
                <span>
                  Stowed:{" "}
                  <span className="font-medium">
                    {binItems.stowedItems.length}
                  </span>
                </span>
              </p>
              <p className="flex items-center gap-1">
                <span className="text-yellow-600">⚠️</span>
                <span>
                  Attempted:{" "}
                  <span className="font-medium">
                    {binItems.attemptedStows.length}
                  </span>
                </span>
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded p-2 mt-2">
              <p className="text-xs text-green-700">
                <span className="font-medium">🧹 Cleaning Instructions:</span>
                <br />
                Remove all items from this bin. Green items (✓ Stowed) should be
                in this bin. Yellow items (⚠️ Attempted) may have been placed in
                nearby bins.
              </p>
            </div>
          </div>
        )}

        {!selectedBin && (
          <div className="text-xs text-gray-400 italic text-center py-4">
            Select a bin from the grid to view cleaning details
          </div>
        )}
      </div>
    </div>
  );
};

export default CleaningBinItemsTable;
