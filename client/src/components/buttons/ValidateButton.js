import { useStateMachine } from "../context/StateMachineContext";

const ValidateButton = ({ onClick, disabled = false, isValidated = false, isMobile = false }) => {
  const { selectors } = useStateMachine();
  const isValidationState = selectors.isValidationState();

  const getButtonText = () => {
    if (isValidationState) {
      return isValidated ? "✓ Validated" : "Validate";
    } else {
      return isValidated ? "✓ Completed" : "Complete";
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-lg font-medium transition-colors ${
        isMobile ? "px-4 py-3 text-base" : "px-3 py-2 text-sm"
      } ${
        isValidated
          ? "bg-green-500 text-white hover:bg-green-600 active:bg-green-700"
          : "bg-green-500 text-white hover:bg-green-600 active:bg-green-700"
      } disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation`}
    >
      {getButtonText()}
    </button>
  );
};

export default ValidateButton;
