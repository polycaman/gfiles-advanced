import React from "react";
import "./GameGrid.css";
import GameCard from "./GameCard";

const GameGrid = ({ games, onGameLaunch, serverPort }) => {
  return (
    <div className="game-grid">
      {games.map((game) => (
        <GameCard
          key={`${game.category}-${game.id}`}
          game={game}
          onLaunch={() => onGameLaunch(game)}
          serverPort={serverPort}
        />
      ))}
    </div>
  );
};

export default GameGrid;
