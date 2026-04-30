import { Link } from "react-router-dom";

function Home() {
  return (
    <section className="home-page">
      <div className="hero">
        <h1>Share the Moment</h1>
        <p>
          Organize your photos into meaningful albums and relive your favorite
          moments with a clean, simple gallery experience.
        </p>

        <div className="hero-actions">
          <Link to="/login" className="primary-button">
            Login
          </Link>
          <Link to="/register" className="secondary-button">
            Create Account
          </Link>
        </div>
      </div>
    </section>
  );
}

export default Home;