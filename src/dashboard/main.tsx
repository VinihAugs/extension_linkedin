import React from "react"
import ReactDOM from "react-dom/client"
import "../styles/index.css"
import { DashboardApp } from "./dashboardApp"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>
)

