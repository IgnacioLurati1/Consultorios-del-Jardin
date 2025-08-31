import { FaSearch } from "react-icons/fa";
import "./searchBar.css";

export default function SearchBar({searchHook, placeHolderText}: {searchHook: (searchTerm: string) => void, placeHolderText: string}) {
    return (
        <div className="crud-searchBar">
            <FaSearch className="search-icon" />
            <input className="crud-searchInput"
                type="text"
                placeholder={placeHolderText}
                onChange={e => searchHook(e.target.value)}
            />
        </div>
    )
}