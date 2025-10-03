const PodNameDisplay = ({ podData, currentFaceIndex = 0 }) => {
  const getPodDisplayName = () => {
    if (!podData) return "No pod selected";

    const currentFace = podData.podFace && podData.podFace[currentFaceIndex];
    if (currentFace) {
      return `${podData.podBarcode} ${currentFace.podFace}`;
    }

    return podData.podBarcode;
  };

  return (
    <div className="bg-gray-200 p-1 rounded-lg text-center flex-shrink-0">
      <h2 className="text-sm font-semibold text-gray-800">
        Pod: {getPodDisplayName()}
      </h2>
    </div>
  );
};

export default PodNameDisplay;
