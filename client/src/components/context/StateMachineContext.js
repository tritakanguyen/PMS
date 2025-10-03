import { createContext, useContext, useReducer } from "react";

// State machine states
export const APP_STATES = {
  CLEANING: "cleaning",
  VALIDATION: "validation",
};

// State machine actions
export const STATE_ACTIONS = {
  SWITCH_TO_CLEANING: "SWITCH_TO_CLEANING",
  SWITCH_TO_VALIDATION: "SWITCH_TO_VALIDATION",
  TOGGLE_STATE: "TOGGLE_STATE",
};

// Initial state
const initialState = {
  currentState: APP_STATES.CLEANING, // Default state is cleaning
  previousState: null,
  stateHistory: [APP_STATES.CLEANING],
};

// State machine reducer
const stateReducer = (state, action) => {
  switch (action.type) {
    case STATE_ACTIONS.SWITCH_TO_CLEANING:
      if (state.currentState === APP_STATES.CLEANING) return state;
      return {
        ...state,
        previousState: state.currentState,
        currentState: APP_STATES.CLEANING,
        stateHistory: [...state.stateHistory, APP_STATES.CLEANING],
      };

    case STATE_ACTIONS.SWITCH_TO_VALIDATION:
      if (state.currentState === APP_STATES.VALIDATION) return state;
      return {
        ...state,
        previousState: state.currentState,
        currentState: APP_STATES.VALIDATION,
        stateHistory: [...state.stateHistory, APP_STATES.VALIDATION],
      };

    case STATE_ACTIONS.TOGGLE_STATE:
      const newState =
        state.currentState === APP_STATES.CLEANING
          ? APP_STATES.VALIDATION
          : APP_STATES.CLEANING;
      return {
        ...state,
        previousState: state.currentState,
        currentState: newState,
        stateHistory: [...state.stateHistory, newState],
      };

    default:
      return state;
  }
};

// Create context
const StateMachineContext = createContext();

// State machine provider component
export const StateMachineProvider = ({ children }) => {
  const [state, dispatch] = useReducer(stateReducer, initialState);

  const actions = {
    switchToCleaning: () =>
      dispatch({ type: STATE_ACTIONS.SWITCH_TO_CLEANING }),
    switchToValidation: () =>
      dispatch({ type: STATE_ACTIONS.SWITCH_TO_VALIDATION }),
    toggleState: () => dispatch({ type: STATE_ACTIONS.TOGGLE_STATE }),
  };

  const selectors = {
    isCleaningState: () => state.currentState === APP_STATES.CLEANING,
    isValidationState: () => state.currentState === APP_STATES.VALIDATION,
    getCurrentState: () => state.currentState,
    getPreviousState: () => state.previousState,
    getStateHistory: () => state.stateHistory,
  };

  return (
    <StateMachineContext.Provider
      value={{
        state,
        actions,
        selectors,
        APP_STATES,
      }}
    >
      {children}
    </StateMachineContext.Provider>
  );
};

// Custom hook to use state machine
export const useStateMachine = () => {
  const context = useContext(StateMachineContext);
  if (!context) {
    throw new Error(
      "useStateMachine must be used within a StateMachineProvider"
    );
  }
  return context;
};

export default StateMachineContext;
