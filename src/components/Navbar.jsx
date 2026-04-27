import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <Link to="/">Home</Link>{" | "}

      {user ? (
        <>
          <Link to="/dashboard">Dashboard</Link>{" | "}
          <span>{user.email}</span>{" "}
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <>
          <Link to="/login">Login</Link>{" | "}
          <Link to="/register">Register</Link>
        </>
      )}
    </nav>
  );
}

export default Navbar;