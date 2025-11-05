import React, { useState, useEffect } from "react";
import "./App.css";
import GameGrid from "./components/GameGrid";
import SearchBar from "./components/SearchBar";
import Header from "./components/Header";
import LoadingSpinner from "./components/LoadingSpinner";

function App() {
  const [games, setGames] = useState([]);
  const [filteredGames, setFilteredGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [serverPort, setServerPort] = useState(null);

  useEffect(() => {
    loadGames();
  }, []);

  useEffect(() => {
    filterGames();
  }, [games, searchQuery, selectedCategory]);

  const loadGames = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("Loading games...");
      console.log("electronAPI available:", !!window.electronAPI);

      if (window.electronAPI) {
        console.log("Calling electronAPI.getGames()");
        const [gameData, port] = await Promise.all([
          window.electronAPI.getGames(),
          window.electronAPI.getServerPort(),
        ]);
        console.log("Game data received:", gameData);
        console.log("Server port:", port);
        setServerPort(port);
        const allGames = [
          ...gameData.games.map((game) => ({ ...game, category: "game" })),
          ...gameData.emulators.map((emu) => ({
            ...emu,
            category: "emulator",
          })),
        ];
        console.log("Total games loaded:", allGames.length);
        setGames(allGames);
      } else {
        console.warn("electronAPI not available - running in browser mode");
        // Fallback for development
        setGames([]);
      }
    } catch (err) {
      console.error("Error loading games:", err);
      setError(`Failed to load games: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  const filterGames = () => {
    let filtered = games;

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((game) => game.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (game) =>
          game.title.toLowerCase().includes(query) ||
          game.description.toLowerCase().includes(query) ||
          game.id.toLowerCase().includes(query)
      );
    }

    setFilteredGames(filtered);
  };

  const handleGameLaunch = async (game) => {
    try {
      if (window.electronAPI) {
        const gameType = game.category === "game" ? "games" : "emulators";
        await window.electronAPI.launchGame(game.path, gameType);
      }
    } catch (err) {
      console.error("Error launching game:", err);
      setError("Failed to launch game. Please try again.");
    }
  };

  const categories = [
    { value: "all", label: "All Games" },
    { value: "game", label: "Games" },
    { value: "emulator", label: "Emulators" },
  ];

  if (loading) {
    return (
      <div className="app">
        <Header />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="app">
      <Header />

      <main className="main-content">
        <div className="controls">
          <SearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            categories={categories}
          />
        </div>

        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={loadGames} className="retry-button">
              Retry
            </button>
          </div>
        )}

        <div className="game-stats">
          <p>
            Showing {filteredGames.length} of {games.length} games
            {selectedCategory !== "all" && ` in ${selectedCategory}s`}
          </p>
        </div>

        <GameGrid
          games={filteredGames}
          onGameLaunch={handleGameLaunch}
          serverPort={serverPort}
        />

        {filteredGames.length === 0 && !loading && !error && (
          <div className="no-games">
            <h3>No games found</h3>
            <p>
              {searchQuery || selectedCategory !== "all"
                ? "Try adjusting your search or category filter."
                : "No games available in the library."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
