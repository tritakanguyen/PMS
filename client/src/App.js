import ResponsiveApp from "./components/ResponsiveApp";
import { StateMachineProvider } from "./components/context/StateMachineContext";

function App() {
  return (
    <div className="App">
      <StateMachineProvider>
        <ResponsiveApp />
      </StateMachineProvider>
    </div>
  );
}

export default App;
