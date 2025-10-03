import { useStateMachine } from "../context/StateMachineContext";

const ModeToggleButton = ({ onToggle, isMobile = false }) => {
  const { selectors, actions } = useStateMachine();

  const isValidationState = selectors.isValidationState();

  const handleToggle = () => {
    actions.toggleState();
    const newState = selectors.getCurrentState();

    if (onToggle) {
      onToggle(newState);
    }
  };

  if (isMobile) {
    return (
      <div className="flex flex-col items-center gap-1">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isValidationState}
            onChange={handleToggle}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
        <span className="text-xs text-center">
          {isValidationState ? "Validation" : "Cleaning"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs">Cleaning</span>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={isValidationState}
          onChange={handleToggle}
          className="sr-only peer"
        />
        <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
      <span className="text-xs">Validation</span>
    </div>
  );
};

export default ModeToggleButton;
