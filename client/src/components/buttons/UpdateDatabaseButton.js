const UpdateDatabaseButton = ({
  onClick,
  disabled = false,
  isMobile = false,
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    }
    // TODO: Implement database update functionality
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`flex items-center gap-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation ${
        isMobile ? "px-3 py-2 text-sm" : "px-2 py-1 text-xs"
      }`}
      title="Update Database"
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
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      Update DB
    </button>
  );
};

export default UpdateDatabaseButton;
