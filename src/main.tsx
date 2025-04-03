import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import {HashRouter} from "react-router-dom";
import {Provider} from "./components/ui/provider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    
    <Provider>
      <HashRouter>
        <App />
      </HashRouter>
    </Provider>
      
  </React.StrictMode>,
);
