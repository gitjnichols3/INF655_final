import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="site-header">
      <nav className="navbar">
        <Link to="/" className="navbar-logo">
          Share the Moment
        </Link>

        <div className="navbar-links">
          <Link to="/">Home</Link>

          {user ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <span className="navbar-user">{user.displayName || user.email}</span>
              <button type="button" onClick={logout} className="nav-button">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

export default Navbar;