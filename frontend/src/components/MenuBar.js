import { useState } from "react";
import DatabaseUpdateModal from "./DatabaseUpdateModal";
import { useStateMachine } from "./context/StateMachineContext";

const MenuBar = ({ isMobile = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { selectors } = useStateMachine();
  const isValidationState = selectors.isValidationState();

  const handleExportReport = () => {
    // Generate temporary PDF report
    const element = document.createElement("a");
    const file = new Blob(
      ["Pod Management Report - Generated on " + new Date().toLocaleString()],
      { type: "text/plain" }
    );
    element.href = URL.createObjectURL(file);
    element.download = "pod-report-" + Date.now() + ".txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setIsOpen(false);
  };

  const handleUpdateDatabase = () => {
    setShowModal(true);
    setIsOpen(false);
  };

  if (!isValidationState)
    return <div className={isMobile ? "w-10 h-10" : "w-7 h-7"} />;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`text-white hover:bg-blue-600 rounded transition-colors ${
          isMobile ? "p-2" : "p-1"
        }`}
      >
        <svg
          className={isMobile ? "w-6 h-6" : "w-5 h-5"}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          {isMobile ? (
            <div
              className={`fixed top-0 left-0 h-full w-50 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
                isOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="p-3 border-b bg-[#05A0D1] text-white h-[60px] flex items-center">
                <div className="flex items-center justify-between w-full">
                  <h2 className="text-lg font-semibold">Menu</h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-blue-600 rounded transition-colors"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <ul className="py-2">
                <li>
                  <button
                    onClick={handleUpdateDatabase}
                    className="w-full text-left flex items-center gap-3 hover:bg-gray-100 transition-colors text-gray-700 px-6 py-4 text-base"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span>Update Database</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={handleExportReport}
                    className="w-full text-left flex items-center gap-3 hover:bg-gray-100 transition-colors text-gray-700 px-6 py-4 text-base"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>Export Report</span>
                  </button>
                </li>
              </ul>
            </div>
          ) : (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border z-20 min-w-40">
              <ul className="py-1">
                <li>
                  <button
                    onClick={handleUpdateDatabase}
                    className="w-full text-left flex items-center gap-2 hover:bg-gray-100 transition-colors text-gray-700 px-3 py-2 text-sm"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span>Update Database</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={handleExportReport}
                    className="w-full text-left flex items-center gap-2 hover:bg-gray-100 transition-colors text-gray-700 px-3 py-2 text-sm"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>Export Report</span>
                  </button>
                </li>
              </ul>
            </div>
          )}
        </>
      )}
      <DatabaseUpdateModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        isMobile={isMobile}
      />
    </div>
  );
};

export default MenuBar;
