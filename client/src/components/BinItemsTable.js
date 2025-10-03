import BinValidateButton from "./buttons/BinValidateButton";
import ExportItemsButton from "./buttons/ExportItemsButton";
import FlagIssuesButton from "./buttons/FlagIssuesButton";
import MarkAvailableButton from "./buttons/MarkAvailableButton";
import MarkHuntingButton from "./buttons/MarkHuntingButton";
import MarkMissingButton from "./buttons/MarkMissingButton";
import ViewDetailsButton from "./buttons/ViewDetailsButton";

const BinItemsTable = ({
  selectedBin,
  binItems,
  onMarkMissing,
  onMarkAvailable,
  onMarkHunting,
  onAction,
  loading,
  faceValidated = false,
  isMobile = false,
}) => {
  const getStatusColor = (status) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800";
      case "missing":
        return "bg-red-100 text-red-800";
      case "hunting":
        return "bg-yellow-100 text-yellow-800";
      case "validated":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Check if the bin is validated either individually or through face validation
  const isValidated =
    (selectedBin && selectedBin.binValidated) || faceValidated;

  // Check if item actions should be disabled (either bin or face is validated)
  const actionsDisabled = isValidated;

  return (
    <div
      className={`bg-white rounded-lg shadow h-full flex flex-col ${
        isMobile ? "p-4" : "p-2"
      }`}
    >
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-800">
          Active bin:{" "}
          {selectedBin ? (
            <>
              {selectedBin.binName ||
                `Face ${selectedBin.faceId} - Bin ${selectedBin.binId}`}
              {isValidated && (
                <span className="ml-1 text-green-600 text-xs">✓ Validated</span>
              )}
            </>
          ) : (
            ""
          )}
        </h3>
      </div>
      <div className="bg-white rounded overflow-hidden flex-1 min-h-0 overflow-y-auto border">
        {!selectedBin ? (
          <div className="p-2 text-center text-gray-500 text-sm">
            Select a bin to view items
          </div>
        ) : binItems.length === 0 ? (
          <div className="p-2 text-center text-gray-500 text-sm">
            {selectedBin.itemCount > 0
              ? "No item details available for this bin"
              : "This bin is empty"}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-2 py-1 text-left text-xs">SKU</th>
                <th className="px-2 py-1 text-left text-xs">Status</th>
                <th className="px-2 py-1 text-left text-xs">Qty</th>
                {binItems.some((item) => item.price) && (
                  <th className="px-2 py-1 text-left text-xs">Price</th>
                )}
                <th className="px-2 py-1 text-left text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {binItems.map((item, index) => (
                <tr
                  key={item.sku || item.fnsku || item._id || index}
                  className={`border-b border-gray-200 hover:bg-gray-50 ${
                    item.status === "validated" ? "bg-green-50" : ""
                  }`}
                >
                  <td className="px-2 py-1">
                    <div className="text-xs font-medium">
                      {item.sku || item.fnsku}
                    </div>
                    {item.asin && (
                      <div className="text-xs text-gray-500">
                        ASIN: {item.asin}
                      </div>
                    )}
                    {item.binId && item.faceId && (
                      <div className="text-xs text-gray-500">
                        {item.faceId} - Bin {item.binId}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <span
                      className={`px-1 py-0.5 rounded-full text-xs ${getStatusColor(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-xs">{item.quantity || 1}</td>
                  <td className="px-2 py-1">
                    <div className="flex gap-2">
                      <MarkMissingButton
                        onClick={onMarkMissing}
                        disabled={actionsDisabled}
                        item={item}
                        showCondition={item.status !== "missing"}
                        actionsDisabled={actionsDisabled}
                      />

                      <MarkAvailableButton
                        onClick={onMarkAvailable}
                        disabled={actionsDisabled}
                        item={item}
                        showCondition={
                          item.status !== "available" && onMarkAvailable
                        }
                        actionsDisabled={actionsDisabled}
                      />

                      <MarkHuntingButton
                        onClick={onMarkHunting}
                        disabled={actionsDisabled}
                        item={item}
                        showCondition={
                          item.status !== "hunting" && onMarkHunting
                        }
                        actionsDisabled={actionsDisabled}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom section with stats and actions - fixed at bottom with reserved space */}
      <div className="flex-shrink-0 mt-2" style={{ minHeight: "80px" }}>
        {binItems.length > 0 && (
          <div className="text-xs text-gray-600">
            <p>Total items: {binItems.length}</p>
            <p>
              Available:{" "}
              {binItems.filter((item) => item.status === "available").length} |
              Missing:{" "}
              {binItems.filter((item) => item.status === "missing").length} |
              Hunting:{" "}
              {binItems.filter((item) => item.status === "hunting").length}
            </p>
            {actionsDisabled && (
              <p className="text-orange-600 font-medium text-xs">
                ⚠️{" "}
                {selectedBin && selectedBin.binValidated && faceValidated
                  ? "Bin and Face are validated"
                  : selectedBin && selectedBin.binValidated
                  ? "Bin is validated"
                  : "Face is validated"}{" "}
                - Item status cannot be modified
              </p>
            )}
          </div>
        )}

        {/* Additional action buttons for bin management - always reserve space */}
        <div
          className="mt-2 flex gap-2 flex-wrap"
          style={{ minHeight: "28px" }}
        >
          {selectedBin && onAction ? (
            <>
              <BinValidateButton
                onClick={onAction}
                selectedBin={selectedBin}
                isValidated={isValidated}
              />

              <FlagIssuesButton onClick={onAction} selectedBin={selectedBin} />

              <ViewDetailsButton onClick={onAction} selectedBin={selectedBin} />

              <ExportItemsButton
                onClick={onAction}
                selectedBin={selectedBin}
                binItems={binItems}
                showCondition={binItems && binItems.length > 0}
              />
            </>
          ) : (
            <div className="text-xs text-gray-400 italic"></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BinItemsTable;
