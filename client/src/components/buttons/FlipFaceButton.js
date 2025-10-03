const FlipButton = ({
  onClick,
  disabled = false,
  currentFaceIndex = 0,
  totalFaces = 0,
  selectedPodData = null,
  isMobile = false,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 active:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation ${
        isMobile ? "px-4 py-3 text-base" : "px-3 py-2 text-sm"
      }`}
    >
      Flip
      {selectedPodData &&
        selectedPodData.podFace &&
        selectedPodData.podFace.length > 1 && (
          <span className={`ml-2 ${isMobile ? "text-sm" : "text-xs"}`}>
            ({currentFaceIndex + 1}/{selectedPodData.podFace.length})
          </span>
        )}
    </button>
  );
};

export default FlipButton;
