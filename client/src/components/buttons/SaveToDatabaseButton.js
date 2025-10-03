const SaveToDatabaseButton = ({
  onClick,
  disabled = false,
  isEnabled = false,
  isMobile = false,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-lg font-medium transition-colors touch-manipulation ${
        isMobile ? "px-4 py-3 text-base" : "px-3 py-2 text-sm"
      } ${
        isEnabled
          ? "bg-purple-500 text-white hover:bg-purple-600 active:bg-purple-700"
          : "bg-gray-300 text-gray-500 cursor-not-allowed"
      } disabled:opacity-50`}
    >
      Save to DB
    </button>
  );
};

export default SaveToDatabaseButton;
