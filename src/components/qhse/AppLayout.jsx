import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import ProcessContextBar from "./ProcessContextBar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 min-h-screen">
        <div className="p-6 lg:p-8 max-w-7xl">
          <ProcessContextBar />
          <Outlet />
        </div>
      </main>
    </div>
  );
}