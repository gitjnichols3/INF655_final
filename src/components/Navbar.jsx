import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="site-header">
      <nav className="navbar">
        <Link to="/" className="navbar-logo">
          <img src="/images/logo-mark.png" alt="Share the Moment logo" />
          <span>Share the Moment</span>
        </Link>

        <div className="navbar-links">
          <Link to="/">Home</Link>

          {user ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <span className="navbar-user">
                Hi, {user?.displayName
                  ? user.displayName.split(" ")[0]
                  : user?.email}
              </span>
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