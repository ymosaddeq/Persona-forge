import { Link, useLocation } from "wouter";

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64 border-r border-gray-200 bg-white">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <nav className="mt-5 flex-1 px-2 space-y-1">
            <Link href="/">
              <a className={`${location === '/' ? 'bg-primary bg-opacity-10 text-primary' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'} group flex items-center px-2 py-2 text-sm font-medium rounded-md`}>
                <span className={`material-icons mr-3 ${location === '/' ? 'text-primary' : 'text-gray-400'}`}>people</span>
                My Personas
              </a>
            </Link>
            <a href="#" className="text-gray-600 hover:bg-gray-50 hover:text-gray-900 group flex items-center px-2 py-2 text-sm font-medium rounded-md">
              <span className="material-icons mr-3 text-gray-400">chat</span>
              Conversations
            </a>
            <a href="#" className="text-gray-600 hover:bg-gray-50 hover:text-gray-900 group flex items-center px-2 py-2 text-sm font-medium rounded-md">
              <span className="material-icons mr-3 text-gray-400">favorite</span>
              Favorites
            </a>
            <a href="#" className="text-gray-600 hover:bg-gray-50 hover:text-gray-900 group flex items-center px-2 py-2 text-sm font-medium rounded-md">
              <span className="material-icons mr-3 text-gray-400">settings</span>
              Settings
            </a>
          </nav>
        </div>
        <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
          <div className="flex-shrink-0 w-full group block">
            <div className="flex items-center">
              <span className="inline-block relative">
                <img className="h-9 w-9 rounded-full" src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="" />
                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-success ring-2 ring-white"></span>
              </span>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Demo User</p>
                <p className="text-xs font-medium text-gray-500 group-hover:text-gray-700">Account Settings</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
