"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? (
        <p
          role="alert"
          className="animate-scale-in rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.email}
          className="mt-1.5 block w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-base shadow-sm transition-all duration-200 hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5 block w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-base shadow-sm transition-all duration-200 hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#2563eb] px-4 py-3 font-semibold text-primary-foreground shadow-lg shadow-blue-600/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
