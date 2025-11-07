import React from "react";
import "./Header.css";

const Header = () => {
  return (
    <header className="header" role="banner">
      <div className="header-content">
        <div className="logo">
          <img
            src={process.env.PUBLIC_URL + "/logo.svg"}
            alt="GFiles Game Launcher Logo"
            className="app-logo"
          />
          <h1>GFiles Game Launcher</h1>
        </div>
      </div>
    </header>
  );
};

export default Header;
