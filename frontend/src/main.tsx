import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntdApp, ConfigProvider } from "antd";
import { BrowserRouter } from "react-router-dom";
import "antd/dist/reset.css";

import { App } from "./App";
import "./styles.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <ConfigProvider theme={{ token: { colorPrimary: "#0f766e", borderRadius: 6 } }}>
      <AntdApp><BrowserRouter><App /></BrowserRouter></AntdApp>
    </ConfigProvider>
  </QueryClientProvider>,
);
