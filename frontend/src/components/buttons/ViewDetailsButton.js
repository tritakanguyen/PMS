const ViewDetailsButton = ({ onClick, disabled = false, selectedBin }) => {
  const handleClick = () => {
    if (onClick && selectedBin) {
      onClick("details", selectedBin);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      View Details
    </button>
  );
};

export default ViewDetailsButton;
