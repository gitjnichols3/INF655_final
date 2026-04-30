import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

function Layout() {
  return (
    <div className="site-layout">
      <Navbar />

      <main className="app-container">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

export default Layout;