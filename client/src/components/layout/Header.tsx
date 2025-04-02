import { Link } from "wouter";

export default function Header() {
  return (
    <header className="bg-white shadow-sm z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <span className="material-icons text-primary text-3xl">face</span>
          <Link href="/">
            <h1 className="text-xl font-bold text-gray-800 cursor-pointer">PersonaChat</h1>
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-1">
            <span className="material-icons text-gray-500 cursor-pointer">notifications</span>
            <span className="material-icons text-gray-500 cursor-pointer">settings</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="User profile" className="object-cover w-full h-full" />
            </div>
            <span className="hidden md:inline text-sm font-medium text-gray-700">Demo User</span>
          </div>
        </div>
      </div>
    </header>
  );
}
