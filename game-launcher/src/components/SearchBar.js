import React from "react";
import "./SearchBar.css";

const SearchBar = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
}) => {
  return (
    <div className="search-bar">
      <div className="search-input-container">
        <input
          type="text"
          placeholder="Search games..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
        <span className="search-icon">🔍</span>
      </div>

      <div className="category-filter">
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="category-select"
        >
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default SearchBar;
