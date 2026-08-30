/**
 * App shell. Rename APP_NAME and TAGLINE at minute 25 — leaving template
 * branding visible is a straight loss on "is it built well".
 *
 * Deliberately no router, no auth screen, no onboarding. The app opens
 * directly into the thing it is for. Add a router only if the second screen
 * actually earns its 15 minutes.
 */
import Loop from './lib/Loop.jsx'
import { backend } from './lib/db.js'

const APP_NAME = 'Starter'
const TAGLINE = 'Rename me before you demo.'

export default function App() {
  return (
    <>
      <header className="mx-auto w-full max-w-xl px-4 pt-10 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="mt-1 text-ink-500">{TAGLINE}</p>

        {backend === 'local' && (
          // Dev-only reminder. It disappears the moment real keys are present, so
          // it can never leak into the judge's view once Supabase is wired.
          <p className="mt-3 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">
            local storage mode — add Supabase keys to .env to go multi-device
          </p>
        )}
      </header>

      <main>
        <Loop />
      </main>

      <footer className="mx-auto w-full max-w-xl px-4 pb-10 text-xs text-ink-500">
        LofiStack Hackathon 2026
      </footer>
    </>
  )
}
