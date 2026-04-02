import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Task Management App</h1>
      <p className="text-lg text-gray-600 mb-8">
        Organisez vos tâches avec un tableau Kanban
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
        >
          Se connecter
        </Link>
        <Link
          href="/register"
          className="px-6 py-3 border border-input rounded-md hover:bg-accent transition-colors"
        >
          S&apos;inscrire
        </Link>
      </div>
    </main>
  );
}
