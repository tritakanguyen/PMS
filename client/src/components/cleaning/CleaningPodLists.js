import { useCallback, useEffect, useRef, useState } from "react";

// Cache for cleaning pod data
const cleaningPodDataCache = {
  data: null,
  timestamp: 0,
  CACHE_DURATION: 10000, // 10 seconds cache
};

const CleaningPodLists = ({ onSelectPod, refreshTrigger }) => {
  const [readyToCleanPods, setReadyToCleanPods] = useState([]);
  const [loading, setLoading] = useState(true); // Start with true for preload
  const [error, setError] = useState(null);
  const fetchTimeoutRef = useRef(null);
  const lastRefreshTrigger = useRef(refreshTrigger);

  // Memoized sorting function for cleaning pods - sort by uploadAt (most recent first)
  const sortByUploadAt = useCallback((a, b) => {
    // Sort by lastUpdated (uploadAt) in descending order (newest first)
    const timeA = new Date(a.lastUpdated || 0).getTime();
    const timeB = new Date(b.lastUpdated || 0).getTime();

    // If times are different, sort by time (newest first)
    if (timeB !== timeA) {
      return timeB - timeA;
    }

    // If times are the same, sort by podBarcode as tiebreaker
    return a.podBarcode.localeCompare(b.podBarcode);
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
        cleaningPodDataCache.data &&
        now - cleaningPodDataCache.timestamp <
          cleaningPodDataCache.CACHE_DURATION
      ) {
        // Use cached data for instant loading
        setReadyToCleanPods(cleaningPodDataCache.data);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        lastRefreshTrigger.current = refreshTrigger;

        const response = await fetch("http://localhost:5000/cleans");

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Optimized processing for cleaning pods
        const processedPods = data
          .map((cleanPod) => ({
            id: cleanPod.podBarcode,
            name: cleanPod.podName || cleanPod.podBarcode,
            items: cleanPod.totalItems || 0,
            podBarcode: cleanPod.podBarcode,
            podName: cleanPod.podName || cleanPod.podBarcode,
            podType: cleanPod.podType,
            podFace: cleanPod.podFace,
            user: cleanPod.user,
            station: cleanPod.station,
            status: cleanPod.podStatus || cleanPod.status || "incomplete",
            lastUpdated: cleanPod.updateAt || cleanPod.uploadAt,
            stowedItems: cleanPod.stowedItems || [],
            attemptedStows: cleanPod.attemptedStows || [],
          }))
          .sort(sortByUploadAt);

        // Cache the processed data
        cleaningPodDataCache.data = processedPods;
        cleaningPodDataCache.timestamp = now;

        setReadyToCleanPods(processedPods);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    },
    [sortByUploadAt, refreshTrigger]
  );

  // Immediate load on mount with cache check
  useEffect(() => {
    // Check cache immediately for instant display
    const now = Date.now();
    if (
      cleaningPodDataCache.data &&
      now - cleaningPodDataCache.timestamp < cleaningPodDataCache.CACHE_DURATION
    ) {
      setReadyToCleanPods(cleaningPodDataCache.data);
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
    <div className="bg-[#10B981] p-2 rounded-lg text-white h-full flex flex-col">
      <h3 className="font-semibold mb-1 text-sm flex-shrink-0">
        🧹 Used pod list
      </h3>

      {/* Pod Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-2 text-green-200">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span className="text-sm">Loading cleaning pods...</span>
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

        {!loading && !error && (
          <div className="space-y-1">
            {readyToCleanPods.length > 0 ? (
              readyToCleanPods.map((pod) => (
                <div
                  key={pod.id}
                  className="bg-green-300 p-1.5 rounded cursor-pointer hover:bg-green-200 transition-colors"
                  onClick={() => onSelectPod(pod.podBarcode)}
                >
                  <div className="font-medium text-green-900 text-sm">
                    {pod.podName + " " + pod.podType + "-" + pod.podFace ||
                      pod.podBarcode}
                  </div>
                  <div className="text-xs text-green-700 flex justify-between">
                    <span>{pod.items} items</span>
                    <span>
                      {pod.status === "incomplete"
                        ? "🧹 Ready"
                        : pod.status === "in progress"
                        ? "🔄 Active"
                        : "✅ Done"}
                    </span>
                  </div>
                  <div className="text-s text-red-600">
                    Station: {pod.station} | User: {pod.user}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-green-200">
                <div className="text-2xl mb-2">✨</div>
                <div className="text-sm">No pods available for cleaning</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CleaningPodLists;
