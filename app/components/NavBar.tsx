"use client";

import { useClient } from "../context/ClientContext";

export default function NavBar() {
  const { reset } = useClient();

  return (
    <header className="fixed top-0 right-0 z-50 px-6 md:px-10 py-5">
      <button
        onClick={reset}
        className="chip !text-white border-white/20 hover:border-accent/60 transition"
        title="Change business name"
      >
        <span className="dot" /> Change client
      </button>
    </header>
  );
}
