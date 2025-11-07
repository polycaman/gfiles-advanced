import React, { useState, useEffect, useMemo, useRef } from "react";
import "./App.css";
import GameGrid from "./components/GameGrid";
import SearchBar from "./components/SearchBar";
import Header from "./components/Header";
import LoadingSpinner from "./components/LoadingSpinner";

const categories = [
  { value: "all", label: "All Games" },
  { value: "game", label: "Games" },
  { value: "emulator", label: "Emulators" },
];

function App() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [serverPort, setServerPort] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    loadGames();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const loadGames = async () => {
    setLoading(true);
    setError(null);
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      if (!window.electronAPI) {
        setGames([]);
        setServerPort(null);
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.log("Loading games via electronAPI");
      }

      const [gameData, port] = await Promise.all([
        window.electronAPI.getGames(),
        window.electronAPI.getServerPort(),
      ]);

      if (ac.signal.aborted) return;

      const baseUrl = port ? `http://localhost:${port}` : "";
      const buildThumbFields = (record, id) => {
        const explicit = record.thumbnail || record.screenshot || record.image;
        if (explicit && /^(https?:)?\/\//i.test(explicit)) {
          return {
            thumbnail: `${id}.png`,
            thumbnailExternal: true,
            thumbnailUrl: explicit,
          };
        }
        if (explicit) {
          return {
            thumbnail: explicit,
            thumbnailExternal: !explicit.includes("/"),
          };
        }
        return {
          thumbnail: `${id}.png`,
          thumbnailExternal: true,
        };
      };

      const allGames = [
        ...(gameData?.games || []).map((g) => {
          const id = g.id || g.title;
          const thumbFields = buildThumbFields(g, id);
          if (process.env.NODE_ENV === "development") {
            console.log("Game mapping", id, thumbFields);
          }
          return {
            id,
            title: g.title || "Untitled",
            description: g.description || "",
            path: g.path,
            category: "game",
            type: "game",
            size: g.size,
            lastModified: g.lastModified,
            ...thumbFields,
          };
        }),
        ...(gameData?.emulators || []).map((e) => {
          const id = e.id || e.title;
          const thumbFields = buildThumbFields(e, id);
          if (process.env.NODE_ENV === "development") {
            console.log("Emulator mapping", id, thumbFields);
          }
          return {
            id,
            title: e.title || "Untitled Emulator",
            description: e.description || "",
            path: e.path,
            category: "emulator",
            type: "emulator",
            size: e.size,
            lastModified: e.lastModified,
            ...thumbFields,
          };
        }),
      ];

      setGames(allGames);
      setServerPort(port || null);
    } catch (err) {
      if (!ac.signal.aborted) {
        setError(`Failed to load games: ${err.message}`);
      }
    } finally {
      if (!abortRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const filteredGames = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return games.filter((game) => {
      if (selectedCategory !== "all" && game.category !== selectedCategory) {
        return false;
      }
      if (!query) return true;
      const haystack =
        (game.title || "") +
        " " +
        (game.description || "") +
        " " +
        (game.id || "");
      return haystack.toLowerCase().includes(query);
    });
  }, [games, searchQuery, selectedCategory]);

  const handleGameLaunch = async (game) => {
    try {
      if (window.electronAPI) {
        const gameType = game.category === "game" ? "games" : "emulators";
        await window.electronAPI.launchGame(game.path, gameType);
      }
    } catch (err) {
      setError("Failed to launch game. Please try again.");
    }
  };

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
      <div className="content-scroll">
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
    </div>
  );
}

export default App;
