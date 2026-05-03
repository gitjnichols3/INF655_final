import { Link } from "react-router-dom";

function Home() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-image">
          <img
            src="/images/hero-collage.png"
            alt="Photo memories collage"
          />
        </div>

        <div className="home-hero-content">
          <p className="eyebrow">Share the Moment</p>

          <h1>Capture, organize, and share the moments that matter.</h1>

          <p className="hero-text">
            Create photo albums, group memories by events, and share read-only
            album links with friends and family.
          </p>

          <div className="home-hero-actions">
            <Link to="/register" className="primary-btn">
              Get Started
            </Link>

            <Link to="/login" className="secondary-btn">
              Log In
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;