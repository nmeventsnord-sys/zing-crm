import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="text-center py-24">
      <div className="text-6xl mb-4">🔍</div>
      <h1 className="text-3xl font-bold text-blue-700 mb-2">Page introuvable</h1>
      <p className="text-gray-500 mb-6">Cette page n'existe pas.</p>
      <Link href="/">
        <button className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">
          Retour a l'accueil
        </button>
      </Link>
    </div>
  );
}
