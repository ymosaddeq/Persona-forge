import { Link, useLocation } from "wouter";

export default function MobileNav() {
  const [location] = useLocation();

  return (
    <nav className="md:hidden bg-white border-t border-gray-200">
      <div className="flex justify-around">
        <Link href="/">
          <a className={`flex flex-col items-center py-2 px-3 ${location === '/' ? 'text-primary' : 'text-gray-500'}`}>
            <span className="material-icons">people</span>
            <span className="text-xs mt-1">Personas</span>
          </a>
        </Link>
        <a href="#" className="flex flex-col items-center py-2 px-3 text-gray-500">
          <span className="material-icons">chat</span>
          <span className="text-xs mt-1">Chats</span>
        </a>
        <a href="#" className="flex flex-col items-center py-2 px-3 text-gray-500">
          <span className="material-icons">favorite</span>
          <span className="text-xs mt-1">Favorites</span>
        </a>
        <a href="#" className="flex flex-col items-center py-2 px-3 text-gray-500">
          <span className="material-icons">settings</span>
          <span className="text-xs mt-1">Settings</span>
        </a>
      </div>
    </nav>
  );
}
