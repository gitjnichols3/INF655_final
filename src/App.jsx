import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AlbumDetails from "./pages/AlbumDetails";
import NotFound from "./pages/NotFound";
import SharedAlbum from "./pages/SharedAlbum";

function App() {
  return (
    <Routes>
      <Route path="/share/:slug" element={<SharedAlbum />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="album/:id"
          element={
            <ProtectedRoute>
              <AlbumDetails />
            </ProtectedRoute>
          }
        />
        <Route path="album/:id" element={<AlbumDetails />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;