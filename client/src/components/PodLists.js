import { useCallback, useEffect, useRef, useState } from "react";

// Cache to store pod data across component instances
const podDataCache = {
  data: null,
  timestamp: 0,
  CACHE_DURATION: 10000, // 10 seconds cache
};

const PodLists = ({ onSelectPod, refreshTrigger }) => {
  const [activeTab, setActiveTab] = useState("in progress");
  const [inProgressPods, setInProgressPods] = useState([]);
  const [completedPods, setCompletedPods] = useState([]);
  const [loading, setLoading] = useState(true); // Start with true to preload
  const [error, setError] = useState(null);
  const fetchTimeoutRef = useRef(null);
  const lastRefreshTrigger = useRef(refreshTrigger);

  // Memoized sorting function to avoid recreating on every render
  const sortByPodTypeAndName = useCallback((a, b) => {
    const podTypeOrder = ["H11", "H10", "H8", "H12"];
    // Extract pod type from the name (e.g., "Pod Name H12" -> "H12")
    const typeA = a.name.split(" ").pop() || ""; // Get the last part after space (e.g., "H12")
    const typeB = b.name.split(" ").pop() || "";

    const indexA = podTypeOrder.indexOf(typeA);
    const indexB = podTypeOrder.indexOf(typeB);

    // First, sort by pod type according to custom order
    if (indexA !== -1 && indexB !== -1) {
      if (indexA !== indexB) {
        return indexA - indexB; // Different types: use custom order
      }
      // Same type: sort alphabetically by pod name
      return a.podName.localeCompare(b.podName);
    }

    // If only one is in the array, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    // If neither is in the array, fall back to alphabetical by pod name
    return a.podName.localeCompare(b.podName);
  }, []);

  const fetchPods = useCallback(
    async (forceRefresh = false) => {
      // Clear any pending fetch timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      // Check cache first
      const now = Date.now();
      const isRefreshTriggered = refreshTrigger !== lastRefreshTrigger.current;

      if (
        !forceRefresh &&
        !isRefreshTriggered &&
        podDataCache.data &&
        now - podDataCache.timestamp < podDataCache.CACHE_DURATION
      ) {
        // Use cached data - this makes it MUCH faster
        const { inProgress, completed } = podDataCache.data;
        setInProgressPods(inProgress);
        setCompletedPods(completed);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        lastRefreshTrigger.current = refreshTrigger;

        const response = await fetch("http://localhost:5000/pods");

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseData = await response.json();
        // Handle both array response and object response with pods property
        const data = Array.isArray(responseData)
          ? responseData
          : responseData.pods || [];

        // Optimized processing - single pass through data
        const inProgressPods = [];
        const completedPods = [];

        for (const pod of data) {
          const processedPod = {
            id: pod.podBarcode,
            name: pod.podName + (pod.podType ? " " + pod.podType : ""),
            items: pod.totalItems || 0,
            podBarcode: pod.podBarcode,
            podName: pod.podName,
          };

          if (pod.podStatus === "in progress") {
            inProgressPods.push(processedPod);
          } else if (pod.podStatus === "completed") {
            completedPods.push(processedPod);
          }
        }

        // Sort both arrays
        const sortedInProgress = inProgressPods.sort(sortByPodTypeAndName);
        const sortedCompleted = completedPods.sort(sortByPodTypeAndName);

        // Cache the processed data
        podDataCache.data = {
          inProgress: sortedInProgress,
          completed: sortedCompleted,
        };
        podDataCache.timestamp = now;

        setInProgressPods(sortedInProgress);
        setCompletedPods(sortedCompleted);
      } catch (error) {
        console.error("Error fetching pod data:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    },
    [sortByPodTypeAndName, refreshTrigger]
  );

  // Immediate load on mount with cache check
  useEffect(() => {
    // Check cache immediately for instant display
    const now = Date.now();
    if (
      podDataCache.data &&
      now - podDataCache.timestamp < podDataCache.CACHE_DURATION
    ) {
      const { inProgress, completed } = podDataCache.data;
      setInProgressPods(inProgress);
      setCompletedPods(completed);
      setLoading(false);
    } else {
      // No cache, fetch immediately
      fetchPods();
    }
  }, [fetchPods]);

  // Handle refresh trigger with debouncing
  useEffect(() => {
    if (refreshTrigger !== lastRefreshTrigger.current) {
      // Debounce rapid refresh triggers
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      fetchTimeoutRef.current = setTimeout(() => {
        fetchPods(true); // Force refresh
      }, 100); // 100ms debounce
    }
  }, [refreshTrigger, fetchPods]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-[#05A0D1] p-2 rounded-lg text-white h-full flex flex-col">
      <h3 className="font-semibold mb-1 text-sm flex-shrink-0">Pod Lists</h3>

      {/* Tab Buttons */}
      <div className="flex mb-1 bg-blue-400 rounded-lg p-0.5 flex-shrink-0">
        <button
          className={`flex-1 py-2 px-3 rounded-md font-medium text-base transition-colors ${
            activeTab === "in progress"
              ? "bg-blue-100 text-blue-900"
              : "text-blue-100 hover:text-white"
          }`}
          onClick={() => setActiveTab("in progress")}
        >
          In Progress
        </button>
        <button
          className={`flex-1 py-2 px-3 rounded-md font-medium text-base transition-colors ${
            activeTab === "completed"
              ? "bg-blue-100 text-blue-900"
              : "text-blue-100 hover:text-white"
          }`}
          onClick={() => setActiveTab("completed")}
        >
          Completed
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-2 text-blue-200">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span className="text-sm">Loading pods...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500 bg-opacity-20 border border-red-300 text-red-100 p-2 rounded text-sm mb-2">
            <div className="flex items-center space-x-1">
              <span>⚠️</span>
              <span>Error: {error}</span>
            </div>
            <button
              onClick={fetchPods}
              className="mt-1 px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && activeTab === "in progress" && (
          <div className="space-y-1">
            {inProgressPods.length > 0 ? (
              inProgressPods.map((pod) => (
                <div
                  key={pod.id}
                  className="bg-blue-300 p-1.5 rounded cursor-pointer hover:bg-blue-200 transition-colors"
                  onClick={() => onSelectPod(pod.name)}
                >
                  <div className="font-medium text-blue-900 text-sm">
                    {pod.name}
                  </div>
                  <div className="text-xs text-blue-700">{pod.items} items</div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-blue-200">
                <div className="text-2xl mb-2">📋</div>
                <div className="text-sm">No pods in progress</div>
              </div>
            )}
          </div>
        )}

        {!loading && !error && activeTab === "completed" && (
          <div className="space-y-1">
            {completedPods.length > 0 ? (
              completedPods.map((pod) => (
                <div
                  key={pod.id}
                  className="bg-blue-300 p-1.5 rounded cursor-pointer hover:bg-blue-200 transition-colors"
                  onClick={() => onSelectPod(pod.name)}
                >
                  <div className="font-medium text-blue-900 text-sm">
                    {pod.name}
                  </div>
                  <div className="text-xs text-blue-700">{pod.items} items</div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-blue-200">
                <div className="text-2xl mb-2">✅</div>
                <div className="text-sm">No completed pods</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PodLists;
