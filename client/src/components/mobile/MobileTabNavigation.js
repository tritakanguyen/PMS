const MobileTabNavigation = ({ activeTab, onTabChange, selectedPodData, selectedBin }) => {
  const tabs = [
    {
      id: "search",
      label: "Search",
      icon: "🔍",
      disabled: false,
    },
    {
      id: "grid",
      label: "Grid",
      icon: "⚏",
      disabled: !selectedPodData,
    },
    {
      id: "items",
      label: "Items",
      icon: "📋",
      disabled: !selectedBin,
    },
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-4">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
            className={`flex-1 py-3 px-2 text-center border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-[#05A0D1] text-[#05A0D1] bg-blue-50"
                : tab.disabled
                ? "border-transparent text-gray-400 cursor-not-allowed"
                : "border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300"
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-lg">{tab.icon}</span>
              <span className="text-xs font-medium">{tab.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MobileTabNavigation;