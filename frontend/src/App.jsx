

function App() {
  const agentId = import.meta.env.DIALOGFLOW_AGENT_ID;
  return (
    <div>
      <h1>Weather Forecasting App</h1>

      <df-messenger
        intent="WELCOME"
        chat-title="WeatherApiBot"
        agent-id={agentId}
        language-code="en"
      ></df-messenger>
    </div>
  );
}

export default App;
