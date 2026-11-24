"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form action={action} noValidate>
      <div className="field">
        <label htmlFor="email">E-mail corporativo</label>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} placeholder="nome@empresa.com.br" />
      </div>
      <div className="field">
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} placeholder="Digite sua senha" />
      </div>
      {state.error ? <p className="notice" role="alert">{state.error}</p> : null}
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "Validando acesso..." : "Entrar no ChatP"}
      </button>
      <p className="security-note">
        O acesso é exclusivo para funcionários previamente cadastrados pela equipe de TI.
        Não existe cadastro público.
      </p>
    </form>
  );
}
