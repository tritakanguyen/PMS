const MarkHuntingButton = ({
  onClick,
  disabled = false,
  item,
  showCondition = true,
  actionsDisabled = false,
}) => {
  const handleClick = () => {
    if (onClick && item) {
      onClick(item.sku || item.fnsku);
    }
  };

  if (!showCondition) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`px-2 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        actionsDisabled ? "opacity-50" : ""
      }`}
      title={
        actionsDisabled
          ? "Cannot modify items when bin or face is validated"
          : "Mark as Hunting"
      }
    >
      Hunting
    </button>
  );
};

export default MarkHuntingButton;
