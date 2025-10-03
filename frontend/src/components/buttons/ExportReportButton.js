const ExportReportButton = ({
  onClick,
  disabled = false,
  isMobile = false,
}) => {
  const handleClick = () => {
    // TODO: Generate temporary PDF report
    // For now, create a simple PDF download
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

    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`flex items-center gap-1 bg-green-600 hover:bg-green-700 active:bg-green-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation ${
        isMobile ? "px-3 py-2 text-sm" : "px-2 py-1 text-xs"
      }`}
      title="Export Report"
    >
      <svg
        className="w-3 h-3"
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
      Export
    </button>
  );
};

export default ExportReportButton;
