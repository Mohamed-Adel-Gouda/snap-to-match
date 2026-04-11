import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-60">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
