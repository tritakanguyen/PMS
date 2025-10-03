const FlagIssuesButton = ({ onClick, disabled = false, selectedBin }) => {
  const handleClick = () => {
    if (onClick && selectedBin) {
      onClick("flag", selectedBin);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="px-2 py-1 text-xs rounded bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Flag Issues
    </button>
  );
};

export default FlagIssuesButton;
