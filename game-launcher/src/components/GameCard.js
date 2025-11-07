import React, { useState, useEffect } from "react";
import "./GameCard.css";

const GameCard = ({ game, onLaunch, serverPort }) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLaunch = async () => {
    setIsLoading(true);
    try {
      await onLaunch();
    } finally {
      setIsLoading(false);
    }
  };

  const getImageUrl = () => {
    if (!game.thumbnail || imageError || !serverPort) {
      return null;
    }
    if (game.thumbnailExternal) {
      return `http://localhost:${serverPort}/screenshots/${game.thumbnail}`;
    }
    const gameType = game.category === "game" ? "games" : "emulators";
    return `http://localhost:${serverPort}/${gameType}/${game.path}/${game.thumbnail}`;
  };
  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="game-card">
      <div className="game-card-image">
        {getImageUrl() ? (
          <img
            src={getImageUrl()}
            alt={game.title}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="game-card-placeholder">
            <div className="game-icon">
              {game.category === "emulator" ? (
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="game-icon-svg"
                >
                  <path
                    d="M7 6V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4zM5 8v12h14V8H5zm2-2h10V3H7v3zm2 4h2v2H9v-2zm0 4h2v2H9v-2zm4-4h2v2h-2v-2z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="game-icon-svg"
                >
                  <path
                    d="M17 4H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zM7 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm2 3v6l5-3-5-3z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </div>
          </div>
        )}
        <div className="game-card-overlay">
          <button
            className={`play-button ${isLoading ? "loading" : ""}`}
            onClick={handleLaunch}
            disabled={isLoading}
            aria-label={`Play ${game.title}`}
          >
            {isLoading ? (
              <div className="spinner"></div>
            ) : (
              <span className="play-icon">▶</span>
            )}
          </button>
        </div>
      </div>

      <div className="game-card-content">
        <div className="game-card-header">
          <h3 className="game-title" title={game.title}>
            {game.title}
          </h3>
          <span className={`game-type ${game.category}`}>{game.category}</span>
        </div>

        {game.description && (
          <p className="game-description" title={game.description}>
            {game.description}
          </p>
        )}

        <div className="game-card-meta">
          {game.size > 0 && (
            <span className="game-size">{formatFileSize(game.size)}</span>
          )}
          {game.lastModified && (
            <span className="game-date">
              Updated: {formatDate(game.lastModified)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameCard;
