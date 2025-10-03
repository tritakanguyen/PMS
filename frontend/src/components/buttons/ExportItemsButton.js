const ExportItemsButton = ({
  onClick,
  disabled = false,
  selectedBin,
  binItems = [],
  showCondition = true,
}) => {
  const handleClick = () => {
    if (onClick && selectedBin) {
      onClick("export", selectedBin);
    }
  };

  if (!showCondition) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="px-2 py-1 text-xs rounded bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Export Items
    </button>
  );
};

export default ExportItemsButton;
