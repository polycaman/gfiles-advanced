import React from "react";
import "./Header.css";

const Header = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <img
            src={process.env.PUBLIC_URL + "/logo.svg"}
            alt="App Logo"
            className="app-logo"
          />
          <h1 className="logo-text">GFiles Game Launcher</h1>
        </div>

        <div className="header-actions">
          <button className="header-button" title="Refresh Games">
            🔄
          </button>
          <button className="header-button" title="Settings">
            ⚙️
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
