import { useState } from "react";
import { Home } from "./pages/Home";
import { Table, type TableIntent } from "./pages/Table";
import { setNickname } from "./lib/identity";

function intentFromLocation(): TableIntent | null {
  const match = window.location.pathname.match(/^\/table\/([a-zA-Z0-9-]+)$/);
  if (match) return { type: "join", tableId: match[1] };
  return null;
}

export function App() {
  const [intent, setIntent] = useState<TableIntent | null>(() => intentFromLocation());

  if (intent) {
    return (
      <Table
        intent={intent}
        onLeave={() => setIntent(null)}
      />
    );
  }

  return (
    <Home
      onQuickPlay={(nickname, stakes) => {
        setNickname(nickname.trim());
        setIntent({ type: "quick", stakes });
      }}
      onCreateTable={(nickname, stakes) => {
        setNickname(nickname.trim());
        setIntent({ type: "create", stakes });
      }}
      onQuickTournament={(nickname) => {
        setNickname(nickname.trim());
        setIntent({ type: "tournament" });
      }}
    />
  );
}
