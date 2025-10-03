const BinValidateButton = ({
  onClick,
  disabled = false,
  isValidated = false,
  selectedBin,
}) => {
  const handleClick = () => {
    if (onClick && selectedBin) {
      onClick("validate", selectedBin);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`px-2 py-1 text-xs rounded transition-colors ${
        isValidated
          ? "bg-green-500 text-white hover:bg-green-600"
          : "bg-green-500 text-white hover:bg-gray-600"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isValidated ? "✓ Validated" : "Validate"}
    </button>
  );
};

export default BinValidateButton;
