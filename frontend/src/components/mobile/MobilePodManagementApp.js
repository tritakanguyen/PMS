import { useCallback, useEffect, useMemo, useState } from "react";
import BinItemsTable from "../BinItemsTable";
import FlipFaceButton from "../buttons/FlipFaceButton";
import ValidateButton from "../buttons/ValidateButton";
import CleaningBinGrid from "../cleaning/CleaningBinGrid";
import CleaningBinItemsTable from "../cleaning/CleaningBinItemsTable";
import CleaningCompleteModal from "../cleaning/CleaningCompleteModal";
import CleaningPodLists from "../cleaning/CleaningPodLists";
import { useStateMachine } from "../context/StateMachineContext";
import PodBarcodeInput from "../PodBarcodeInput";
import PodLists from "../PodLists";
import MobileBinGrid from "./MobileBinGrid";
import MobileHeader from "./MobileHeader";
import MobileTabNavigation from "./MobileTabNavigation";

const MobilePodManagementApp = () => {
  const { selectors } = useStateMachine();
  const isValidationState = selectors.isValidationState();

  const [selectedPodData, setSelectedPodData] = useState(null);
  const [selectedBinItems, setSelectedBinItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [selectedBin, setSelectedBin] = useState(null);
  const [currentFaceIndex, setCurrentFaceIndex] = useState(0);
  const [faceValidationStatus, setFaceValidationStatus] = useState(new Map());
  const [binValidationStatus, setBinValidationStatus] = useState(new Map());
  const [podListRefreshTrigger, setPodListRefreshTrigger] = useState(0);
  const [showCleaningCompleteModal, setShowCleaningCompleteModal] =
    useState(false);
  const [activeTab, setActiveTab] = useState("search");

  useEffect(() => {
    setSelectedBinItems([]);
  }, []);

  // Reset all selections when mode changes between cleaning and validation
  useEffect(() => {
    setSelectedPodData(null);
    setSelectedBin(null);
    setSelectedBinItems([]);
    setSuccessMessage(null);
    setError(null);
    setLoading(false);
    setCurrentFaceIndex(0);
    setFaceValidationStatus(new Map());
    setBinValidationStatus(new Map());
    setActiveTab("search"); // Reset to search tab when switching modes

    return () => {
      setLoading(false);
    };
  }, [isValidationState]);

  // Auto-dismiss success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // OPTIMIZED: Fetch bin items with caching and pagination
  const fetchBinItems = async (filters = {}, options = {}) => {
    try {
      setLoading(true);
      setError(null);

      const { limit = 1000 } = options;
      const startTime = Date.now();

      let url;

      // Use optimized pod-specific endpoint when we have podBarcode
      if (filters.podBarcode) {
        const queryParams = new URLSearchParams();
        // Add other filters except podBarcode (it's in the URL path)
        Object.entries(filters).forEach(([key, value]) => {
          if (value && key !== "podBarcode") {
            queryParams.append(key, value);
          }
        });

        // Add pagination
        if (limit) queryParams.append("limit", limit.toString());

        url = `http://localhost:5000/pods/${filters.podBarcode}/items${
          queryParams.toString() ? "?" + queryParams.toString() : ""
        }`;
      } else {
        // Fall back to general endpoint for non-pod queries
        const queryParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value) queryParams.append(key, value);
        });

        // Add pagination
        if (limit) queryParams.append("limit", limit.toString());

        url = `http://localhost:5000/items${
          queryParams.toString() ? "?" + queryParams.toString() : ""
        }`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch bin items: ${response.statusText}`);
      }

      const data = await response.json();
      const queryTime = Date.now() - startTime;

      // Show performance warnings
      if (queryTime > 1000) {
        setError(
          `Query took ${queryTime}ms - consider adding filters to improve performance`
        );
      }

      setSelectedBinItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeSearch = async (barcode) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`http://localhost:5000/pods/${barcode}`);

      if (response.ok) {
        const podData = await response.json();
        setSelectedPodData(podData);
        setCurrentFaceIndex(0);
        setSelectedBin(null);
        setSelectedBinItems([]);
        setActiveTab("grid");
      } else if (response.status === 404) {
        setError(`Pod with barcode ${barcode} not found`);
      } else {
        throw new Error(`Failed to fetch pod: ${response.statusText}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePodSelect = async (podIdentifier) => {
    try {
      setLoading(true);
      setError(null);

      if (!isValidationState) {
        // In cleaning mode, podIdentifier is the podBarcode directly

        // Fetch from cleans collection only
        const cleaningResponse = await fetch("http://localhost:5000/cleans");
        if (cleaningResponse.ok) {
          const cleaningPods = await cleaningResponse.json();
          const cleaningPod = cleaningPods.find(
            (pod) => pod.podBarcode === podIdentifier
          );

          if (cleaningPod) {
            // Use only cleaning pod data, podFace is already an array from the database
            setSelectedPodData(cleaningPod);
            setCurrentFaceIndex(0);
            setSelectedBin(null);
            setSelectedBinItems([]);
            setActiveTab("grid");
          } else {
            setError(`Cleaning pod with barcode ${podIdentifier} not found`);
          }
        } else {
          throw new Error(
            `Failed to fetch cleaning pods: ${cleaningResponse.statusText}`
          );
        }
      } else {
        // In validation mode, podIdentifier is the constructed podName

        // Find the pod by name to get its barcode
        const response = await fetch("http://localhost:5000/pods");
        if (response.ok) {
          const responseData = await response.json();
          // Handle both array response and object response with pods property
          const pods = Array.isArray(responseData)
            ? responseData
            : responseData.pods || [];
          const foundPod = pods.find(
            (pod) =>
              pod.podName + (pod.podType ? " " + pod.podType : "") ===
              podIdentifier
          );

          if (foundPod) {
            setSelectedPodData(foundPod);
            setCurrentFaceIndex(0);
            setSelectedBin(null);
            setSelectedBinItems([]);
            setActiveTab("grid");
          } else {
            setError(`Pod with name ${podIdentifier} not found`);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBinClick = async (binInfo) => {
    try {
      const updatedBinInfo = {
        ...binInfo,
        binValidated: getBinValidationStatus(binInfo),
      };

      setSelectedBin(updatedBinInfo);
      setLoading(true);
      setError(null);

      if (selectedPodData && binInfo.faceId && binInfo.binId) {
        await fetchBinItems({
          podBarcode: selectedPodData.podBarcode,
          faceId: binInfo.faceId,
          binId: binInfo.binId,
        });
      } else {
        setSelectedBinItems([
          {
            sku: `${binInfo.binName || binInfo}-001`,
            status: "available",
            quantity: 5,
          },
          {
            sku: `${binInfo.binName || binInfo}-002`,
            status: "missing",
            quantity: 2,
          },
        ]);
      }
      setActiveTab("items");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markItemAsMissing = async (sku) => {
    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:5000/items/${sku}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "missing" }),
        }
      );

      if (response.ok) {
        setSelectedBinItems((prevItems) =>
          prevItems.map((item) =>
            item.sku === sku ? { ...item, status: "missing" } : item
          )
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markItemAsAvailable = async (sku) => {
    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:5000/items/${sku}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "available" }),
        }
      );

      if (response.ok) {
        setSelectedBinItems((prevItems) =>
          prevItems.map((item) =>
            item.sku === sku ? { ...item, status: "available" } : item
          )
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markItemAsHunting = async (sku) => {
    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:5000/items/${sku}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "hunting" }),
        }
      );

      if (response.ok) {
        setSelectedBinItems((prevItems) =>
          prevItems.map((item) =>
            item.sku === sku ? { ...item, status: "hunting" } : item
          )
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchFace = () => {
    if (
      selectedPodData &&
      selectedPodData.podFace &&
      Array.isArray(selectedPodData.podFace) &&
      selectedPodData.podFace.length > 1
    ) {
      const nextIndex = (currentFaceIndex + 1) % selectedPodData.podFace.length;
      setCurrentFaceIndex(nextIndex);
      setSelectedBin(null);
      setSelectedBinItems([]);
    }
  };

  const handleToggleFaceValidation = async () => {
    if (
      selectedPodData &&
      Array.isArray(selectedPodData.podFace) &&
      selectedPodData.podFace[currentFaceIndex]
    ) {
      const currentFace = selectedPodData.podFace[currentFaceIndex];
      const faceKey = `${selectedPodData.podBarcode}-${currentFace.podFace}`;

      setFaceValidationStatus((prev) => {
        const newMap = new Map(prev);
        const currentStatus = newMap.get(faceKey) || false;
        const newStatus = !currentStatus;
        newMap.set(faceKey, newStatus);

        // Check status changes after this face validation toggle
        if (newStatus && selectedPodData.podStatus !== "completed") {
          // Face was validated - check if all faces are now validated
          const allValidated = selectedPodData.podFace.every((face) => {
            const checkFaceKey = `${selectedPodData.podBarcode}-${face.podFace}`;
            return face.podFace === currentFace.podFace
              ? newStatus
              : newMap.get(checkFaceKey) || false;
          });

          if (allValidated) {
            updatePodStatusToCompleted(selectedPodData.podBarcode);
          }
        } else if (!newStatus && selectedPodData.podStatus === "completed") {
          // Face was unvalidated and pod is currently completed - revert to in progress
          updatePodStatusToInProgress(selectedPodData.podBarcode);
        }

        return newMap;
      });
    }
  };

  const currentFaceValidationStatus = useMemo(() => {
    if (
      selectedPodData &&
      Array.isArray(selectedPodData.podFace) &&
      selectedPodData.podFace[currentFaceIndex]
    ) {
      const currentFace = selectedPodData.podFace[currentFaceIndex];
      const faceKey = `${selectedPodData.podBarcode}-${currentFace.podFace}`;
      return faceValidationStatus.get(faceKey) || false;
    }
    return false;
  }, [selectedPodData, currentFaceIndex, faceValidationStatus]);

  // Update pod status to in progress
  const updatePodStatusToInProgress = async (podBarcode) => {
    try {
      const response = await fetch(
        `http://localhost:5000/pods/${podBarcode}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ podStatus: "in progress" }),
        }
      );

      if (response.ok) {
        // Update local pod data
        setSelectedPodData((prev) =>
          prev ? { ...prev, podStatus: "in progress" } : null
        );

        // Refresh the pod lists to show the pod back in the in progress tab
        setPodListRefreshTrigger((prev) => prev + 1);

        return true;
      } else {
        throw new Error(`Failed to update pod status: ${response.statusText}`);
      }
    } catch (err) {
      console.error("Error updating pod status to in progress:", err);
      setError(err.message);
      return false;
    }
  };

  // Update pod status to completed
  const updatePodStatusToCompleted = async (podBarcode) => {
    try {
      const response = await fetch(
        `http://localhost:5000/pods/${podBarcode}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ podStatus: "completed" }),
        }
      );

      if (response.ok) {
        // Refresh the pod lists to show the pod in the completed tab
        setPodListRefreshTrigger((prev) => prev + 1);

        // Reset the pod grid to default state (no pod selected)
        setSelectedPodData(null);
        setSelectedBin(null);
        setSelectedBinItems([]);
        setCurrentFaceIndex(0);

        // Show a success message
        setError(null); // Clear any previous errors

        return true;
      } else {
        throw new Error(`Failed to update pod status: ${response.statusText}`);
      }
    } catch (err) {
      console.error("Error updating pod status:", err);
      setError(err.message);
      return false;
    }
  };

  // Handle toggle for cleaning mode complete button
  const handleToggleCleaningComplete = () => {
    if (selectedPodData) {
      setShowCleaningCompleteModal(true);
    }
  };

  // Handle confirmation of cleaning completion - removes the record from cleans collection
  const handleConfirmCleaningComplete = async () => {
    if (!selectedPodData) return;

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      // Try to get the MongoDB _id - it might be stored as _id or $oid
      let cleaningPodId = selectedPodData._id;

      // Check if _id is an object with $oid property (MongoDB extended JSON format)
      if (
        cleaningPodId &&
        typeof cleaningPodId === "object" &&
        cleaningPodId.$oid
      ) {
        cleaningPodId = cleaningPodId.$oid;
      }

      if (!cleaningPodId) {
        throw new Error(
          "Cleaning pod ID not found in selectedPodData. Please ensure the pod was loaded from the cleaning list."
        );
      }

      // Validate that it looks like either a MongoDB ObjectId (24 hex chars) or UUID
      const objectIdPattern = /^[a-f\d]{24}$/i;
      const uuidPattern =
        /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

      if (
        !objectIdPattern.test(cleaningPodId) &&
        !uuidPattern.test(cleaningPodId)
      ) {
        console.error("Invalid _id format:", cleaningPodId);
        throw new Error(
          `Invalid cleaning pod ID format. Expected ObjectId or UUID format.`
        );
      }

      const response = await fetch(
        `http://localhost:5000/cleans/${cleaningPodId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );

      // Check if response has content before parsing JSON
      const contentType = response.headers.get("content-type");
      let responseData = null;

      if (contentType && contentType.includes("application/json")) {
        try {
          responseData = await response.json();
        } catch (parseError) {
          // For successful deletes (status 200), don't fail on parse errors
          if (!response.ok) {
            await response.text();
            throw new Error("Server returned invalid JSON response");
          }
        }
      } else {
        await response.text();
      }

      if (response.ok) {
        // Close modal
        setShowCleaningCompleteModal(false);

        // Refresh the pod lists to remove the completed pod
        setPodListRefreshTrigger((prev) => prev + 1);

        // Reset the pod grid to default state (no pod selected)
        setSelectedPodData(null);
        setSelectedBin(null);
        setSelectedBinItems([]);
        setCurrentFaceIndex(0);

        // Show success message
        setSuccessMessage(
          `🎉 Pod ${selectedPodData.podBarcode} cleaning completed and removed from queue successfully!`
        );

        // Switch back to search tab
        setActiveTab("search");
      } else {
        throw new Error(
          responseData?.message ||
            `Failed to complete cleaning: ${response.statusText}`
        );
      }
    } catch (err) {
      setError(err.message);
      setShowCleaningCompleteModal(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle closing the modal
  const handleCloseCleaningModal = () => {
    setShowCleaningCompleteModal(false);
  };

  const handleBinAction = (action, binInfo) => {
    if (action === "validate" && selectedPodData && binInfo) {
      const binKey = `${selectedPodData.podBarcode}-${binInfo.faceId}-${binInfo.binId}`;
      const currentStatus = binValidationStatus.get(binKey) || false;
      const newStatus = !currentStatus;

      setBinValidationStatus((prev) => {
        const newMap = new Map(prev);
        newMap.set(binKey, newStatus);
        return newMap;
      });
    }
  };

  const getBinValidationStatus = useCallback(
    (binInfo) => {
      if (selectedPodData && binInfo) {
        const binKey = `${selectedPodData.podBarcode}-${binInfo.faceId}-${binInfo.binId}`;
        return binValidationStatus.get(binKey) || false;
      }
      return false;
    },
    [selectedPodData, binValidationStatus]
  );

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <MobileHeader />

      {/* Cleaning Complete Confirmation Modal */}
      <CleaningCompleteModal
        isOpen={showCleaningCompleteModal}
        onClose={handleCloseCleaningModal}
        onConfirm={handleConfirmCleaningComplete}
        podBarcode={selectedPodData?.podBarcode}
      />

      {/* Success Message Display - Fixed Overlay */}
      {successMessage && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 w-auto max-w-md px-4">
          <div className="p-4 bg-green-100 border-2 border-green-400 text-green-700 rounded-lg shadow-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium">{successMessage}</p>
              </div>
              <div className="ml-4">
                <button
                  onClick={() => setSuccessMessage(null)}
                  className="text-green-400 hover:text-green-600 transition-colors"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-4 mt-2 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          <div className="flex items-start">
            <div className="ml-3 flex-1">
              <p className="text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-3 text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <MobileTabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedPodData={selectedPodData}
        selectedBin={selectedBin}
      />

      <div className="flex-1 overflow-hidden">
        {activeTab === "search" && (
          <div className="p-4 space-y-4 h-full overflow-y-auto">
            {!isValidationState && (
              <div className="mb-3">
                <div className="relative bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-lg px-4 py-3 shadow-lg flex items-center">
                  <div className="relative flex items-center justify-center space-x-2 w-full">
                    <span className="text-xl animate-bounce">🧹</span>
                    <span className="text-white font-bold text-base tracking-wide drop-shadow-lg">
                      CLEANING MODE
                    </span>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <div
                        className="w-2 h-2 bg-white rounded-full animate-pulse"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-white rounded-full animate-pulse"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <PodBarcodeInput onSearch={handleBarcodeSearch} />
            <div style={{ maxHeight: "400px" }}>
              {isValidationState ? (
                <PodLists
                  onSelectPod={handlePodSelect}
                  refreshTrigger={podListRefreshTrigger}
                />
              ) : (
                <CleaningPodLists
                  onSelectPod={handlePodSelect}
                  refreshTrigger={podListRefreshTrigger}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === "grid" && (
          <div className="h-full flex flex-col">
            {isValidationState ? (
              <MobileBinGrid
                onBinClick={handleBinClick}
                podData={selectedPodData}
                selectedBin={selectedBin}
                loading={loading}
                currentFaceIndex={currentFaceIndex}
                faceValidated={currentFaceValidationStatus}
                getBinValidationStatus={getBinValidationStatus}
              />
            ) : (
              <CleaningBinGrid
                onBinClick={handleBinClick}
                podData={
                  selectedPodData && typeof selectedPodData.podFace === "string"
                    ? selectedPodData
                    : null
                }
                selectedBin={selectedBin}
                loading={loading}
                currentFaceIndex={currentFaceIndex}
                faceCleaningComplete={currentFaceValidationStatus}
                getBinCleaningStatus={getBinValidationStatus}
              />
            )}
          </div>
        )}

        {activeTab === "items" && (
          <div className="h-full">
            {isValidationState ? (
              <BinItemsTable
                selectedBin={selectedBin}
                binItems={selectedBinItems}
                onMarkMissing={markItemAsMissing}
                onMarkAvailable={markItemAsAvailable}
                onMarkHunting={markItemAsHunting}
                onAction={handleBinAction}
                loading={loading}
                faceValidated={currentFaceValidationStatus}
                isMobile={true}
              />
            ) : (
              <CleaningBinItemsTable
                selectedBin={selectedBin}
                podData={selectedPodData}
                loading={loading}
                isMobile={true}
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom control buttons - always visible */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex justify-between items-center gap-3 mb-3">
          <ValidateButton
            onClick={
              isValidationState
                ? handleToggleFaceValidation
                : handleToggleCleaningComplete
            }
            disabled={loading || activeTab === "search" || !selectedPodData}
            isValidated={currentFaceValidationStatus}
            isMobile={true}
          />

          {isValidationState && (
            <FlipFaceButton
              onClick={handleSwitchFace}
              disabled={
                loading ||
                activeTab === "search" ||
                !selectedPodData ||
                !Array.isArray(selectedPodData.podFace) ||
                selectedPodData.podFace.length <= 1
              }
              currentFaceIndex={currentFaceIndex}
              selectedPodData={selectedPodData}
              isMobile={true}
            />
          )}
        </div>

        {selectedPodData &&
          selectedPodData.podFace &&
          (Array.isArray(selectedPodData.podFace)
            ? selectedPodData.podFace.length > 0
            : typeof selectedPodData.podFace === "string") && (
            <div className="text-center text-sm text-gray-600">
              <span className={isValidationState ? "" : "text-green-600"}>
                {isValidationState ? "Current Face:" : "🧹 Cleaning Face:"}
              </span>{" "}
              <span className="font-medium">
                {isValidationState && Array.isArray(selectedPodData.podFace)
                  ? selectedPodData.podFace[currentFaceIndex]?.podFace
                  : !isValidationState &&
                    typeof selectedPodData.podFace === "string"
                  ? selectedPodData.podFace
                  : "N/A"}
              </span>
              {isValidationState &&
                Array.isArray(selectedPodData.podFace) &&
                selectedPodData.podFace[currentFaceIndex] && (
                  <span className="ml-2">
                    ({selectedPodData.podFace[currentFaceIndex].faceItemTotal}{" "}
                    items, GCU: {selectedPodData.podFace[currentFaceIndex].gcu})
                  </span>
                )}
              {!isValidationState &&
                typeof selectedPodData.podFace === "string" &&
                selectedPodData.totalItems && (
                  <span className="ml-2">
                    ({selectedPodData.totalItems} items)
                  </span>
                )}
            </div>
          )}
      </div>
    </div>
  );
};

export default MobilePodManagementApp;
