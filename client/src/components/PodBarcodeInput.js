import { Html5QrcodeScanner } from "html5-qrcode";
import { QrCode, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDebounce } from "../utils/debounce";

const PodBarcodeInput = ({ onSearch }) => {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [pods, setPods] = useState([]);
  const [filteredPods, setFilteredPods] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanner, setScanner] = useState(null);
  const [isLoadingPods, setIsLoadingPods] = useState(false);
  const scannerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Debounce the barcode input to reduce filtering operations
  const debouncedBarcodeInput = useDebounce(barcodeInput, 300);

  // Fetch all pods for search functionality - WITH PAGINATION
  useEffect(() => {
    setIsLoadingPods(true);
    fetch("http://localhost:5000/pods?limit=200") // Limit initial load
      .then((response) => response.json())
      .then((data) => {
        // Handle both old format (array) and new format (with pagination)
        const podsArray = Array.isArray(data) ? data : data.pods || [];

        const podList = podsArray.map((pod) => ({
          barcode: pod.podBarcode,
          name: pod.podName,
          type: pod.podType || "Unknown",
          displayName: `${pod.podName} ${pod.podType || ""}`,
          status: pod.podStatus,
        }));
        setPods(podList);
        setIsLoadingPods(false);
      })
      .catch((error) => {
        console.error("Error fetching pods:", error);
        setIsLoadingPods(false);
      });
  }, []);

  // Filter pods based on DEBOUNCED input to reduce unnecessary filtering
  useEffect(() => {
    if (debouncedBarcodeInput.trim()) {
      const searchLower = debouncedBarcodeInput.toLowerCase();
      const filtered = pods.filter(
        (pod) =>
          pod.name.toLowerCase().includes(searchLower) ||
          pod.type.toLowerCase().includes(searchLower) ||
          pod.barcode.toLowerCase().includes(searchLower)
      );
      setFilteredPods(filtered);
      setShowDropdown(filtered.length > 0);
    } else {
      setFilteredPods([]);
      setShowDropdown(false);
    }
  }, [debouncedBarcodeInput, pods]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = () => {
    if (barcodeInput.trim()) {
      onSearch(barcodeInput);
      setBarcodeInput("");
      setShowDropdown(false);
    }
  };

  const handlePodSelect = (pod) => {
    setBarcodeInput(pod.barcode);
    setShowDropdown(false);
    onSearch(pod.barcode);
    setBarcodeInput("");
  };

  const startQRScanning = () => {
    setIsScanning(true);
  };

  // Initialize scanner when isScanning becomes true
  useEffect(() => {
    if (isScanning) {
      // Small delay to ensure DOM element exists
      const timer = setTimeout(() => {
        const scannerElement = document.getElementById("qr-scanner-container");
        if (!scannerElement) {
          console.error("QR scanner container not found");
          setIsScanning(false);
          return;
        }

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          // Support multiple barcode and QR code formats
          formatsToSupport: [
            0, // QR_CODE
            8, // CODE_128 (most common barcode format)
            1, // CODE_39
            7, // CODE_93
            9, // CODABAR
            13, // EAN_13
            14, // EAN_8
            15, // ITF (Interleaved 2 of 5)
            12, // UPC_A
            17, // UPC_E
            11, // RSS_14 (GS1 DataBar)
            16, // RSS_EXPANDED (GS1 DataBar Expanded)
          ],
          // Additional camera settings for better barcode detection
          videoConstraints: {
            facingMode: "environment", // Use back camera on mobile
            advanced: [
              { focusMode: "continuous" },
              { exposureMode: "continuous" },
            ],
          },
        };

        const html5QrcodeScanner = new Html5QrcodeScanner(
          "qr-scanner-container",
          config,
          false
        );

        html5QrcodeScanner.render(
          (decodedText) => {
            // Success callback - QR code or barcode scanned
            setBarcodeInput(decodedText);
            onSearch(decodedText);
            setBarcodeInput("");
            // Stop scanning after successful scan
            if (html5QrcodeScanner) {
              html5QrcodeScanner
                .clear()
                .then(() => {
                  setIsScanning(false);
                  setScanner(null);
                })
                .catch((error) => {
                  console.error("Error stopping scanner:", error);
                  setIsScanning(false);
                  setScanner(null);
                });
            }
          },
          (error) => {
            // Error callback (optional) - suppress common scanning errors
            // console.log("QR/Barcode scan error:", error);
          }
        );

        setScanner(html5QrcodeScanner);
      }, 100); // 100ms delay to ensure DOM is ready

      return () => clearTimeout(timer);
    }
  }, [isScanning, onSearch]);

  const stopQRScanning = () => {
    if (scanner) {
      scanner
        .clear()
        .then(() => {
          setIsScanning(false);
          setScanner(null);
        })
        .catch((error) => {
          console.error("Error stopping scanner:", error);
          setIsScanning(false);
          setScanner(null);
        });
    } else {
      setIsScanning(false);
    }
  };

  return (
    <div className="bg-green-300 p-1 rounded-lg">
      {!isScanning ? (
        <div className="relative" ref={dropdownRef}>
          <div className="flex gap-1">
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Pod name, pod type"
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
              disabled={isLoadingPods}
            />
            <button
              onClick={handleSearch}
              className="px-2 py-1 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Search"
              disabled={isLoadingPods}
            >
              <Search size={14} />
            </button>
            <button
              onClick={startQRScanning}
              className="px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Scan QR Code or Barcode"
              disabled={isLoadingPods}
            >
              <QrCode size={14} />
            </button>
          </div>

          {/* Loading indicator */}
          {isLoadingPods && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3 text-center text-sm text-gray-600">
              Loading pods...
            </div>
          )}

          {/* Dropdown */}
          {showDropdown && filteredPods.length > 0 && !isLoadingPods && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {filteredPods.map((pod) => (
                <div
                  key={pod.barcode}
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                  onClick={() => handlePodSelect(pod)}
                >
                  <div className="font-medium text-gray-800">
                    {pod.displayName}
                  </div>
                  <div className="text-sm text-gray-500">{pod.barcode}</div>
                  <div className="text-xs text-gray-400 capitalize">
                    {pod.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="text-gray-800 font-medium">
              QR Code & Barcode Scanner
            </div>
            <button
              onClick={stopQRScanning}
              className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors flex items-center gap-1"
            >
              <X size={14} />
              Stop
            </button>
          </div>
          <div
            id="qr-scanner-container"
            ref={scannerRef}
            className="w-full"
          ></div>
          <div className="text-sm text-gray-600 mt-2 text-center">
            Point your camera at a QR code or barcode to scan
          </div>
        </div>
      )}
    </div>
  );
};

export default PodBarcodeInput;
