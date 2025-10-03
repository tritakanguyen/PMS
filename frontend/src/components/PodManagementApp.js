import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import BinItemsTable from "./BinItemsTable";
import BinSquaresGrid from "./BinSquaresGrid";
import FlipFaceButton from "./buttons/FlipFaceButton";
import SaveToDatabaseButton from "./buttons/SaveToDatabaseButton";
import ValidateButton from "./buttons/ValidateButton";
import CleaningBinGrid from "./cleaning/CleaningBinGrid";
import CleaningBinItemsTable from "./cleaning/CleaningBinItemsTable";
import CleaningCompleteModal from "./cleaning/CleaningCompleteModal";
import CleaningPodLists from "./cleaning/CleaningPodLists";
import { useStateMachine } from "./context/StateMachineContext";
import Header from "./header";
import PodBarcodeInput from "./PodBarcodeInput";
import PodLists from "./PodLists";

const PodManagementApp = () => {
  const { selectors } = useStateMachine();
  const isValidationState = selectors.isValidationState();

  const [selectedPodData, setSelectedPodData] = useState(null);
  const [selectedBinItems, setSelectedBinItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [selectedBin, setSelectedBin] = useState(null);
  const [currentFaceIndex, setCurrentFaceIndex] = useState(0);
  const [faceValidationStatus, setFaceValidationStatus] = useState(new Map()); // Map of podBarcode-faceId to validation status
  const [binValidationStatus, setBinValidationStatus] = useState(new Map()); // Map of podBarcode-faceId-binId to validation status
  const [podListRefreshTrigger, setPodListRefreshTrigger] = useState(0); // Trigger to refresh pod lists
  const [showCleaningCompleteModal, setShowCleaningCompleteModal] =
    useState(false); // Modal state for cleaning completion confirmation

  // Load initial bin items - start with empty items
  useEffect(() => {
    // Don't fetch any items initially - wait for user to select a bin
    setSelectedBinItems([]);
  }, []);

  // Reset all selections when mode changes between cleaning and validation
  useEffect(() => {
    // Clear all state immediately when switching modes
    setSelectedPodData(null);
    setSelectedBin(null);
    setSelectedBinItems([]);
    setSuccessMessage(null);
    setError(null);
    setLoading(false);
    setCurrentFaceIndex(0);

    // Return cleanup function to ensure no pending operations
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

      // Cleanup timer if component unmounts or successMessage changes
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
      console.error("Error fetching bin items:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle barcode search
  const handleBarcodeSearch = async (barcode) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`http://localhost:5000/pods/${barcode}`);

      if (response.ok) {
        const podData = await response.json();
        setSelectedPodData(podData);
        setCurrentFaceIndex(0);

        // Clear bin selection and items when selecting a new pod
        setSelectedBin(null);
        setSelectedBinItems([]);
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

  // Handle pod selection from list
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
            // Clear bin selection and items when selecting a new pod
            setSelectedBin(null);
            setSelectedBinItems([]);
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

  // Handle bin click from grid
  const handleBinClick = async (binInfo) => {
    try {
      // Update binInfo with current validation status
      const updatedBinInfo = {
        ...binInfo,
        binValidated: getBinValidationStatus(binInfo),
      };

      setSelectedBin(updatedBinInfo);
      setLoading(true);
      setError(null);

      if (selectedPodData && binInfo.faceId && binInfo.binId) {
        // Fetch items for specific bin
        await fetchBinItems({
          podBarcode: selectedPodData.podBarcode,
          faceId: binInfo.faceId,
          binId: binInfo.binId,
        });
      } else {
        // Show mock data if no pod is selected
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
          {
            sku: `${binInfo.binName || binInfo}-003`,
            status: "available",
            quantity: 8,
          },
        ]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mark item as missing
  const markItemAsMissing = async (sku) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `http://localhost:5000/items/${sku}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "missing" }),
        }
      );

      if (response.ok) {
        await response.json();

        // Update the local state with the updated item
        setSelectedBinItems((prevItems) =>
          prevItems.map((item) =>
            item.sku === sku ? { ...item, status: "missing" } : item
          )
        );
      } else {
        throw new Error(`Failed to update item status: ${response.statusText}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Additional utility functions
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
        await response.json();
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
        await response.json();
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

  // Handle switching between pod faces
  const handleSwitchFace = () => {
    if (
      selectedPodData &&
      selectedPodData.podFace &&
      Array.isArray(selectedPodData.podFace) &&
      selectedPodData.podFace.length > 1
    ) {
      const nextIndex = (currentFaceIndex + 1) % selectedPodData.podFace.length;
      setCurrentFaceIndex(nextIndex);
      setSelectedBin(null); // Clear selected bin when switching faces
      setSelectedBinItems([]); // Clear bin items when switching faces
    }
  };

  // Handle toggling pod face validation status
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

  // Get current face validation status - memoized to prevent re-calculations
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

        // You could add a toast notification here if you have a toast system
        // Temporary notification - you can replace with a better UI component

        return true;
      } else {
        throw new Error(`Failed to update pod status: ${response.statusText}`);
      }
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  // Handle bin actions
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

      // Update the selected bin's validation status if it's the currently selected bin
      if (
        selectedBin &&
        selectedBin.binId === binInfo.binId &&
        selectedBin.faceId === binInfo.faceId
      ) {
        setSelectedBin((prevBin) => ({
          ...prevBin,
          binValidated: newStatus,
        }));
      }
    }

    // TODO: Implement other bin actions (flag, details, export)
  };

  // Get bin validation status - memoized to prevent grid re-renders
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

  // Handle saving to database (placeholder for future implementation)
  const handleSaveToDatabase = () => {
    if (selectedPodData) {
      // TODO: Implement database save functionality
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

  return (
    <div
      className="bg-gray-50 p-1 w-full overflow-hidden"
      style={{ height: "800px", maxHeight: "800px" }}
    >
      <Fragment>
        <Header />

        {/* Cleaning Complete Confirmation Modal */}
        <CleaningCompleteModal
          isOpen={showCleaningCompleteModal}
          onClose={handleCloseCleaningModal}
          onConfirm={handleConfirmCleaningComplete}
          podBarcode={selectedPodData?.podBarcode}
        />

        {/* Success Message Display - Fixed Overlay */}
        {successMessage && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-auto max-w-md">
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

        {/* Error Display */}
        {error && (
          <div className="mb-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-4 w-4 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <svg
                    className="h-4 w-4"
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
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 max-w-none h-full">
          {isValidationState ? (
            <>
              {/* Validation State Components */}
              <div
                className="space-y-1 flex flex-col"
                style={{ height: "720px" }}
              >
                <div className="flex-shrink-0">
                  <PodBarcodeInput onSearch={handleBarcodeSearch} />
                </div>
                <div className="flex-shrink-0" style={{ height: "300px" }}>
                  <PodLists
                    onSelectPod={handlePodSelect}
                    refreshTrigger={podListRefreshTrigger}
                  />
                </div>
                <div className="flex-1 min-h-0">
                  <BinItemsTable
                    selectedBin={selectedBin}
                    binItems={selectedBinItems}
                    onMarkMissing={markItemAsMissing}
                    onMarkAvailable={markItemAsAvailable}
                    onMarkHunting={markItemAsHunting}
                    onAction={handleBinAction}
                    loading={loading}
                    faceValidated={currentFaceValidationStatus}
                  />
                </div>
              </div>
              <div
                className="space-y-1 flex flex-col"
                style={{ height: "720px" }}
              >
                <div className="flex-1 min-h-0">
                  <BinSquaresGrid
                    onBinClick={handleBinClick}
                    podData={
                      selectedPodData && Array.isArray(selectedPodData.podFace)
                        ? selectedPodData
                        : null
                    }
                    selectedBin={selectedBin}
                    loading={loading}
                    currentFaceIndex={currentFaceIndex}
                    faceValidated={currentFaceValidationStatus}
                    getBinValidationStatus={getBinValidationStatus}
                  />
                </div>

                {/* Control Buttons - Validation State Only */}
                {selectedPodData && (
                  <div className="bg-white p-2 rounded-lg shadow">
                    <div className="flex justify-between items-center gap-2">
                      <ValidateButton
                        onClick={handleToggleFaceValidation}
                        disabled={loading}
                        isValidated={currentFaceValidationStatus}
                      />

                      <FlipFaceButton
                        onClick={handleSwitchFace}
                        disabled={
                          loading ||
                          !selectedPodData ||
                          !Array.isArray(selectedPodData.podFace) ||
                          selectedPodData.podFace.length <= 1
                        }
                        currentFaceIndex={currentFaceIndex}
                        selectedPodData={selectedPodData}
                      />

                      <SaveToDatabaseButton
                        onClick={handleSaveToDatabase}
                        disabled={loading || !currentFaceValidationStatus}
                        isEnabled={currentFaceValidationStatus}
                      />
                    </div>

                    {/* Current Face Indicator */}
                    {selectedPodData &&
                      Array.isArray(selectedPodData.podFace) &&
                      selectedPodData.podFace.length > 0 && (
                        <div className="mt-2 text-center text-xs text-gray-600">
                          Current Face:{" "}
                          <span className="font-medium">
                            {selectedPodData.podFace[currentFaceIndex]?.podFace}
                          </span>
                          {selectedPodData.podFace[currentFaceIndex] && (
                            <span className="ml-2">
                              (
                              {
                                selectedPodData.podFace[currentFaceIndex]
                                  .faceItemTotal
                              }{" "}
                              items, GCU:{" "}
                              {selectedPodData.podFace[currentFaceIndex].gcu})
                            </span>
                          )}
                        </div>
                      )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Cleaning State */
            <>
              <div
                className="space-y-1 flex flex-col"
                style={{ height: "720px" }}
              >
                <div className="flex-shrink-0 mb-1" style={{ height: "35px" }}>
                  <div className="relative bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-lg px-3 py-1.5 shadow-lg h-full flex items-center">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 rounded-lg opacity-0"></div>
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
                <div className="flex-shrink-0" style={{ height: "330px" }}>
                  <CleaningPodLists
                    onSelectPod={handlePodSelect}
                    refreshTrigger={podListRefreshTrigger}
                  />
                </div>
                <div className="flex-1 min-h-0">
                  <CleaningBinItemsTable
                    selectedBin={selectedBin}
                    podData={selectedPodData}
                    loading={loading}
                  />
                </div>
              </div>
              <div
                className="space-y-1 flex flex-col"
                style={{ height: "720px" }}
              >
                <div className="flex-1 min-h-0">
                  <CleaningBinGrid
                    onBinClick={handleBinClick}
                    podData={
                      selectedPodData &&
                      (typeof selectedPodData.podFace === "string" ||
                        !selectedPodData.podFace ||
                        !Array.isArray(selectedPodData.podFace))
                        ? selectedPodData
                        : null
                    }
                    selectedBin={selectedBin}
                    loading={loading}
                    currentFaceIndex={currentFaceIndex}
                    faceCleaningComplete={currentFaceValidationStatus} // Reuse validation status for now
                    getBinCleaningStatus={getBinValidationStatus} // Reuse validation status for now
                  />
                </div>

                {/* Control Buttons - Cleaning State */}
                {selectedPodData && (
                  <div className="bg-white p-2 rounded-lg shadow border-2 border-green-200">
                    <div className="flex justify-center items-center gap-2">
                      <ValidateButton
                        onClick={handleToggleCleaningComplete}
                        disabled={loading}
                        isValidated={currentFaceValidationStatus}
                      />
                    </div>

                    {/* Current Face Indicator - Cleaning Mode */}
                    {selectedPodData && (
                      <div className="mt-2 text-center text-xs text-gray-600">
                        <span className="text-green-600">
                          🧹 Cleaning Face:
                        </span>{" "}
                        <span className="font-medium">
                          {typeof selectedPodData.podFace === "string"
                            ? selectedPodData.podFace
                            : (Array.isArray(selectedPodData.podFace) &&
                                selectedPodData.podFace[currentFaceIndex]
                                  ?.podFace) ||
                              "N/A"}
                        </span>
                        {Array.isArray(selectedPodData.podFace) &&
                          selectedPodData.podFace[currentFaceIndex] && (
                            <span className="ml-2">
                              (
                              {
                                selectedPodData.podFace[currentFaceIndex]
                                  .faceItemTotal
                              }{" "}
                              items, GCU:{" "}
                              {selectedPodData.podFace[currentFaceIndex].gcu})
                            </span>
                          )}
                        {typeof selectedPodData.podFace === "string" &&
                          selectedPodData.totalItems && (
                            <span className="ml-2">
                              ({selectedPodData.totalItems} items)
                            </span>
                          )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Fragment>
    </div>
  );
};

export default PodManagementApp;
