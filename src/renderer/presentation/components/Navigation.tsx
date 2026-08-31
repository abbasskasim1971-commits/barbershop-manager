import React from "react";

interface NavigationProps {
  currentScreen: string;
  onScreenChange: (screen: string) => void;
  tabs: { id: string; label: string; permission: () => boolean }[];
  user: { id: number; username: string; role: string } | null;
  onLogout: () => void;
}

const Navigation: React.FC<NavigationProps> = ({
  currentScreen,
  onScreenChange,
  tabs,
  user,
  onLogout,
}) => {
  return (
    <nav className="navigation">
      <ul className="nav-tabs">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <button
              className={`nav-tab ${currentScreen === tab.id ? "active" : ""}`}
              onClick={() => onScreenChange(tab.id)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="nav-user">
        <span>
          {user?.username} ({user?.role})
        </span>
        <button onClick={onLogout} className="logout-btn">
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
