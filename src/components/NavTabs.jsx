/**
 * NavTabs Component
 *
 * Bottom navigation tabs: Calendar, Stats, Handicap.
 */

import { Link, useLocation } from 'react-router-dom';
import { Calendar as CalendarIcon, BarChart3, TrendingUp, Trophy } from 'lucide-react';

export default function NavTabs() {
  const { pathname } = useLocation();

  const isCalendar = pathname === '/';
  const isStats = pathname === '/stats';
  const isHandicap = pathname === '/handicap';
  const isTournaments = pathname === '/tournaments';

  return (
    <nav className="nav-tabs">
      <Link to="/" style={{ textDecoration: 'none' }}>
        <button className={`btn ${isCalendar ? 'btn-primary' : 'card'}`}>
          <CalendarIcon size={20} />
          Calendario
        </button>
      </Link>
      <Link to="/stats" style={{ textDecoration: 'none' }}>
        <button className={`btn ${isStats ? 'btn-primary' : 'card'}`}>
          <BarChart3 size={20} />
          Estadísticas
        </button>
      </Link>
      <Link to="/handicap" style={{ textDecoration: 'none' }}>
        <button className={`btn ${isHandicap ? 'btn-primary' : 'card'}`}>
          <TrendingUp size={20} />
          Hándicap
        </button>
      </Link>
      <Link to="/tournaments" style={{ textDecoration: 'none' }}>
        <button className={`btn ${isTournaments ? 'btn-primary' : 'card'}`}>
          <Trophy size={20} />
          Torneos
        </button>
      </Link>
    </nav>
  );
}
