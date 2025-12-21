"use client";

import { useState } from "react";

interface SearchFormProps {
    onSearch: (query: string) => void;
    isLoading: boolean;
}

export default function SearchForm({ onSearch, isLoading }: SearchFormProps) {
    const [query, setQuery] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto space-y-4">
            <div className="relative">
                <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="What statistics are you looking for? (e.g., 'Ludność Polski 2023')"
                    className="w-full h-32 p-4 text-lg bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-100 placeholder-gray-500 resize-none shadow-xl backdrop-blur-md"
                />
                <div className="absolute bottom-4 right-4">
                    <button
                        type="submit"
                        disabled={isLoading || !query.trim()}
                        className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 
              ${isLoading
                                ? 'bg-blue-600/50 cursor-wait'
                                : 'bg-blue-600 hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95'
                            } text-white`}
                    >
                        {isLoading ? "Analyzing..." : "Analyze Request"}
                    </button>
                </div>
            </div>
        </form>
    );
}
